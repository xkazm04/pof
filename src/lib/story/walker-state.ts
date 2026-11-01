/**
 * The walker's variable state, bounded by the DECLARED domains only (§3, §8).
 *
 *   - A walk starts at each variable's `initial`. A SET (a variable some edge writes with `push`)
 *     starting `null` is the empty set. An `external` variable is owned by another system, so its
 *     start is SAMPLED from its declared domain with the walk's seeded PRNG (int/float min..max,
 *     the value list otherwise); an unbounded external keeps its `initial`.
 *   - A write that would leave the domain is CLAMPED (numbers) or REJECTED (a value outside the
 *     value list, an arithmetic op on a non-number) — and every such write is RECORDED, never
 *     silently absorbed. A write to an undeclared name is recorded and ignored: the walker does not
 *     invent a variable.
 * Pure: randomness only through the injected PRNG.
 */

import type { StoryVariable, StoryWrite, WalkerDomainEvent } from '@/lib/story/types';

export type VarState = Record<string, unknown>;
export type DomainLog = Map<string, WalkerDomainEvent>;

const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const valuesOf = (v: StoryVariable): readonly unknown[] | undefined =>
  v.domain?.values ?? (v.type === 'bool' ? [true, false] : undefined);

function sampleDomain(v: StoryVariable, rnd: () => number): unknown {
  const values = valuesOf(v);
  if (values && values.length > 0) return values[Math.floor(rnd() * values.length)];
  const { min, max } = v.domain ?? {};
  if (!isNum(min) || !isNum(max)) return v.initial;
  if (v.type === 'int') return Math.ceil(min) + Math.floor(rnd() * (Math.floor(max) - Math.ceil(min) + 1));
  return min + rnd() * (max - min);
}

/** The start state of one walk. `rnd` is consumed only by external variables, in declaration order. */
export function initialState(vars: ReadonlyMap<string, StoryVariable>, setVars: ReadonlySet<string>, rnd?: () => number): VarState {
  const state: VarState = {};
  for (const v of vars.values()) {
    if (v.external && rnd) state[v.name] = sampleDomain(v, rnd);
    else if (setVars.has(v.name) && (v.initial === null || v.initial === undefined)) state[v.name] = [];
    else state[v.name] = v.initial ?? null;
  }
  return state;
}

function note(log: DomainLog | undefined, w: StoryWrite, edge: string, kind: WalkerDomainEvent['kind'], attempted: unknown) {
  if (!log) return;
  const key = `${w.var}\u0000${edge}\u0000${kind}`;
  const hit = log.get(key);
  if (hit) hit.count += 1;
  else log.set(key, { var: w.var, edge, kind, attempted, count: 1 });
}

/** Apply one edge's writes in order, mutating `state`. Out-of-domain writes go to `log`. */
export function applyWrites(
  state: VarState,
  writes: readonly StoryWrite[] | undefined,
  edge: string,
  vars: ReadonlyMap<string, StoryVariable>,
  log?: DomainLog,
): void {
  for (const w of writes ?? []) {
    const v = vars.get(w.var);
    if (!v) {
      note(log, w, edge, 'undeclared', w.value);
      continue;
    }
    const cur = state[w.var];
    const values = valuesOf(v);
    let next: unknown;
    if (w.op === 'set') next = w.value;
    else if (w.op === 'push') {
      if (values && !values.includes(w.value)) {
        note(log, w, edge, 'rejected', w.value);
        continue;
      }
      const set = Array.isArray(cur) ? cur : cur === null || cur === undefined ? [] : [cur];
      next = set.includes(w.value) ? set : [...set, w.value];
      state[w.var] = next;
      continue;
    } else {
      if (!isNum(cur) || !isNum(w.value)) {
        note(log, w, edge, 'rejected', w.value);
        continue;
      }
      next = w.op === 'add' ? cur + w.value : w.op === 'sub' ? cur - w.value : w.op === 'min' ? Math.min(cur, w.value) : Math.max(cur, w.value);
    }
    if (v.type === 'int' || v.type === 'float') {
      if (!isNum(next)) {
        note(log, w, edge, 'rejected', next);
        continue;
      }
      const { min, max } = v.domain ?? {};
      const clamped = Math.min(isNum(max) ? max : Infinity, Math.max(isNum(min) ? min : -Infinity, next));
      if (clamped !== next) note(log, w, edge, 'clamped', next);
      state[w.var] = clamped;
    } else if (values && (Array.isArray(next) ? !next.every((x) => values.includes(x)) : !values.includes(next))) {
      note(log, w, edge, 'rejected', next);
    } else {
      state[w.var] = next;
    }
  }
}
