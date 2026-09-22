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
  /** Present when parsing stopped before producing any table data. */
  refusal?: TsvRefusal;
}

export interface TsvLimits {
  maxBytes: number;
  maxRows: number;
  maxColumns: number;
}

export type TsvLimit = keyof TsvLimits;

export interface TsvRefusal {
  limit: TsvLimit;
  maximum: number;
  observed: number;
  message: string;
}

/** Large enough for the real tables, while keeping accidental or hostile input bounded. */
export const DEFAULT_TSV_LIMITS: Readonly<TsvLimits> = {
  maxBytes: 1024 * 1024,
  maxRows: 10_000,
  maxColumns: 256,
};

/** Lines that carry no record: blank, or a `#` comment (DevilutionX uses neither, others do). */
function isSkippable(line: string): boolean {
  const t = line.trim();
  return t === '' || t.startsWith('#');
}

function utf8ByteLength(text: string): number {
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code <= 0x7f) bytes++;
    else if (code <= 0x7ff) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff && i + 1 < text.length
      && text.charCodeAt(i + 1) >= 0xdc00 && text.charCodeAt(i + 1) <= 0xdfff) {
      bytes += 4;
      i++;
    } else bytes += 3;
  }
  return bytes;
}

function refused(limit: TsvLimit, maximum: number, observed: number): TsvTable {
  return {
    columns: [], rows: [], malformed: [],
    refusal: {
      limit, maximum, observed,
      message: `TSV ${limit} limit is ${maximum}; observed ${observed}`,
    },
  };
}

export function parseTsv(text: string, overrides: Partial<TsvLimits> = {}): TsvTable {
  const limits = { ...DEFAULT_TSV_LIMITS, ...overrides };
  const bytes = utf8ByteLength(text);
  if (bytes > limits.maxBytes) return refused('maxBytes', limits.maxBytes, bytes);

  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const headerIdx = lines.findIndex((l) => !isSkippable(l));
  if (headerIdx === -1) return { columns: [], rows: [], malformed: [] };

  const header = lines[headerIdx];
  let columnCount = 1;
  for (let i = 0; i < header.length; i++) {
    if (header.charCodeAt(i) === 9) columnCount++;
  }
  if (columnCount > limits.maxColumns) {
    return refused('maxColumns', limits.maxColumns, columnCount);
  }
  const columns = header.split('\t').map((c) => c.trim());

  let rowCount = 0;
  for (let i = headerIdx + 1; i < lines.length; i++) {
    if (!isSkippable(lines[i])) rowCount++;
  }
  if (rowCount > limits.maxRows) return refused('maxRows', limits.maxRows, rowCount);

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
