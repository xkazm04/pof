/**
 * Tolerant TSV reader for ingested legacy-game data tables.
 *
 * Deliberately NOT a general CSV parser: the tables this reads (DevilutionX's
 * `assets/txtdata/*.tsv`, and the same shape emitted by other reverse-engineering
 * projects) are tab-separated with no quoting, so quote handling would only invent
 * failure modes. What it DOES take seriously is the difference between a blank cell
 * and an absent one, and a row whose arity disagrees with the header — a 1996 table
 * read with a silently-shifting parser produces plausible garbage, which is the one
 * outcome an ingest must never reach.
 */

/** A row whose cell count disagreed with the header — surfaced, never repaired. */
export interface MalformedRow {
  /** 1-based line number in the source text (the header is line 1). */
  line: number;
  expected: number;
  actual: number;
  raw: string;
}

export interface TsvTable {
  columns: string[];
  rows: Record<string, string>[];
  malformed: MalformedRow[];
}

/** Lines that carry no record: blank, or a `#` comment (DevilutionX uses neither, others do). */
function isSkippable(line: string): boolean {
  const t = line.trim();
  return t === '' || t.startsWith('#');
}

export function parseTsv(text: string): TsvTable {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const headerIdx = lines.findIndex((l) => !isSkippable(l));
  if (headerIdx === -1) return { columns: [], rows: [], malformed: [] };

  const columns = lines[headerIdx].split('\t').map((c) => c.trim());
  const rows: Record<string, string>[] = [];
  const malformed: MalformedRow[] = [];

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const raw = lines[i];
    if (isSkippable(raw)) continue;
    const cells = raw.split('\t');
    if (cells.length !== columns.length) {
      malformed.push({ line: i + 1, expected: columns.length, actual: cells.length, raw });
      continue;
    }
    const row: Record<string, string> = {};
    columns.forEach((c, j) => { row[c] = cells[j]; });
    rows.push(row);
  }

  return { columns, rows, malformed };
}
