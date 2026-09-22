/**
 * The mapping-table contract for legacy-game ingest.
 *
 * The point of this file is that **the design-gap report is DERIVED, not written down.**
 * A hand-maintained list of "fields PoF has no place for" is correct on the day it is
 * written and wrong the next time the upstream table gains a column — and its rot is
 * invisible, because a stale list and an accurate one look identical. So a mapping table
 * classifies each source column, and the audit computes the residual against the columns
 * the file ACTUALLY has.
 *
 * Four outcomes, and the distinction between the last two is the honest part:
 *  - `mapped`        — the value lands somewhere in the PoF entity.
 *  - `dropped`       — deliberately not carried, WITH a reason (a 1996 renderer detail).
 *  - `gap`           — PoF has no place for it. This is the backlog line.
 *  - `unclassified`  — present in the data, absent from the map. Nobody has judged it.
 *
 * `unclassified` is not a synonym for `dropped`. Treating "we never looked" as "we decided
 * not to carry it" is exactly the exemption-by-absence that `.claude/CLAUDE.md` Rule 4b
 * calls a defect, so it gets its own bucket and is reported separately.
 */

export type FieldRule =
  | { kind: 'mapped'; to: string }
  | { kind: 'dropped'; why: string }
  | { kind: 'gap'; why: string };

/** Source column name → what happens to it. */
export type FieldMap = Record<string, FieldRule>;

export const mapped = (to: string): FieldRule => ({ kind: 'mapped', to });
export const dropped = (why: string): FieldRule => ({ kind: 'dropped', why });
export const gap = (why: string): FieldRule => ({ kind: 'gap', why });

export interface GapColumn {
  column: string;
  why: string;
}

export interface ColumnAudit {
  /** Columns the source file actually carries. */
  columnCount: number;
  mapped: string[];
  dropped: string[];
  gap: GapColumn[];
  /** In the data, absent from the map — unjudged, which is a defect to close, not a decision. */
  unclassified: string[];
  /** In the map, absent from the data — the upstream table moved under the mapping. */
  declaredButAbsent: string[];
  /** mapped / columnCount. Counts only columns that exist, so drift cannot inflate it. */
  coverage: number;
}

export function auditColumns(columns: string[], map: FieldMap): ColumnAudit {
  const present = new Set(columns);
  const audit: ColumnAudit = {
    columnCount: columns.length,
    mapped: [], dropped: [], gap: [], unclassified: [],
    declaredButAbsent: Object.keys(map).filter((k) => !present.has(k)),
    coverage: 0,
  };

  for (const column of columns) {
    const rule = map[column];
    if (!rule) { audit.unclassified.push(column); continue; }
    if (rule.kind === 'mapped') audit.mapped.push(column);
    else if (rule.kind === 'dropped') audit.dropped.push(column);
    else audit.gap.push({ column, why: rule.why });
  }

  audit.coverage = columns.length === 0 ? 0 : audit.mapped.length / columns.length;
  return audit;
}
