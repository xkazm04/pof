/**
 * Value census — what each source column ACTUALLY contains.
 *
 * Every mapping defect found on the Diablo tables was a vocabulary nobody had looked at:
 * `spell = Null` on 142/168 items, `treasure = None`, `bookLevel = -1`, flag lists in one cell,
 * an element hidden inside `flags`. A column audit (mapped/dropped/gap) cannot see any of
 * them — it reads headers, not cells. The census reads cells, so each wave of the loop can
 * look at the vocabulary before trusting a mapping over it.
 */

/** Cell values that usually mean "nothing" in a legacy table. Flagged, never auto-dropped. */
export const SENTINEL_SUSPECTS = ['None', 'Null', 'NULL', 'none', 'null', '-1', 'N/A', 'NA', '(none)'];

export interface ColumnCensus {
  column: string;
  /** Rows whose cell is blank. */
  blank: number;
  distinct: number;
  /** Most frequent non-blank values, most frequent first (ties by value). */
  top: { value: string; count: number }[];
  /** Sentinel-looking values present in this column, with counts. */
  sentinels: { value: string; count: number }[];
  /** Cells containing a comma — a list stored in one cell. */
  listLike: number;
  /** Every non-blank value parses as a number. */
  numeric: boolean;
}

export function censusColumn(rows: Record<string, string>[], column: string, topN = 5): ColumnCensus {
  const counts = new Map<string, number>();
  let blank = 0;
  let listLike = 0;
  let numeric = true;
  for (const row of rows) {
    const v = (row[column] ?? '').trim();
    if (v === '') { blank++; continue; }
    counts.set(v, (counts.get(v) ?? 0) + 1);
    if (v.includes(',')) listLike++;
    if (Number.isNaN(Number(v))) numeric = false;
  }
  const ranked = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([value, count]) => ({ value, count }));
  return {
    column,
    blank,
    distinct: counts.size,
    top: ranked.slice(0, topN),
    sentinels: ranked.filter((r) => SENTINEL_SUSPECTS.includes(r.value)),
    listLike,
    numeric: counts.size > 0 && numeric,
  };
}

export function censusTable(rows: Record<string, string>[], columns: string[], topN = 5): ColumnCensus[] {
  return columns.map((c) => censusColumn(rows, c, topN));
}
