/**
 * The craft rubric's COVERAGE CHANNEL (pure) — the one question a lens cannot ask of itself.
 *
 * A gauge can only report in the categories its lens holds: every finding must name a violated
 * criterion. A defect the auditor can SEE but no criterion covers therefore has nowhere to go,
 * and the gauge renders as silence — which reads as a pass. The channel is a second,
 * differently-addressed field on the gauge: "a defect visible in this artifact that no criterion
 * covers". Its output is a PROPOSAL for the next lens version, addressed to the lens author.
 *
 * It never moves the level. The level is the criteria's verdict; a free-text penalty would be an
 * unsourced criterion with a new route in. A credible fatal defect is a disqualifier-list change
 * (lens-disqualifiers.ts), made by the author, not an auditor's remark.
 */
import type { LensId } from '@/lib/craft/lens-map';

/** One visible-but-uncovered defect, as the auditor wrote it. */
export interface CoverageGap {
  detail: string;
}

/** Stored form: the gap plus the cell and lens version it was seen under. */
export interface CoverageGapRow extends CoverageGap {
  catalogId: string;
  entityId: string;
  step: string;
  lens: LensId;
  lensVersion: number;
  model: string;
  notedAt?: string;
}

/** Whitespace/case-folded identity, so the same remark phrased twice counts once per cell. */
export function gapKey(detail: string): string {
  return detail.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Drop blank and within-gauge duplicate remarks, keep first wording. */
export function dedupeGaps(gaps: readonly CoverageGap[]): CoverageGap[] {
  const seen = new Set<string>();
  const out: CoverageGap[] = [];
  for (const g of gaps) {
    const k = gapKey(g.detail);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push({ detail: g.detail.trim() });
  }
  return out;
}

export interface LensGapSummary {
  lens: LensId;
  /** Distinct gauged cells that reported at least one gap under this lens. */
  cells: number;
  /** Distinct remarks, most-repeated first; `cells` counts the cells that made each one. */
  gaps: { detail: string; cells: number }[];
}

/**
 * Per-lens roll-up for the lens author. A remark repeated across cells is a blind spot with
 * evidence attached; the count is cells (not rows) so one cell re-gauged is not repetition.
 * Counts and names only — never a coverage percentage.
 */
export function summarizeCoverageGaps(rows: readonly CoverageGapRow[]): LensGapSummary[] {
  const byLens = new Map<LensId, Map<string, { detail: string; cells: Set<string> }>>();
  for (const r of rows) {
    const k = gapKey(r.detail);
    if (!k) continue;
    const m = byLens.get(r.lens) ?? new Map();
    const e = m.get(k) ?? { detail: r.detail, cells: new Set<string>() };
    e.cells.add(`${r.catalogId}\u0000${r.entityId}\u0000${r.step}`);
    m.set(k, e);
    byLens.set(r.lens, m);
  }
  return [...byLens.entries()]
    .map(([lens, m]) => {
      const gaps = [...m.values()]
        .map((e) => ({ detail: e.detail, cells: e.cells.size }))
        .sort((a, b) => b.cells - a.cells || a.detail.localeCompare(b.detail));
      const allCells = new Set<string>();
      for (const e of m.values()) for (const c of e.cells) allCells.add(c);
      return { lens, cells: allCells.size, gaps };
    })
    .sort((a, b) => b.cells - a.cells || a.lens.localeCompare(b.lens));
}
