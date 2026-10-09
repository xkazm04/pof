/**
 * Reading TECHNIQUES — how a source's bytes become records.
 *
 * A wrapper records which technique (and which version of it) produced its raw record, so
 * the same game can later be read by a different technique without losing track of which
 * wrappers came from which reader. Diablo's design tables are TSV; its sprites (CEL/CL2),
 * palettes, levels (DUN) and audio (WAV inside an MPQ) would each be another technique with
 * another `assetKind`. Only the ones that exist are registered — an entry here is a promise
 * that `read` works, so a technique is added when it is built, not when it is imagined.
 *
 * `source-code` (/zelda, 2026-10-09): a decompilation has no design tables, so its reader takes
 * one C++ file and yields one record per class / struct / union definition — the record shape
 * is documented in `ingest/cppDecls.ts`. It needs the file's path (the record carries it), which
 * is why `read` takes an optional context; the table readers ignore it.
 */
import { parseTsv, type TsvTable } from '@/lib/catalog/ingest/tsv';
import { parseCppDecls } from '@/lib/catalog/ingest/cppDecls';

/** Transpose an Attribute-or-Variable/Value table into the single record consumed by FieldMap. */
export function parseTsvKv(text: string): TsvTable {
  const table = parseTsv(text);
  if (table.refusal) return table;

  const keyColumn = table.columns.includes('Attribute') ? 'Attribute'
    : table.columns.includes('Variable') ? 'Variable'
      : undefined;
  const valueColumn = table.columns.indexOf('Value');
  if (!keyColumn || valueColumn === -1 || table.columns.length !== 2) {
    return {
      columns: [], rows: [],
      malformed: [...table.malformed, {
        line: 1, expected: 2, actual: table.columns.length, raw: table.columns.join('\t'),
      }],
    };
  }

  // Recover physical line numbers so a duplicate remains actionable even when blank lines
  // or comments occur between attributes. `parseTsv` has already enforced row arity.
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const headerLine = lines.findIndex((line) => line.trim() !== '' && !line.trim().startsWith('#'));
  const validLineNumbers = lines
    .map((line, index) => ({ line, index }))
    .slice(headerLine + 1)
    .filter(({ line }) => line.trim() !== '' && !line.trim().startsWith('#') && line.split('\t').length === 2)
    .map(({ index }) => index + 1);

  const columns: string[] = [];
  const record: Record<string, string> = {};
  const firstLine = new Map<string, number>();
  const malformed = [...table.malformed];
  table.rows.forEach((row, index) => {
    const attribute = row[keyColumn].trim();
    const line = validLineNumbers[index] ?? index + 2;
    if (!attribute) {
      malformed.push({ line, expected: 1, actual: 0, raw: `\t${row.Value}` });
      return;
    }
    const earlier = firstLine.get(attribute);
    if (earlier !== undefined) {
      // A record cannot carry two values for one column. Keep the first and report the
      // duplicate through the parser's existing malformed-row channel instead of silently
      // allowing the later value to overwrite it.
      malformed.push({ line, expected: 1, actual: 2, raw: `${attribute}\t${row.Value}` });
      return;
    }
    firstLine.set(attribute, line);
    columns.push(attribute);
    record[attribute] = row.Value;
  });

  return { columns, rows: [record], malformed };
}

/** What kind of game asset a technique reads. Grows as techniques are built. */
export type AssetKind = 'table' | 'source-code';

/** What a reader may know beyond the bytes: where they came from. */
export interface ReadContext {
  /** Path relative to the source's data root. */
  file: string;
}

export interface ReadingTechnique {
  id: string;
  /** Bumped whenever `read` can produce different records from the same input. */
  version: number;
  assetKind: AssetKind;
  describe: string;
  read(text: string, ctx?: ReadContext): TsvTable;
}

export const TECHNIQUES: Record<string, ReadingTechnique> = {
  tsv: {
    id: 'tsv',
    version: 1,
    assetKind: 'table',
    describe: 'Tab-separated design table, header row first, no quoting (DevilutionX assets/txtdata).',
    read: (text) => parseTsv(text),
  },
  'tsv-kv': {
    id: 'tsv-kv',
    version: 2,
    assetKind: 'table',
    describe: 'Transposed Attribute-or-Variable/Value TSV projected as one record whose keys are columns.',
    read: parseTsvKv,
  },
  'cpp-decls': {
    id: 'cpp-decls',
    version: 2,
    assetKind: 'source-code',
    describe: 'One C++ header or source file → one record per class/struct/union definition (path, namespace, bases, member function and field NAMES), '
      + 'per enum definition (enumerator NAMES, never values), and per owner class whose member functions the file defines out of line '
      + '(function NAMES, keyed `owner::(definitions)`) — same columns for every kind (ingest/cppDecls.ts).',
    read: (text, ctx) => parseCppDecls(text, { file: ctx?.file ?? '' }),
  },
};

/** `tsv@1` — the label stored on every wrapper. */
export const techniqueLabel = (t: ReadingTechnique): string => `${t.id}@${t.version}`;

export function getTechnique(id: string): ReadingTechnique {
  const t = TECHNIQUES[id];
  if (!t) throw new Error(`Unknown reading technique "${id}" — registered: ${Object.keys(TECHNIQUES).join(', ')}`);
  return t;
}
