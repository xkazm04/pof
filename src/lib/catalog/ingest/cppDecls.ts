/**
 * Declaration reader for C++ headers and sources — the `cpp-decls` reading technique.
 *
 * A decompilation carries no design tables: its design lives in the SHAPE of the code — which
 * classes exist, what they derive from, what they can do and what state they keep. This reader
 * turns one `.h` / `.cpp` file into one record per class / struct / union DEFINITION so that
 * shape can ride the same wrapper store, `FieldMap` audit and re-projection count as a TSV row.
 *
 * It is deliberately NOT a C++ parser. It tokenizes (comments, string literals and
 * preprocessor lines removed), tracks namespace / class scopes by brace, and skips every
 * function body and initializer wholesale. What it takes seriously is the import law that an
 * unreadable file must be spelled differently from an empty one: unbalanced braces, a stray
 * `}` and an unterminated comment or literal are REPORTED (`malformed`, with a line), an
 * oversized file is REFUSED, and a file with no definitions yields zero rows with the full
 * column list — never a silent shrug.
 *
 * Record shape (every value a string, lists joined with `CPP_LIST_SEP`):
 *
 * | column           | meaning                                                                    |
 * |------------------|----------------------------------------------------------------------------|
 * | `file`           | path relative to the source root (from the reader context)                 |
 * | `line`           | 1-based line of the class-key                                               |
 * | `kind`           | `class` · `struct` · `union`                                               |
 * | `name`           | as written, with a specialization's arguments (`Box<int>`) or an           |
 * |                  | out-of-line qualifier (`Outer::Inner`)                                     |
 * | `qualifiedName`  | `namespace::outer::name` — the record's key within its file                |
 * | `namespace`      | enclosing namespaces joined with `::` (`''` = global, `(anonymous)`)       |
 * | `outer`          | enclosing class chain joined with `::` (`''` when not nested)              |
 * | `templateParams` | the template parameter list (`''` when not a template)                     |
 * | `bases`          | base classes, access / `virtual` stripped                                  |
 * | `methods`        | member function NAMES in declaration order, overloads collapsed            |
 * | `fields`         | data member NAMES in declaration order (static members included)           |
 *
 * Not records, by design: forward declarations, enums, classes local to a function body (bodies
 * are skipped), and anonymous class / union members — their members fold into the enclosing
 * class, which is where C++ puts them. Of a preprocessor conditional only the FIRST branch is
 * read (`#if 0` blocks are skipped, their `#else` read), so a decompilation's matching / non-
 * matching twin branches cannot double a member or unbalance the braces.
 */
import type { MalformedRow, TsvRefusal, TsvTable } from './tsv';

export const CPP_LIST_SEP = ';';

export const CPP_RECORD_COLUMNS = [
  'file', 'line', 'kind', 'name', 'qualifiedName', 'namespace', 'outer',
  'templateParams', 'bases', 'methods', 'fields',
] as const;

export interface CppReadContext {
  file: string;
}

export interface CppLimits {
  maxBytes: number;
  maxRecords: number;
}

export const DEFAULT_CPP_LIMITS: Readonly<CppLimits> = { maxBytes: 1024 * 1024, maxRecords: 10_000 };

interface Tok {
  t: string;
  line: number;
}

interface Rec {
  line: number;
  kind: string;
  name: string;
  namespace: string;
  outer: string;
  templateParams: string;
  bases: string[];
  methods: string[];
  fields: string[];
}

type Scope =
  | { kind: 'namespace'; name: string }
  | { kind: 'transparent' }
  | { kind: 'class'; rec: Rec };

const CLASS_KEYS = new Set(['class', 'struct', 'union']);
const ACCESS = new Set(['public', 'private', 'protected']);
/** Words that precede a parenthesised group which is NOT a function's parameter list. */
const NON_CALL_PARENS = new Set(['decltype', 'alignas', '__attribute__', 'sizeof', 'alignof', 'noexcept', 'static_assert', 'requires', '__declspec']);
/** Specifiers / qualifiers that can never be a data member's name. */
const NOT_A_NAME = new Set([
  'const', 'volatile', 'mutable', 'static', 'constexpr', 'constinit', 'inline', 'thread_local',
  'unsigned', 'signed', 'int', 'char', 'short', 'long', 'float', 'double', 'bool', 'void', 'auto',
  'struct', 'class', 'union', 'enum', 'typename', 'extern', 'register',
]);
const MULTI_PUNCT = ['<<=', '...', '::', '->', '==', '!=', '<=', '&&', '||', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '++', '--', '<<'];

const isWord = (t: string): boolean => /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(t);
const isMacroName = (t: string): boolean => /^[A-Z][A-Z0-9_]+$/.test(t);

/* ── lexing ─────────────────────────────────────────────────────────────── */

type CondFrame = 'emit' | 'wait' | 'done';

function directive(text: string, conds: CondFrame[]): void {
  const m = /^#\s*([a-z]+)\s*([\s\S]*)$/.exec(text.trim());
  if (!m) return;
  const [, word, rest] = m;
  const expr = rest.replace(/\/\/.*$|\/\*.*?\*\//g, '').trim();
  const top = conds.length - 1;
  if (word === 'if') conds.push(expr === '0' ? 'wait' : 'emit');
  else if (word === 'ifdef' || word === 'ifndef') conds.push('emit');
  else if (word === 'elif' && top >= 0) conds[top] = conds[top] === 'wait' && expr !== '0' ? 'emit' : conds[top] === 'wait' ? 'wait' : 'done';
  else if (word === 'else' && top >= 0) conds[top] = conds[top] === 'wait' ? 'emit' : 'done';
  else if (word === 'endif' && top >= 0) conds.pop();
}

function lex(text: string, malformed: MalformedRow[]): Tok[] {
  const toks: Tok[] = [];
  const conds: CondFrame[] = [];
  const emitting = (): boolean => conds.every((c) => c === 'emit');
  let line = 1;
  let atLineStart = true;
  let i = 0;
  const n = text.length;
  const push = (t: string, at: number): void => { if (emitting()) toks.push({ t, line: at }); };

  while (i < n) {
    const ch = text[i];
    if (ch === '\n') { line++; atLineStart = true; i++; continue; }
    if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\f' || ch === '\v') { i++; continue; }

    if (ch === '#' && atLineStart) {
      // A directive runs to the end of the line, continued by a trailing backslash.
      const start = i;
      while (i < n && text[i] !== '\n') {
        if (text[i] === '\\' && text[i + 1] === '\n') { line++; i += 2; continue; }
        if (text[i] === '\\' && text[i + 1] === '\r' && text[i + 2] === '\n') { line++; i += 3; continue; }
        if (text[i] === '/' && text[i + 1] === '*') {
          const close = text.indexOf('*/', i + 2);
          const end = close === -1 ? n : close + 2;
          for (let k = i; k < end; k++) if (text[k] === '\n') line++;
          i = end;
          continue;
        }
        i++;
      }
      directive(text.slice(start, i), conds);
      continue;
    }
    atLineStart = false;

    if (ch === '/' && text[i + 1] === '/') {
      while (i < n && text[i] !== '\n') i++;
      continue;
    }
    if (ch === '/' && text[i + 1] === '*') {
      const close = text.indexOf('*/', i + 2);
      if (close === -1) {
        malformed.push({ line, expected: 0, actual: 1, raw: 'unterminated block comment' });
        break;
      }
      for (let k = i; k < close; k++) if (text[k] === '\n') line++;
      i = close + 2;
      continue;
    }

    // Raw string literal: R"delim( … )delim" (optionally u8R / LR / uR / UR).
    const raw = /^(?:u8|[uUL])?R"([^()\\\s]{0,16})\(/.exec(text.slice(i, i + 24));
    if (raw && (i === 0 || !/[A-Za-z0-9_]/.test(text[i - 1]))) {
      const terminator = `)${raw[1]}"`;
      const close = text.indexOf(terminator, i + raw[0].length);
      const startLine = line;
      if (close === -1) {
        malformed.push({ line, expected: 0, actual: 1, raw: 'unterminated raw string literal' });
        break;
      }
      for (let k = i; k < close; k++) if (text[k] === '\n') line++;
      i = close + terminator.length;
      push('"$str"', startLine);
      continue;
    }

    if (ch === '"' || ch === "'") {
      const startLine = line;
      let k = i + 1;
      while (k < n && text[k] !== ch && text[k] !== '\n') k += text[k] === '\\' ? 2 : 1;
      if (k >= n || text[k] === '\n') {
        malformed.push({ line, expected: 0, actual: 1, raw: `unterminated ${ch === '"' ? 'string' : 'character'} literal` });
        i = k;
        continue;
      }
      i = k + 1;
      push(ch === '"' ? '"$str"' : "'$chr'", startLine);
      continue;
    }

    const word = /^[A-Za-z_$][A-Za-z0-9_$]*/.exec(text.slice(i, i + 256));
    if (word) { push(word[0], line); i += word[0].length; continue; }
    const num = /^\.?[0-9](?:[0-9A-Za-z_.]|'(?=[0-9A-Za-z])|[eEpP][+-])*/.exec(text.slice(i, i + 128));
    if (num) { push(num[0], line); i += num[0].length; continue; }
    const multi = MULTI_PUNCT.find((p) => text.startsWith(p, i));
    if (multi) { push(multi, line); i += multi.length; continue; }
    push(ch, line);
    i++;
  }
  return toks;
}

/* ── token helpers ──────────────────────────────────────────────────────── */

/** Concatenate tokens, spacing only where two words would otherwise fuse (`unsigned int`). */
function join(toks: Tok[]): string {
  let out = '';
  let prev = '';
  for (const { t } of toks) {
    if (out && /[A-Za-z0-9_$]$/.test(prev) && /^[A-Za-z0-9_$]/.test(t)) out += ' ';
    out += t;
    prev = t;
  }
  return out;
}

/** Index of the token closing the group opened at `start` (`(`→`)`, `[`→`]`, `<`→`>`, `{`→`}`). */
function closeOf(toks: Tok[], start: number, open: string, close: string): number {
  let depth = 0;
  for (let k = start; k < toks.length; k++) {
    if (toks[k].t === open) depth++;
    else if (toks[k].t === close && --depth === 0) return k;
  }
  return -1;
}

interface Stripped {
  toks: Tok[];
  templateParams: string;
}

/** Drop leading `template<…>` heads, `[[attributes]]`, `export`, and ALL-CAPS macro invocations. */
function stripPrefixes(chunk: Tok[]): Stripped {
  let k = 0;
  let templateParams = '';
  let sawTemplate = false;
  for (;;) {
    const t = chunk[k]?.t;
    if (t === 'template' && chunk[k + 1]?.t === '<') {
      const end = closeOf(chunk, k + 1, '<', '>');
      if (end === -1) break;
      if (!sawTemplate) templateParams = join(chunk.slice(k + 2, end)) || '<>';
      sawTemplate = true;
      k = end + 1;
    } else if (t === '[' && chunk[k + 1]?.t === '[') {
      const end = closeOf(chunk, k, '[', ']');
      if (end === -1) break;
      k = end + 1;
    } else if (t === 'export') {
      k++;
    } else if (t !== undefined && isMacroName(t) && chunk[k + 1]?.t === '(') {
      const end = closeOf(chunk, k + 1, '(', ')');
      if (end === -1) break;
      k = end + 1;
    } else break;
  }
  return { toks: chunk.slice(k), templateParams };
}

interface Level {
  index: number;
  /** paren + bracket + brace depth (`{}` placeholders are depth-neutral). */
  nest: number;
  angle: number;
}

/** Walk tokens reporting the nesting at each one; `operator` symbols never open an angle. */
function levels(toks: Tok[]): Level[] {
  const out: Level[] = [];
  let nest = 0;
  let angle = 0;
  let afterOperator = false;
  for (let k = 0; k < toks.length; k++) {
    const t = toks[k].t;
    out.push({ index: k, nest, angle });
    if (t === 'operator') { afterOperator = true; continue; }
    if (afterOperator) {
      if (t === '(' && toks[k + 1]?.t === ')' && toks[k + 2]?.t === '(') { afterOperator = false; k++; out.push({ index: k, nest, angle }); continue; }
      if (t !== '(') continue;
      afterOperator = false;
    }
    if (t === '(' || t === '[') nest++;
    else if (t === ')' || t === ']') nest = Math.max(0, nest - 1);
    else if (t === '<' && k > 0 && (isWord(toks[k - 1].t) || toks[k - 1].t === '>')) angle++;
    else if (t === '>' && angle > 0) angle--;
  }
  return out;
}

const topLevel = (toks: Tok[]): Level[] => levels(toks).filter((l) => l.nest === 0 && l.angle === 0);

/** First top-level `(` that opens a parameter list, before any top-level `=`; -1 if none. */
function functionParen(toks: Tok[]): number {
  for (const { index } of topLevel(toks)) {
    const t = toks[index].t;
    if (t === '=' && toks[index - 1]?.t !== 'operator') return -1;
    if (t !== '(') continue;
    const prev = toks[index - 1]?.t ?? '';
    if (NON_CALL_PARENS.has(prev)) continue;
    return index;
  }
  return -1;
}

function hasTopLevelAssign(toks: Tok[]): boolean {
  return topLevel(toks).some(({ index }) => toks[index].t === '=' && toks[index - 1]?.t !== 'operator');
}

function hasCtorInitList(toks: Tok[]): boolean {
  return topLevel(toks).some(({ index }) => toks[index].t === ':' && (toks[index - 1]?.t === ')' || toks[index - 1]?.t === 'noexcept'));
}

function openParens(toks: Tok[]): number {
  let depth = 0;
  for (const { t } of toks) {
    if (t === '(') depth++;
    else if (t === ')') depth = Math.max(0, depth - 1);
  }
  return depth;
}

/** Split on top-level commas (paren-, bracket- and angle-aware). */
function splitTopLevel(toks: Tok[]): Tok[][] {
  const parts: Tok[][] = [[]];
  const lv = levels(toks);
  toks.forEach((tok, k) => {
    if (tok.t === ',' && lv[k].nest === 0 && lv[k].angle === 0) parts.push([]);
    else parts[parts.length - 1].push(tok);
  });
  return parts.filter((p) => p.length > 0);
}

/* ── classification ─────────────────────────────────────────────────────── */

interface ClassHead {
  kind: string;
  name: string;
  line: number;
  bases: string[];
}

/** `class|struct|union [attrs] Name [<spec>] [final] [: bases]` — the whole chunk before `{`, or null. */
function parseClassHead(toks: Tok[]): ClassHead | null {
  let k = toks[0]?.t === 'typedef' ? 1 : 0;
  const key = toks[k];
  if (!key || !CLASS_KEYS.has(key.t)) return null;
  k++;
  let name = '';
  let bareWords = 0;
  while (k < toks.length) {
    const t = toks[k].t;
    if (t === '[' && toks[k + 1]?.t === '[') {
      const end = closeOf(toks, k, '[', ']');
      if (end === -1) return null;
      k = end + 1;
    } else if (isWord(t) && t !== 'final' && toks[k + 1]?.t === '(') {
      const end = closeOf(toks, k + 1, '(', ')');
      if (end === -1) return null;
      k = end + 1;
    } else if (t === 'final') {
      k++;
    } else if (isWord(t) || t === '::') {
      // A second bare word after a non-macro name means this is a declaration
      // (`struct Foo bar`), not a class head.
      if (name && !isMacroName(name)) return null;
      let j = k;
      const parts: Tok[] = [];
      while (j < toks.length && (isWord(toks[j].t) || toks[j].t === '::') && toks[j].t !== 'final') {
        if (parts.length && isWord(toks[j].t) && isWord(parts[parts.length - 1].t)) break;
        parts.push(toks[j]);
        j++;
      }
      if (toks[j]?.t === '<') {
        const end = closeOf(toks, j, '<', '>');
        if (end === -1) return null;
        parts.push(...toks.slice(j, end + 1));
        j = end + 1;
      }
      name = join(parts);
      bareWords++;
      k = j;
    } else if (t === ':') {
      const bases = parseBases(toks.slice(k + 1));
      return bases ? { kind: key.t, name, line: key.line, bases } : null;
    } else return null;
  }
  return bareWords > 2 ? null : { kind: key.t, name, line: key.line, bases: [] };
}

function parseBases(toks: Tok[]): string[] | null {
  if (toks.length === 0) return null;
  const bases: string[] = [];
  for (const part of splitTopLevel(toks)) {
    const kept = part.filter((t) => !ACCESS.has(t.t) && t.t !== 'virtual');
    if (kept.length === 0 || kept.some((t) => t.t === ';' || t.t === '(' || t.t === ')')) return null;
    bases.push(join(kept));
  }
  return bases;
}

function functionName(toks: Tok[], paren: number): string {
  for (let k = paren - 1; k >= Math.max(0, paren - 8); k--) {
    if (toks[k].t === 'operator') {
      const symbol = toks.slice(k + 1, paren);
      if (symbol.length === 0 && toks[paren + 1]?.t === ')') return 'operator()';
      return `operator${symbol.length && isWord(symbol[0].t) ? ' ' : ''}${join(symbol)}`;
    }
    if (toks[k].t === ';' || toks[k].t === '{}') break;
  }
  const prev = toks[paren - 1];
  if (!prev || !isWord(prev.t)) return '';
  return toks[paren - 2]?.t === '~' ? `~${prev.t}` : prev.t;
}

function lastName(toks: Tok[]): string {
  for (let k = toks.length - 1; k >= 0; k--) {
    const t = toks[k].t;
    if (isWord(t) && !NOT_A_NAME.has(t) && toks[k + 1]?.t !== '::') return t;
  }
  return '';
}

interface Members {
  methods: string[];
  fields: string[];
}

/** One member-declaration chunk (between `;` / `{` / `}`) → the names it declares. */
function classifyMember(chunk: Tok[]): Members {
  const none: Members = { methods: [], fields: [] };
  let toks = stripPrefixes(chunk).toks;
  if (toks.length === 0) return none;
  const first = toks[0].t;
  if (['using', 'typedef', 'friend', 'static_assert', 'enum', 'namespace', 'template'].includes(first)) return none;
  if (CLASS_KEYS.has(first)) {
    // `class Foo;` is a forward declaration; `class Foo* mFoo` an elaborated field type.
    if (toks.length <= 2 || (toks.length === 3 && toks[1].t === '::')) return none;
    toks = toks.slice(1);
  }

  const paren = functionParen(toks);
  if (paren !== -1) {
    const close = closeOf(toks, paren, '(', ')');
    const inner = close === -1 ? [] : toks.slice(paren + 1, close);
    // `void (*mOnDone)(int)` / `void (Foo::*mFn)()` — a pointer-to-function FIELD.
    if (inner.length && (inner[0].t === '*' || inner[0].t === '&' || inner.some((t, j) => t.t === '*' && inner[j - 1]?.t === '::'))) {
      const name = lastName(inner);
      return name ? { methods: [], fields: [name] } : none;
    }
    const name = functionName(toks, paren);
    return name ? { methods: [name], fields: [] } : none;
  }

  const fields: string[] = [];
  for (const declarator of splitTopLevel(toks)) {
    const lv = levels(declarator);
    const stop = declarator.findIndex((t, k) => lv[k].nest === 0 && lv[k].angle === 0
      && (t.t === '=' || t.t === '{}' || t.t === '[' || t.t === ':'));
    const name = lastName(stop === -1 ? declarator : declarator.slice(0, stop));
    if (name) fields.push(name);
  }
  return { methods: [], fields };
}

type BraceAction = 'inline' | 'namespace' | 'transparent' | 'block' | ClassHead;

function classifyBrace(chunk: Tok[]): { action: BraceAction; templateParams: string } {
  const { toks, templateParams } = stripPrefixes(chunk);
  const result = (action: BraceAction) => ({ action, templateParams });
  if (toks.length === 0) return result(chunk.length ? 'inline' : 'block');
  if (openParens(chunk) > 0) return result('inline');
  const first = toks[0].t;
  if (first === 'namespace' || (first === 'inline' && toks[1]?.t === 'namespace')) return result('namespace');
  if (first === 'extern' && toks[1]?.t.startsWith('"')) return result('transparent');
  if (first === 'enum') return result('block');
  const head = parseClassHead(toks);
  if (head) return result(head);
  if (hasTopLevelAssign(chunk)) return result('inline');
  const last = chunk[chunk.length - 1].t;
  if (hasCtorInitList(chunk) && (isWord(last) || last === '>')) return result('inline');
  if (functionParen(toks) === -1 && (isWord(last) || last === ']' || last === '>')) return result('inline');
  return result('block');
}

function namespaceName(chunk: Tok[]): string {
  const toks = stripPrefixes(chunk).toks.filter((t) => t.t !== 'inline');
  const name = join(toks.slice(1));
  return name || '(anonymous)';
}

/* ── the reader ─────────────────────────────────────────────────────────── */

function refused(limit: 'maxBytes' | 'maxRows', maximum: number, observed: number): TsvTable {
  const refusal: TsvRefusal = { limit, maximum, observed, message: `C++ ${limit} limit is ${maximum}; observed ${observed}` };
  return { columns: [...CPP_RECORD_COLUMNS], rows: [], malformed: [], refusal };
}

const pushUnique = (list: string[], names: string[]): void => {
  for (const name of names) if (!list.includes(name)) list.push(name);
};

export function parseCppDecls(text: string, ctx: CppReadContext = { file: '' }, overrides: Partial<CppLimits> = {}): TsvTable {
  const limits = { ...DEFAULT_CPP_LIMITS, ...overrides };
  const bytes = Buffer.byteLength(text, 'utf8');
  if (bytes > limits.maxBytes) return refused('maxBytes', limits.maxBytes, bytes);

  const malformed: MalformedRow[] = [];
  const toks = lex(text, malformed);
  const records: Rec[] = [];
  const scopes: Scope[] = [{ kind: 'namespace', name: '' }];
  let chunk: Tok[] = [];

  const nsPath = (): string => scopes.flatMap((s) => (s.kind === 'namespace' && s.name ? [s.name] : [])).join('::');
  const outerPath = (): string => scopes.flatMap((s) => (s.kind === 'class' && s.rec.name ? [s.rec.name] : [])).join('::');
  const currentClass = (): Rec | undefined => {
    const top = scopes[scopes.length - 1];
    return top.kind === 'class' ? top.rec : undefined;
  };
  const flush = (): void => {
    const rec = currentClass();
    if (rec && chunk.length) {
      const m = classifyMember(chunk);
      pushUnique(rec.methods, m.methods);
      pushUnique(rec.fields, m.fields);
    }
    chunk = [];
  };
  const skipBlock = (at: number): number => {
    const end = closeOf(toks, at, '{', '}');
    if (end !== -1) return end;
    malformed.push({ line: toks[at].line, expected: 0, actual: 1, raw: 'unbalanced braces: block never closes' });
    return toks.length;
  };

  for (let i = 0; i < toks.length; i++) {
    const tok = toks[i];
    if (tok.t === ';') { flush(); continue; }
    if (ACCESS.has(tok.t) && toks[i + 1]?.t === ':') { flush(); i++; continue; }

    if (tok.t === '}') {
      flush();
      if (scopes.length === 1) {
        malformed.push({ line: tok.line, expected: 0, actual: 1, raw: 'stray } at file scope' });
        continue;
      }
      const closed = scopes.pop()!;
      if (closed.kind === 'class' && !closed.rec.name) {
        // Anonymous class / union member: its members are the enclosing class's.
        const parent = currentClass();
        if (parent) {
          pushUnique(parent.methods, closed.rec.methods);
          pushUnique(parent.fields, closed.rec.fields);
        }
      } else if (closed.kind === 'class') {
        records.push(closed.rec);
      }
      continue;
    }

    if (tok.t === '{') {
      const { action, templateParams } = classifyBrace(chunk);
      if (action === 'inline') {
        chunk.push({ t: '{}', line: tok.line });
        i = skipBlock(i);
        continue;
      }
      if (action === 'namespace') {
        scopes.push({ kind: 'namespace', name: namespaceName(chunk) });
        chunk = [];
        continue;
      }
      if (action === 'transparent') {
        scopes.push({ kind: 'transparent' });
        chunk = [];
        continue;
      }
      if (typeof action === 'object') {
        scopes.push({
          kind: 'class',
          rec: {
            line: action.line, kind: action.kind, name: action.name, namespace: nsPath(), outer: outerPath(),
            templateParams, bases: action.bases, methods: [], fields: [],
          },
        });
        chunk = [];
        continue;
      }
      // A function body, an enum, or any other block: the declaration before it is recorded,
      // the block itself is skipped whole.
      flush();
      i = skipBlock(i);
      continue;
    }

    chunk.push(tok);
  }

  for (let s = scopes.length - 1; s > 0; s--) {
    const open = scopes[s];
    malformed.push({ line: toks[toks.length - 1]?.line ?? 1, expected: 0, actual: 1, raw: `unbalanced braces: ${open.kind} scope never closes` });
    if (open.kind === 'class' && open.rec.name) records.push(open.rec);
  }

  if (records.length > limits.maxRecords) return refused('maxRows', limits.maxRecords, records.length);

  records.sort((a, b) => a.line - b.line);
  const rows = records.map((r): Record<string, string> => ({
    file: ctx.file,
    line: String(r.line),
    kind: r.kind,
    name: r.name,
    qualifiedName: [r.namespace, r.outer, r.name].filter(Boolean).join('::'),
    namespace: r.namespace,
    outer: r.outer,
    templateParams: r.templateParams,
    bases: r.bases.join(CPP_LIST_SEP),
    methods: r.methods.join(CPP_LIST_SEP),
    fields: r.fields.join(CPP_LIST_SEP),
  }));
  return { columns: [...CPP_RECORD_COLUMNS], rows, malformed };
}
