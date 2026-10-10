/**
 * Parameter-handle reader for C++ headers — the `cpp-handles` reading technique (v1, /zelda W11).
 *
 * A node library declares each tunable as a member HANDLE: the member that will point at the value once it
 * is bound from data, its declared type naming what the value is, and — in the decompilation /zelda reads —
 * a full-line comment directly above it naming WHEN the value is bound (per actor type, per call, per placed
 * instance, shared across a tree). `cpp-decls` keeps the member's name only (vault Findings F7). This reader
 * keeps one record per handle with its name, that scope word and its declared type — never a value: not the
 * number in the comment, not the initialiser, not what a source passes when it registers the handle.
 *
 * A handle is recognised by SHAPE, never by a word (the import law: no identifier from a reference enters the
 * repo; vault Decisions Z-D46 – Z-D48):
 *   - a `//` comment alone on its line, whose text starts with a lower-case identifier and ends in a hex
 *     number (`0x…`) — the identifier is the scope word, recorded as written;
 *   - on the very next line, exactly ONE data-member declaration of a class, complete on that line.
 * Not a handle: a marker followed by a blank line, by another comment (a commented-out member), by a method,
 * by a declaration that runs over two lines or declares two members; a marker written after code on its
 * line; anything in a region `#if 0` removes; anything outside a class. Registration calls in sources are
 * not read, so a header with no markers (and every source) yields zero rows with the full column list.
 *
 * Record shape (every value a string):
 *
 * | column         | holds                                                                                    |
 * |----------------|------------------------------------------------------------------------------------------|
 * | `file`         | path relative to the source root (from the reader context)                               |
 * | `line`         | 1-based line of the member declaration                                                   |
 * | `kind`         | `handle`                                                                                 |
 * | `name`         | the member as written                                                                    |
 * | `qualifiedName`| `namespace::owner::member::(handle@<file>)` — the record's key, see below                |
 * | `namespace`    | enclosing namespaces joined with `::` (`''` = global)                                    |
 * | `owner`        | the enclosing class chain, the member's own class last (`Outer::Inner`)                  |
 * | `marker`       | the scope word: the comment's first identifier, as written                               |
 * | `declaredType` | the tokens before the member's name, as written (`const float*`); an array adds `[]`, never its bound |
 * | `typeKind`     | what C++ keywords alone decide: `real` · `integer` · `boolean` · `character` · `void`; `named` when any other word (a library or engine type) is part of the type |
 *
 * The key ends in a synthetic segment naming the declaring file, so it can never equal a `cpp-decls` class,
 * enum or definition key, and two headers declaring the same owner keep apart (the identity of a definition
 * record, Z-D22). Strip the last `::(…)` segment and then the member to reach the owner's class key.
 * Shares the `cpp-decls` lexer and walk (`walkCppDecls` hooks), so a file reads as the same C++ for both.
 */
import { DEFAULT_CPP_LIMITS, walkCppDecls, type CppLimits, type CppLineComment, type CppMemberStatement, type CppReadContext } from './cppDecls';
import type { TsvTable } from './tsv';

export const CPP_HANDLE_COLUMNS = [
  'file', 'line', 'kind', 'name', 'qualifiedName', 'namespace', 'owner', 'marker', 'declaredType', 'typeKind',
] as const;

/** The last segment of a handle record's key — never a C++ name. */
export const cppHandleSegment = (file: string): string => (file ? `(handle@${file})` : '(handle)');

/** A full-line comment that starts with a lower-case identifier and ends in a hex number. */
const MARKER = /^\s*([a-z][a-z0-9_]*)\b.*\b0x[0-9A-Fa-f]+\s*$/;

const QUALIFIERS = new Set(['const', 'volatile', 'mutable', 'static', 'constexpr', 'constinit', 'inline', 'thread_local', 'register', 'extern']);
const REAL = new Set(['float', 'double']);
const INTEGER = new Set(['int', 'short', 'long', 'signed', 'unsigned']);
const CHARACTER = new Set(['char', 'wchar_t', 'char8_t', 'char16_t', 'char32_t']);

/** The type kind C++ keywords alone decide; `named` when any other word is part of the type. */
export function cppTypeKind(declaredType: string): string {
  const words = (declaredType.match(/[A-Za-z_$][A-Za-z0-9_$]*/g) ?? []).filter((w) => !QUALIFIERS.has(w));
  const keyword = (w: string) => REAL.has(w) || INTEGER.has(w) || CHARACTER.has(w) || w === 'bool' || w === 'void';
  if (words.length === 0 || !words.every(keyword)) return 'named';
  if (words.some((w) => REAL.has(w))) return 'real';
  if (words.includes('bool')) return 'boolean';
  if (words.includes('void')) return 'void';
  if (words.some((w) => CHARACTER.has(w)) && !words.some((w) => w === 'signed' || w === 'unsigned')) return 'character';
  return 'integer';
}

export function parseCppHandles(text: string, ctx: CppReadContext = { file: '' }, overrides: Partial<CppLimits> = {}): TsvTable {
  const limits = { ...DEFAULT_CPP_LIMITS, ...overrides };
  const comments: CppLineComment[] = [];
  const members: CppMemberStatement[] = [];
  const decls = walkCppDecls(text, ctx, limits, { comments, onMember: (m) => members.push(m) });
  const columns = [...CPP_HANDLE_COLUMNS];
  if (decls.refusal) return { columns, rows: [], malformed: [], refusal: decls.refusal };

  const markers = new Map<number, string>();
  for (const c of comments) {
    const m = c.ownLine ? MARKER.exec(c.text) : null;
    if (m) markers.set(c.line, m[1]);
  }
  const rows: Record<string, string>[] = [];
  for (const m of members) {
    const marker = markers.get(m.firstLine - 1);
    if (!marker || !m.owner || !m.declaredType || m.endLine !== m.firstLine) continue;
    const name = m.fields[0];
    const declaredType = m.array ? `${m.declaredType}[]` : m.declaredType;
    rows.push({
      file: ctx.file,
      line: String(m.firstLine),
      kind: 'handle',
      name,
      qualifiedName: `${[m.namespace, m.owner, name].filter(Boolean).join('::')}::${cppHandleSegment(ctx.file)}`,
      namespace: m.namespace,
      owner: m.owner,
      marker,
      declaredType,
      typeKind: cppTypeKind(m.declaredType),
    });
  }
  if (rows.length > limits.maxRecords) {
    return { columns, rows: [], malformed: [], refusal: { limit: 'maxRows', maximum: limits.maxRecords, observed: rows.length, message: `C++ maxRows limit is ${limits.maxRecords}; observed ${rows.length}` } };
  }
  return { columns, rows, malformed: decls.malformed };
}
