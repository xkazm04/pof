/**
 * Markdown readers for a project's own scoring documents: pipe tables (with their 1-based source lines, so a
 * need can cite file:line), a 0-3 scorecard table, and a one-line pass rule. Pure over text; the CLI reads files.
 */
import { ok, err, type Result } from '@/types/result';

export interface MdRow { cells: string[]; line: number }
export interface MdTable { header: string[]; rows: MdRow[]; line: number }

const splitLines = (text: string): string[] => text.split(/\r?\n/);

/** A cell's plain text: bold markers dropped, whitespace trimmed. */
export const cellText = (cell: string): string => cell.replace(/\*\*|__/g, '').trim();

const isPipeRow = (line: string): boolean => line.trim().startsWith('|');
const isDivider = (line: string): boolean => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line);

/** Split one pipe row into cells, honouring `\|` escapes. */
function splitRow(line: string): string[] {
  const body = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return body.split(/(?<!\\)\|/).map((c) => cellText(c.replace(/\\\|/g, '|')));
}

/** Every pipe table in the text: a header row, a divider row, then body rows until the first non-pipe line. */
export function parseMdTables(text: string): MdTable[] {
  const lines = splitLines(text);
  const tables: MdTable[] = [];
  for (let i = 0; i + 1 < lines.length; i++) {
    if (!isPipeRow(lines[i]) || !isDivider(lines[i + 1])) continue;
    const table: MdTable = { header: splitRow(lines[i]), rows: [], line: i + 1 };
    let j = i + 2;
    for (; j < lines.length && isPipeRow(lines[j]); j++) table.rows.push({ cells: splitRow(lines[j]), line: j + 1 });
    tables.push(table);
    i = j - 1;
  }
  return tables;
}

/** The first table whose header holds every one of `headers` (case-insensitive); column indexes by header. */
export function findTable(text: string, headers: string[]): { table: MdTable; col: Record<string, number> } | undefined {
  for (const table of parseMdTables(text)) {
    const lower = table.header.map((h) => h.toLowerCase());
    const col: Record<string, number> = {};
    if (headers.every((h) => (col[h] = lower.indexOf(h.toLowerCase())) >= 0)) return { table, col };
  }
  return undefined;
}

export interface ScorecardElement {
  n: number;
  name: string;
  before?: number;
  now: number;
  /** The scorecard's own words for what still differs. */
  differs: string;
  line: number;
}

const score03 = (cell: string | undefined): number | undefined => {
  const m = /^([0-3])$/.exec(cellText(cell ?? ''));
  return m ? Number(m[1]) : undefined;
};

/** The element table of a scorecard: `# | Element | Before | Now | <what differs>`; the total row is skipped. */
export function parseScorecard(text: string): Result<ScorecardElement[], string> {
  const found = findTable(text, ['#', 'Element', 'Now']);
  if (!found) return err('no scorecard table with #, Element and Now columns');
  const { table, col } = found;
  const before = table.header.findIndex((h) => h.toLowerCase() === 'before');
  const differs = table.header.length - 1;
  const out: ScorecardElement[] = [];
  for (const row of table.rows) {
    if (!/^\d+$/.test(row.cells[col['#']] ?? '')) continue;
    const now = score03(row.cells[col.Now]);
    if (now === undefined) return err(`line ${row.line}: "Now" is not a score 0-3`);
    const b = before >= 0 ? score03(row.cells[before]) : undefined;
    out.push({
      n: Number(row.cells[col['#']]),
      name: row.cells[col.Element],
      ...(b !== undefined ? { before: b } : {}),
      now,
      differs: differs > col.Now ? row.cells[differs] ?? '' : '',
      line: row.line,
    });
  }
  if (out.length === 0) return err('the scorecard table has no numbered element rows');
  return ok(out);
}

/** The newest dated run note (`YYYY-MM-DD-*.md`), by name; undefined when none is dated. */
export function newestScorecard(fileNames: string[]): string | undefined {
  return fileNames.filter((f) => /^\d{4}-\d{2}-\d{2}-.+\.md$/.test(f)).sort().at(-1);
}

export interface PassRule {
  /** No element may score below this. */
  floor: number;
  /** Elements that must reach `requiredScore`. */
  required: number[];
  requiredScore: number;
  /** The rule's own sentence and its 1-based line. */
  sentence: string;
  line: number;
}

/** The project's pass line: `Pass: no element below N, and elements a, b and c at M.` */
export function parsePassRule(text: string): Result<PassRule, string> {
  const lines = splitLines(text);
  for (let i = 0; i < lines.length; i++) {
    const m = /^Pass:\s*no element below (\d),?\s*and elements ([\d,\s]+(?:and\s+\d+)?)\s+at (\d)/.exec(lines[i]);
    if (!m) continue;
    const required = (m[2].match(/\d+/g) ?? []).map(Number);
    const sentence = (/^Pass:[^.]*\./.exec(lines[i]) ?? [lines[i]])[0].trim();
    return ok({ floor: Number(m[1]), required, requiredScore: Number(m[3]), sentence, line: i + 1 });
  }
  return err('no "Pass: no element below N, and elements ... at M" line');
}

/** The paragraph (consecutive non-blank lines) starting at the first line that begins with `prefix`. */
export function paragraphFrom(text: string, prefix: string): { text: string; line: number } | undefined {
  const lines = splitLines(text);
  const start = lines.findIndex((l) => l.trim().startsWith(prefix));
  if (start < 0) return undefined;
  const body: string[] = [];
  for (let i = start; i < lines.length && lines[i].trim() !== ''; i++) body.push(lines[i].trim());
  return { text: body.join(' '), line: start + 1 };
}
