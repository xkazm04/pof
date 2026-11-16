/**
 * The decision behind LIVELOCK_LEAD (§8 state altitude): from a reached (position, state), can the
 * walk still arrive at an ending, or is it caught in a closed loop that has no way out?
 *
 * `livelockClosure(model, pos, state)` enumerates EVERY (position, state) the walker could reach
 * from there over the bounded model — the declared domains (writes clamped/rejected exactly as the
 * walker applies them), the walker's own container semantics (authored edges, a last line's exit,
 * the containment fall-through) — and reads every guard OPTIMISTICALLY: an edge is a way on unless
 * its guard is definitely false (`chance` read as possible, an `expr` / unknown atom as holding,
 * `flag` / `visited` as unknown because the walk history is abstracted away). The closure is a
 * superset of what any real walk can do, so the verdict is sound for a lead:
 *   - `livelock` only when the closure is fully enumerated, contains NO ending position (any
 *     position at an ending node counts as an exit, way on or not), has a way on from every state
 *     (no stall, no dead end), and is strongly connected — the start state lies in a closed set
 *     the walk can circle forever and never leave;
 *   - `exits` when an ending is in the closure, `open` when the closure is not one closed loop
 *     (a dead state, or the start is not yet inside the loop it drains into), `budget` past
 *     `LIVELOCK_BUDGET` states, `fork` when the closure meets a parallel fork (threads are not
 *     modelled here) — every one of these is NO claim, never a guess.
 * Pure.
 */

import type { WalkModel } from '@/lib/story/walker-model';
import { evalCond, type EvalEnv } from '@/lib/story/cond-eval';
import { displayId } from '@/lib/story/reachability';
import { applyWrites, type VarState } from '@/lib/story/walker-state';

/** States enumerated before the closure gives up (and claims nothing). */
export const LIVELOCK_BUDGET = 20_000;

/** One (position, state) key. The walker's states keep their variables in declaration order. */
export const stateKey = (pos: string, state: VarState): string => `${pos}\u0001${JSON.stringify(state)}`;

export interface Closure {
  /** Display ids of the positions in the loop, sorted. */
  nodes: string[];
  /** Every (position, state) key in the loop. */
  keys: ReadonlySet<string>;
}

export type ClosureVerdict = { kind: 'livelock'; closure: Closure } | { kind: 'exits' | 'open' | 'budget' | 'fork' };

const NO_HISTORY: ReadonlySet<string> = new Set();
const POSSIBLE = (p: number) => p > 0;

export function livelockClosure(model: WalkModel, pos: string, state: VarState, budget = LIVELOCK_BUDGET): ClosureVerdict {
  const at: { pos: string; state: VarState }[] = [{ pos, state }];
  const index = new Map<string, number>([[stateKey(pos, state), 0]]);
  const succ: number[][] = [];
  const stack = [0];
  while (stack.length > 0) {
    const k = stack.pop()!;
    const here = at[k];
    const s = model.site(here.pos);
    if (s.ending) return { kind: 'exits' };
    if (s.fork) return { kind: 'fork' };
    const env: EvalEnv = {
      state: here.state, declared: model.declared, visited: NO_HISTORY, fired: NO_HISTORY, axis: s.node?.axis,
      definitions: model.graph.definitions, roll: POSSIBLE, unknownHistory: true,
    };
    const next: { pos: string; state: VarState }[] = [];
    if (s.authored.length === 0) {
      for (const to of s.fallback) next.push({ pos: to, state: here.state });
    } else {
      s.authored.forEach((a, i) => {
        if (evalCond(s.guards[i], env) === false) return;
        const st = { ...here.state };
        applyWrites(st, a.edge!.writes, a.edge!.id, model.vars);
        next.push({ pos: a.to, state: st });
      });
      if (s.exit) next.push({ pos: s.exit, state: here.state });
    }
    if (next.length === 0) return { kind: 'open' };
    const out: number[] = [];
    for (const n of next) {
      const key = stateKey(n.pos, n.state);
      let j = index.get(key);
      if (j === undefined) {
        if (at.length >= budget) return { kind: 'budget' };
        j = at.push(n) - 1;
        index.set(key, j);
        stack.push(j);
      }
      out.push(j);
    }
    succ[k] = out;
  }
  // Strongly connected: every state in the closure leads back to the start.
  const pred: number[][] = at.map(() => []);
  succ.forEach((out, k) => out.forEach((j) => pred[j].push(k)));
  const back = new Uint8Array(at.length);
  back[0] = 1;
  const queue = [0];
  for (let head = 0; head < queue.length; head++) {
    for (const p of pred[queue[head]]) {
      if (back[p]) continue;
      back[p] = 1;
      queue.push(p);
    }
  }
  if (queue.length < at.length) return { kind: 'open' };
  const nodes = [...new Set(at.map((x) => displayId(x.pos)))].sort();
  return { kind: 'livelock', closure: { nodes, keys: new Set(index.keys()) } };
}
