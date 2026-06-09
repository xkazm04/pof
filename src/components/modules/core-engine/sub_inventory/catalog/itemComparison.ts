/**
 * Pure comparison model for the same-type Item Comparison panel.
 *
 * Turns a set of 2–3 items into per-stat rows with an explicit numeric delta and
 * direction for each value (so the best/worst is unambiguous WITHOUT relying on
 * bar colour), plus the index of the strongest item overall for a winner marker.
 *
 * Delta semantics — generalises the natural 2-item "+5 / -5" reading to N items:
 *   delta = value − (highest value among the OTHER items)
 *     • unique leader  → positive (its lead over the runner-up)
 *     • trailing item  → negative (its gap to the best)
 *     • tied for best  → 0
 */
import type { ItemData } from '../_shared/data';

export interface ComparisonValue {
  numericValue: number;
  display: string;
  maxValue: number;
  /** value − best-of-others; sign encodes lead (+) / gap (−) / tie (0). */
  delta: number;
  /** ties for the highest value in the row (a meaningful comparison exists). */
  isBest: boolean;
  /** uniquely highest (delta > 0). */
  isLeader: boolean;
  /** strictly below the row's best. */
  isTrailing: boolean;
  /** there is a non-zero best in this row, so the delta is meaningful. */
  hasComparison: boolean;
}

export interface ComparisonRow {
  label: string;
  values: ComparisonValue[];
  /** denominator for bar scaling (max of numericValues + declared maxValues). */
  max: number;
  bestValue: number;
}

export interface Comparison {
  rows: ComparisonRow[];
  /** index of the strongest item overall, or -1 when ambiguous / none. */
  winnerIndex: number;
  /** per-item count of rows where it holds (or ties) the best value. */
  winCounts: number[];
}

const EMPTY: Comparison = { rows: [], winnerIndex: -1, winCounts: [] };

export function buildComparison(items: ItemData[]): Comparison {
  if (items.length < 2) return EMPTY;

  const labels = Array.from(new Set(items.flatMap(i => i.stats.map(s => s.label))));

  const rows: ComparisonRow[] = labels.map(label => {
    const raw = items.map(item => {
      const s = item.stats.find(st => st.label === label);
      return {
        numericValue: s?.numericValue ?? 0,
        display: s?.value ?? '—',
        maxValue: s?.maxValue ?? 0,
      };
    });

    const numerics = raw.map(v => v.numericValue);
    const max = Math.max(...numerics, ...raw.map(v => v.maxValue), 1);
    const bestValue = Math.max(...numerics);
    const hasComparison = bestValue > 0;

    const values: ComparisonValue[] = raw.map((v, idx) => {
      const others = numerics.filter((_, j) => j !== idx);
      const otherMax = others.length ? Math.max(...others) : v.numericValue;
      const delta = v.numericValue - otherMax;
      return {
        ...v,
        delta,
        isBest: hasComparison && v.numericValue === bestValue,
        isLeader: hasComparison && delta > 0,
        isTrailing: hasComparison && v.numericValue < bestValue,
        hasComparison,
      };
    });

    return { label, values, max, bestValue };
  });

  const winCounts = items.map((_, idx) =>
    rows.reduce((acc, r) => acc + (r.values[idx].isBest ? 1 : 0), 0),
  );
  const maxWins = winCounts.length ? Math.max(...winCounts) : 0;
  const winnerIndex =
    maxWins > 0 && winCounts.filter(c => c === maxWins).length === 1
      ? winCounts.indexOf(maxWins)
      : -1;

  return { rows, winnerIndex, winCounts };
}

/** Compact signed label for a delta, e.g. `+5`, `-3`, or `tie`. */
export function formatDelta(value: ComparisonValue): string {
  if (!value.hasComparison) return '';
  if (value.delta > 0) return `+${value.delta}`;
  if (value.delta < 0) return `${value.delta}`;
  return 'tie';
}

/** Screen-reader sentence describing a value's standing in its row. */
export function describeDelta(value: ComparisonValue): string {
  if (!value.hasComparison) return '';
  if (value.isLeader) return `Best, ${value.delta} ahead of next`;
  if (value.isTrailing) return `${Math.abs(value.delta)} behind best`;
  return 'Tied for best';
}
