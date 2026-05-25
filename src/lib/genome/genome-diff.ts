/** ── Genome Field Diff ────────────────────────────────────────────────────── *
 * Declarative field-level diff between two genomes (character or item), used to
 * preview what a shared build code will change before it is applied — e.g.
 * "Crit Chance 5% → 12%  (+7%)" or "Walk Speed 400 → 600 cm/s  (+200)".
 *
 * Editors describe their comparable fields as `DiffFieldSpec[]`; the engine
 * here handles formatting, sign, and direction so both editors stay consistent.
 * ────────────────────────────────────────────────────────────────────────── */

export type DeltaDirection = 'up' | 'down' | 'neutral';

/** One changed field, fully formatted for display. */
export interface GenomeFieldDelta {
  /** Section the field belongs to, e.g. "Combat" or "Traits". */
  group: string;
  /** Human label, e.g. "Crit Chance". */
  label: string;
  /** Formatted previous value (baseline). */
  from: string;
  /** Formatted incoming value. */
  to: string;
  /** Signed, formatted delta for numeric fields; null for text/bool fields. */
  delta: string | null;
  /** Direction of change — drives coloring in the UI. */
  direction: DeltaDirection;
}

/** Declarative description of a single comparable field. */
export interface DiffFieldSpec<T> {
  group: string;
  label: string;
  /** Extract the comparable value from a genome. */
  get: (g: T) => number | string | boolean | undefined;
  /** Unit suffix shown after numeric values (e.g. "cm/s"). Ignored if `percent`. */
  unit?: string;
  /** Numeric stored as 0..1 but displayed as a percentage. */
  percent?: boolean;
  /** Fixed decimal places for numeric display (default: integer-aware auto). */
  decimals?: number;
}

const EPSILON = 1e-9;

function roundTo(value: number, decimals?: number): number {
  if (decimals === undefined) {
    return Number.isInteger(value) ? value : Math.round(value * 100) / 100;
  }
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function formatNumber(value: number, spec: DiffFieldSpec<unknown>): string {
  if (spec.percent) return `${roundTo(value * 100, spec.decimals ?? 0)}%`;
  const n = roundTo(value, spec.decimals);
  return spec.unit ? `${n} ${spec.unit}` : `${n}`;
}

function formatDelta(diff: number, spec: DiffFieldSpec<unknown>): string {
  const sign = diff > 0 ? '+' : ''; // negatives already carry their own '-'
  if (spec.percent) return `${sign}${roundTo(diff * 100, spec.decimals ?? 0)}%`;
  const n = roundTo(diff, spec.decimals);
  return spec.unit ? `${sign}${n} ${spec.unit}` : `${sign}${n}`;
}

function formatScalar(value: number | string | boolean | undefined, spec: DiffFieldSpec<unknown>): string {
  if (value === undefined) return '—';
  if (typeof value === 'number') return formatNumber(value, spec);
  if (typeof value === 'boolean') return value ? 'on' : 'off';
  return value;
}

/**
 * Compute the list of fields that differ between `base` and `incoming`.
 * Only changed fields are returned, in spec order. When `base` is undefined
 * (no baseline to compare against) every incoming field is reported as a
 * change from "—".
 */
export function diffGenomes<T>(
  base: T | undefined,
  incoming: T,
  specs: DiffFieldSpec<T>[],
): GenomeFieldDelta[] {
  const deltas: GenomeFieldDelta[] = [];

  for (const spec of specs) {
    const typelessSpec = spec as DiffFieldSpec<unknown>;
    const before = base === undefined ? undefined : spec.get(base);
    const after = spec.get(incoming);

    // Numeric comparison with epsilon to avoid float-noise false positives.
    if (typeof before === 'number' && typeof after === 'number') {
      const diff = after - before;
      if (Math.abs(diff) < EPSILON) continue;
      deltas.push({
        group: spec.group,
        label: spec.label,
        from: formatScalar(before, typelessSpec),
        to: formatScalar(after, typelessSpec),
        delta: formatDelta(diff, typelessSpec),
        direction: diff > 0 ? 'up' : 'down',
      });
      continue;
    }

    // Non-numeric (string / boolean / newly-present) — equal values are skipped.
    if (before === after) continue;
    deltas.push({
      group: spec.group,
      label: spec.label,
      from: formatScalar(before, typelessSpec),
      to: formatScalar(after, typelessSpec),
      delta: null,
      direction: 'neutral',
    });
  }

  return deltas;
}

/** Group a flat delta list by section, preserving first-seen order. */
export function groupDeltas(deltas: GenomeFieldDelta[]): { group: string; items: GenomeFieldDelta[] }[] {
  const order: string[] = [];
  const byGroup = new Map<string, GenomeFieldDelta[]>();
  for (const d of deltas) {
    if (!byGroup.has(d.group)) {
      byGroup.set(d.group, []);
      order.push(d.group);
    }
    byGroup.get(d.group)!.push(d);
  }
  return order.map((group) => ({ group, items: byGroup.get(group)! }));
}
