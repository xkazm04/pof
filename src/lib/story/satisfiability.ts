/**
 * Domain-bounded satisfiability of a guard — the basis of `GUARD_UNSATISFIABLE` (§8).
 *
 * "A guard no state within the declared domains can satisfy." The question is answered over the
 * DECLARED domains only (§3), never over everything a runtime could hold:
 *   - the guard goes to negation normal form, then to DNF (capped: past `DNF_TERM_CAP` terms the
 *     answer is `unknown`, never a guess);
 *   - each term is a conjunction of literals, checked per variable against its domain — an
 *     interval with excluded points for `int`/`float`, the value list for `bool`/`enum`/`string`
 *     with `values`, subset reasoning for a SET (a variable some edge writes with `push`);
 *   - `flag`/`visited` are free booleans (a term holding both `flag X` and `not flag X` is dead),
 *     `axis` is a number bounded by `profile.axis`, `chance p` is satisfiable iff p > 0;
 *   - `expr`, an unresolvable `ref`, an undeclared variable, or a comparison the types do not
 *     support make a term `unknown`, so no lead is ever manufactured from a guard nobody can read.
 * The verdict is `unsat` only when EVERY term is provably dead. Pure.
 *
 * Evaluation over one concrete state lives in `cond-eval.ts` and is re-exported here.
 */

import type { Cond, CondOp, StoryProfileAxis, StoryVariable } from '@/lib/story/types';
import { compareOp } from '@/lib/story/cond-eval';

export { compareOp, evalCond, hasUntypedAtom, type EvalEnv, type Tri } from '@/lib/story/cond-eval';

export type Satisfiability = 'sat' | 'unsat' | 'unknown';

/** Past this many DNF terms a guard is reported `unknown` rather than expanded further. */
export const DNF_TERM_CAP = 512;

type Op = CondOp | 'nin';
type Lit =
  | { t: 'var'; name: string; op: Op; value: unknown }
  | { t: 'bool'; key: string; pos: boolean }
  | { t: 'chance'; p: number; pos: boolean }
  | { t: 'unknown' };
type Term = Lit[];

const NEG: Record<Op, Op> = { '==': '!=', '!=': '==', '<': '>=', '<=': '>', '>': '<=', '>=': '<', in: 'nin', nin: 'in' };
const AXIS = '\u0000axis';

class TooBig extends Error {}

function product(a: Term[], b: Term[]): Term[] {
  if (a.length * b.length > DNF_TERM_CAP) throw new TooBig();
  const out: Term[] = [];
  for (const x of a) for (const y of b) out.push([...x, ...y]);
  return out;
}

function union(parts: Term[][]): Term[] {
  const out = parts.flat();
  if (out.length > DNF_TERM_CAP) throw new TooBig();
  return out;
}

function dnf(c: Cond, pos: boolean, defs: Readonly<Record<string, Cond>> | undefined, seen: ReadonlySet<string>): Term[] {
  if (!c || typeof c !== 'object') return [[{ t: 'unknown' }]];
  if ('all' in c || 'any' in c) {
    const kids = ('all' in c ? c.all : (c as { any: Cond[] }).any).map((k) => dnf(k, pos, defs, seen));
    const conjunctive = 'all' in c === pos;
    return conjunctive ? kids.reduce(product, [[]]) : union(kids);
  }
  if ('not' in c) return dnf(c.not, !pos, defs, seen);
  if ('var' in c) return [[{ t: 'var', name: c.var, op: pos ? c.op : NEG[c.op], value: c.value }]];
  if ('axis' in c) return [[{ t: 'var', name: AXIS, op: pos ? c.axis.op : NEG[c.axis.op], value: c.axis.value }]];
  if ('flag' in c) return [[{ t: 'bool', key: `flag:${c.flag}`, pos }]];
  if ('visited' in c) return [[{ t: 'bool', key: `visited:${c.visited}`, pos }]];
  if ('chance' in c) return [[{ t: 'chance', p: c.chance, pos }]];
  if ('ref' in c) {
    const def = defs?.[c.ref];
    if (!def || seen.has(c.ref)) return [[{ t: 'unknown' }]];
    return dnf(def, pos, defs, new Set([...seen, c.ref]));
  }
  return [[{ t: 'unknown' }]];
}

const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const SENTINEL = Symbol('other');

/** Is there a value within one variable's domain meeting every literal on it? */
function varFeasible(v: StoryVariable | undefined, isSet: boolean, lits: Lit[]): Satisfiability {
  const ls = lits as Extract<Lit, { t: 'var' }>[];
  if (!v) return 'unknown';
  const values = v.domain?.values ?? (v.type === 'bool' ? [true, false] : undefined);
  if (isSet) {
    if (ls.some((l) => l.op !== 'in' && l.op !== 'nin')) return 'unknown';
    if (ls.some((l) => !Array.isArray(l.value))) return 'unknown';
    const banned = new Set(ls.filter((l) => l.op === 'nin').flatMap((l) => l.value as unknown[]));
    const ok = ls.filter((l) => l.op === 'in').every((l) =>
      (l.value as unknown[]).some((x) => !banned.has(x) && (values === undefined || values.includes(x))));
    return ok ? 'sat' : 'unsat';
  }
  if (values !== undefined) return firstFit(values, ls);
  if (v.type === 'int' || v.type === 'float') return numericFit(v, ls);
  // Unconstrained (a `string` with no values): the literal values plus one "anything else".
  const candidates: unknown[] = [SENTINEL];
  for (const l of ls) (Array.isArray(l.value) ? l.value : [l.value]).forEach((x) => candidates.push(x));
  return firstFit(candidates, ls);
}

function firstFit(candidates: readonly unknown[], ls: Extract<Lit, { t: 'var' }>[]): Satisfiability {
  let unknown = false;
  for (const c of candidates) {
    const results = ls.map((l) => (c === SENTINEL ? sentinelCompare(l.op) : compareOp(c, l.op, l.value)));
    if (results.includes(false)) continue;
    if (results.includes(null)) unknown = true;
    else return 'sat';
  }
  return unknown ? 'unknown' : 'unsat';
}

function sentinelCompare(op: Op): boolean | null {
  if (op === '!=' || op === 'nin') return true;
  if (op === '==' || op === 'in') return false;
  return null;
}

/** An interval with excluded points, over the reals or the integers. */
function numericFit(v: Pick<StoryVariable, 'type' | 'domain'>, ls: Extract<Lit, { t: 'var' }>[]): Satisfiability {
  const isInt = v.type === 'int';
  let lo = isNum(v.domain?.min) ? v.domain.min : -Infinity;
  let hi = isNum(v.domain?.max) ? v.domain.max : Infinity;
  let loOpen = false;
  let hiOpen = false;
  const excluded = new Set<number>();
  let pinned: number[] | null = null;
  const pin = (xs: number[]) => { pinned = pinned === null ? xs : pinned.filter((x) => xs.includes(x)); };
  for (const l of ls) {
    if (l.op === 'in' || l.op === 'nin') {
      if (!Array.isArray(l.value)) return 'unknown';
      const nums = l.value.filter(isNum);
      if (l.op === 'in') pin(nums);
      else nums.forEach((x) => excluded.add(x));
      continue;
    }
    if (!isNum(l.value)) {
      if (l.op === '!=') continue; // a number is never equal to a non-number
      return l.op === '==' ? 'unsat' : 'unknown';
    }
    const x = l.value;
    if (l.op === '==') pin([x]);
    else if (l.op === '!=') excluded.add(x);
    else if (l.op === '<' || l.op === '<=') {
      if (x < hi || (x === hi && l.op === '<')) { hi = x; hiOpen = l.op === '<'; }
    } else if (x > lo || (x === lo && l.op === '>')) { lo = x; loOpen = l.op === '>'; }
  }
  const inRange = (x: number) => (loOpen ? x > lo : x >= lo) && (hiOpen ? x < hi : x <= hi) && (!isInt || Number.isInteger(x)) && !excluded.has(x);
  const pins = pinned as number[] | null;
  if (pins !== null) return pins.some(inRange) ? 'sat' : 'unsat';
  if (!isInt) {
    if (lo < hi) return 'sat';
    return lo === hi && !loOpen && !hiOpen && !excluded.has(lo) ? 'sat' : 'unsat';
  }
  const first = Number.isFinite(lo) ? (loOpen && Number.isInteger(lo) ? lo + 1 : Math.ceil(lo)) : -Infinity;
  const last = Number.isFinite(hi) ? (hiOpen && Number.isInteger(hi) ? hi - 1 : Math.floor(hi)) : Infinity;
  if (first > last) return 'unsat';
  if (!Number.isFinite(first) || !Number.isFinite(last)) return 'sat';
  let blocked = 0;
  for (const x of excluded) if (Number.isInteger(x) && x >= first && x <= last) blocked += 1;
  return last - first + 1 > blocked ? 'sat' : 'unsat';
}

export interface SatContext {
  variables: ReadonlyMap<string, StoryVariable>;
  /** Variables written with `push` anywhere: their value is a subset of `domain.values`. */
  setVars: ReadonlySet<string>;
  axis?: StoryProfileAxis;
  definitions?: Readonly<Record<string, Cond>>;
}

function termFeasible(term: Term, ctx: SatContext): Satisfiability {
  let unknown = false;
  const bools = new Map<string, boolean>();
  const byVar = new Map<string, Lit[]>();
  for (const l of term) {
    if (l.t === 'unknown') unknown = true;
    else if (l.t === 'chance') {
      if (!isNum(l.p) || (l.pos ? l.p <= 0 : l.p >= 1)) return 'unsat';
    } else if (l.t === 'bool') {
      if (bools.has(l.key) && bools.get(l.key) !== l.pos) return 'unsat';
      bools.set(l.key, l.pos);
    } else {
      const list = byVar.get(l.name);
      if (list) list.push(l);
      else byVar.set(l.name, [l]);
    }
  }
  for (const [name, lits] of byVar) {
    const r = name === AXIS
      ? numericFit({ type: 'float', domain: { min: ctx.axis?.min, max: ctx.axis?.max } }, lits as Extract<Lit, { t: 'var' }>[])
      : varFeasible(ctx.variables.get(name), ctx.setVars.has(name), lits);
    if (r === 'unsat') return 'unsat';
    if (r === 'unknown') unknown = true;
  }
  return unknown ? 'unknown' : 'sat';
}

/** Can ANY state within the declared domains satisfy this guard? An absent guard is `sat`. */
export function guardSatisfiability(cond: Cond | undefined, ctx: SatContext): Satisfiability {
  if (cond === undefined) return 'sat';
  let terms: Term[];
  try {
    terms = dnf(cond, true, ctx.definitions, new Set());
  } catch (e) {
    if (e instanceof TooBig) return 'unknown';
    throw e;
  }
  let unknown = false;
  for (const t of terms) {
    const r = termFeasible(t, ctx);
    if (r === 'sat') return 'sat';
    if (r === 'unknown') unknown = true;
  }
  return unknown ? 'unknown' : 'unsat';
}
