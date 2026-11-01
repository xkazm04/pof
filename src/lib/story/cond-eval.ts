/**
 * Evaluating a `Cond` (§6) over one walker state — three-valued, so an atom nothing can evaluate
 * stays visible instead of turning into a quiet `false`.
 *
 * `true` / `false` are decided; `null` is UNKNOWN: an `expr` atom (§6: "nothing can evaluate it"),
 * an undeclared variable, an unresolvable `ref`, a type the operator cannot compare, or a shape
 * the grammar does not have. Connectives follow Kleene logic (false dominates `all`, true
 * dominates `any`, `not` keeps unknown unknown).
 *
 * `chance` is resolved by the injected `roll`, so the walker decides it with its seeded PRNG and a
 * stall check can ask "is it POSSIBLE" with `roll = (p) => p > 0`. Pure: no clock, no randomness.
 */

import type { Cond, CondOp } from '@/lib/story/types';

export type Tri = boolean | null;

export interface EvalEnv {
  /** Declared variables only: a name absent here is undeclared and evaluates unknown. */
  readonly state: Readonly<Record<string, unknown>>;
  readonly declared: ReadonlySet<string>;
  /** Visited node ids. */
  readonly visited: ReadonlySet<string>;
  /** Visited node ids plus taken option ids (`flag` matches either, §6). */
  readonly fired: ReadonlySet<string>;
  /** Axis position of the node whose guard is evaluated; undefined when it declares none. */
  readonly axis?: number;
  readonly definitions?: Readonly<Record<string, Cond>>;
  readonly roll: (p: number) => boolean;
  /**
   * Read `flag` / `visited` as UNKNOWN instead of from the sets — for a search that abstracts the
   * walk history away (the livelock closure, `walker-livelock.ts`), where either answer is possible.
   */
  readonly unknownHistory?: boolean;
}

const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

/** One comparison `left op right`. Arrays on the left are SETS (written with `push`). */
export function compareOp(left: unknown, op: CondOp | 'nin', right: unknown): Tri {
  switch (op) {
    case 'in':
    case 'nin': {
      if (!Array.isArray(right)) return null;
      let hit: boolean;
      if (Array.isArray(left)) hit = left.some((x) => right.includes(x));
      else if (left === null || left === undefined) hit = false;
      else hit = right.includes(left);
      return op === 'in' ? hit : !hit;
    }
    case '==':
    case '!=': {
      if (Array.isArray(left)) return null;
      const eq = left === right;
      return op === '==' ? eq : !eq;
    }
    case '<':
    case '<=':
    case '>':
    case '>=': {
      if (!isNum(right)) return null;
      if (left === null || left === undefined) return false; // an unset value satisfies no bound
      if (!isNum(left)) return null;
      if (op === '<') return left < right;
      if (op === '<=') return left <= right;
      if (op === '>') return left > right;
      return left >= right;
    }
    default:
      return null;
  }
}

function allOf(values: Iterable<Tri>): Tri {
  let unknown = false;
  for (const v of values) {
    if (v === false) return false;
    if (v === null) unknown = true;
  }
  return unknown ? null : true;
}

function anyOf(values: Iterable<Tri>): Tri {
  let unknown = false;
  for (const v of values) {
    if (v === true) return true;
    if (v === null) unknown = true;
  }
  return unknown ? null : false;
}

function* lazy(conds: readonly Cond[], env: EvalEnv, seen: ReadonlySet<string>): Generator<Tri> {
  for (const c of conds) yield evalCond(c, env, seen);
}

/** Evaluate a guard. An absent guard is unguarded: `true`. */
export function evalCond(cond: Cond | undefined, env: EvalEnv, seen: ReadonlySet<string> = new Set()): Tri {
  if (cond === undefined) return true;
  if (!cond || typeof cond !== 'object') return null;
  if ('all' in cond) return Array.isArray(cond.all) ? allOf(lazy(cond.all, env, seen)) : null;
  if ('any' in cond) return Array.isArray(cond.any) ? anyOf(lazy(cond.any, env, seen)) : null;
  if ('not' in cond) {
    const v = evalCond(cond.not, env, seen);
    return v === null ? null : !v;
  }
  if ('var' in cond) {
    if (!env.declared.has(cond.var)) return null;
    return compareOp(env.state[cond.var], cond.op, cond.value);
  }
  if ('flag' in cond) return env.unknownHistory ? null : env.fired.has(cond.flag);
  if ('visited' in cond) return env.unknownHistory ? null : env.visited.has(cond.visited);
  if ('axis' in cond) return env.axis === undefined ? null : compareOp(env.axis, cond.axis.op, cond.axis.value);
  if ('chance' in cond) return isNum(cond.chance) ? env.roll(cond.chance) : null;
  if ('ref' in cond) {
    const def = env.definitions?.[cond.ref];
    if (!def || seen.has(cond.ref)) return null;
    return evalCond(def, env, new Set([...seen, cond.ref]));
  }
  return null; // `expr`, or a shape the grammar does not have
}

/** Does this guard contain an atom that can never be decided (`expr`, or an unknown shape)? */
export function hasUntypedAtom(cond: Cond | undefined, definitions?: Readonly<Record<string, Cond>>, seen: Set<string> = new Set()): boolean {
  if (!cond || typeof cond !== 'object') return cond !== undefined;
  if ('all' in cond) return cond.all.some((c) => hasUntypedAtom(c, definitions, seen));
  if ('any' in cond) return cond.any.some((c) => hasUntypedAtom(c, definitions, seen));
  if ('not' in cond) return hasUntypedAtom(cond.not, definitions, seen);
  if ('ref' in cond) {
    const def = definitions?.[cond.ref];
    if (!def || seen.has(cond.ref)) return !def;
    seen.add(cond.ref);
    return hasUntypedAtom(def, definitions, seen);
  }
  return 'expr' in cond || !('var' in cond || 'flag' in cond || 'visited' in cond || 'axis' in cond || 'chance' in cond);
}
