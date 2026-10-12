/**
 * Registration reader for C++ sources: the `cpp-registrations` reading technique (v1, /zelda W32).
 *
 * A condition node declares its parameter handles as plain members with no scope comment, so `cpp-handles`
 * reads none of them (vault Findings F20). The scope lives in the SOURCE: the node's loading hook registers
 * each handle with one call per handle, handing the call the handle's address. This reader keeps one record per
 * such call with the member it names and the callee as written (the scope witness) - never an argument after
 * the first, never a value, never any other statement of the body (vault Decisions Z-D47, Z-D127).
 *
 * A registration is recognised by SHAPE, never by a word (the import law):
 *   - it sits inside the BODY of an out-of-line member-function definition at namespace scope (the shape
 *     `cpp-decls` records as a `definition`); the owner and the function name come from that definition;
 *   - it is a statement that BEGINS with one bare identifier (no keyword; nothing before it on the statement)
 *     followed by `(`, whose first argument is `&` and ONE bare identifier (not `this`), and which is the whole
 *     statement, ended by its `;`.
 * Not a registration: a call nested in a condition, an expression, a return or another call's arguments; a
 * callee reached through a member access or a qualifier; a first argument that is not the address of one bare
 * word; anything in a class body, in a free function or in a region `#if 0` removes.
 *
 * Record shape (every value a string):
 *
 * | column         | holds                                                                                   |
 * |----------------|-----------------------------------------------------------------------------------------|
 * | `file`         | path relative to the source root (from the reader context)                              |
 * | `line`         | 1-based line of the statement's first token                                             |
 * | `kind`         | `registration`                                                                          |
 * | `name`         | the member as written                                                                   |
 * | `qualifiedName`| `namespace::owner::member::(registration@<file>)` - the record's key, see below         |
 * | `namespace`    | enclosing namespaces joined with `::` (`''` = global)                                   |
 * | `owner`        | the owner of the defined function as written                                            |
 * | `call`         | the callee as written: the scope witness                                                |
 * | `function`     | the name of the enclosing function, as written                                          |
 *
 * The key ends in a synthetic segment naming the defining file, so it can never equal a `cpp-decls` or
 * `cpp-handles` key. Strip the last `::(...)` segment to reach `namespace::owner::member`, which pairs with a
 * handle key stripped the same way. A file that registers one (owner, member) twice gives two rows with one
 * key: the wrapper's duplicate-key report counts it, the reader never dedupes.
 * Shares the `cpp-decls` lexer and walk (the `onBody` hook of `walkCppDecls`).
 */
import { DEFAULT_CPP_LIMITS, walkCppDecls, type CppBodyToken, type CppLimits, type CppReadContext, type CppSkippedBody } from './cppDecls';
import type { TsvTable } from './tsv';

export const CPP_REGISTRATION_COLUMNS = [
  'file', 'line', 'kind', 'name', 'qualifiedName', 'namespace', 'owner', 'call', 'function',
] as const;

/** The last segment of a registration record's key - never a C++ name. */
export const cppRegistrationSegment = (file: string): string => (file ? `(registration@${file})` : '(registration)');

const BARE_WORD = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

/** Words that can begin a statement with a parenthesis after them and are never a callee. */
const NOT_A_CALLEE = new Set([
  'if', 'for', 'while', 'switch', 'return', 'sizeof', 'alignof', 'decltype', 'catch', 'throw', 'delete', 'new',
  'co_return', 'co_await', 'co_yield', 'static_assert', 'noexcept', 'typeid', 'else', 'do', 'case', 'goto',
]);

/** Where a statement can begin inside a body: after a `;`, an opening or a closing brace, or at the start. */
const STATEMENT_BREAK = new Set([';', '{', '}']);

interface Registration {
  line: number;
  call: string;
  member: string;
}

function registrationsOf(body: readonly CppBodyToken[]): Registration[] {
  // A line-splice backslash is whitespace, as the enumeration-macro reader of `cpp-decls` treats it.
  const toks = body.filter((t) => t.t !== '\\');
  const found: Registration[] = [];
  for (let k = 0; k < toks.length; k++) {
    if (k > 0 && !STATEMENT_BREAK.has(toks[k - 1].t)) continue;
    const call = toks[k]?.t;
    if (!call || !BARE_WORD.test(call) || NOT_A_CALLEE.has(call) || toks[k + 1]?.t !== '(') continue;
    if (toks[k + 2]?.t !== '&') continue;
    const member = toks[k + 3]?.t;
    if (!member || !BARE_WORD.test(member) || member === 'this') continue;
    const after = toks[k + 4]?.t;
    if (after !== ',' && after !== ')') continue;
    // The call must be the whole statement: find its closing parenthesis, then require a `;`.
    let depth = 0;
    let close = -1;
    for (let j = k + 1; j < toks.length; j++) {
      if (toks[j].t === '(') depth++;
      else if (toks[j].t === ')' && --depth === 0) { close = j; break; }
    }
    if (close === -1 || toks[close + 1]?.t !== ';') continue;
    found.push({ line: toks[k].line, call, member });
  }
  return found;
}

export function parseCppRegistrations(text: string, ctx: CppReadContext = { file: '' }, overrides: Partial<CppLimits> = {}): TsvTable {
  const limits = { ...DEFAULT_CPP_LIMITS, ...overrides };
  const bodies: CppSkippedBody[] = [];
  const decls = walkCppDecls(text, ctx, limits, { onBody: (b) => bodies.push(b) });
  const columns = [...CPP_REGISTRATION_COLUMNS];
  if (decls.refusal) return { columns, rows: [], malformed: [], refusal: decls.refusal };

  const rows: Record<string, string>[] = [];
  for (const body of bodies) {
    for (const r of registrationsOf(body.toks)) {
      rows.push({
        file: ctx.file,
        line: String(r.line),
        kind: 'registration',
        name: r.member,
        qualifiedName: `${[body.namespace, body.owner, r.member].filter(Boolean).join('::')}::${cppRegistrationSegment(ctx.file)}`,
        namespace: body.namespace,
        owner: body.owner,
        call: r.call,
        function: body.fn,
      });
    }
  }
  if (rows.length > limits.maxRecords) {
    return { columns, rows: [], malformed: [], refusal: { limit: 'maxRows', maximum: limits.maxRecords, observed: rows.length, message: `C++ maxRows limit is ${limits.maxRecords}; observed ${rows.length}` } };
  }
  return { columns, rows, malformed: decls.malformed };
}
