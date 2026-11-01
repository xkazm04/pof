/**
 * Resolution: which way on a walk takes at one {@link Site} in one state (`walker-model.ts` builds
 * the sites).
 *
 * A `choice` groups its edges by option (`optionId`, else the edge id) and offers an
 * option when any of its edges can hold; the cohort policy picks among offered options, and within
 * one option a guarded edge that holds outranks an unguarded one (the guarded edge is the
 * specialisation, the unguarded one the else), then an unknown one, ties uniform. A `gate` is
 * deterministic: lowest ending `precedence` first, then a definite guard before an unknown one,
 * then document order. Anything else picks uniformly among what holds. An unknown guard (`expr`)
 * counts as holding — optimistic, so a lead is never made from a guard nothing can read. An edge's
 * `chance` is one more conjunct. A miss caused only by `chance` rolls is not a stall: the walker
 * then takes one of the edges `chance` made possible.
 */

import type { StoryArc } from '@/lib/story/reachability';
import { evalCond, type EvalEnv, type Tri } from '@/lib/story/cond-eval';
import type { Site, WalkModel } from '@/lib/story/walker-model';

export type Pick = (n: number) => number;
export type PolicyPick = (keys: readonly string[]) => number;

/** `offered`: at a choice, the indices (into `Site.optionKeys`) of the options offered this visit. */
export type Resolution =
  | { kind: 'move'; to: string; arc?: StoryArc; offered?: readonly number[] }
  | { kind: 'ending' | 'stall' | 'terminal'; offered?: readonly number[] };

const POSSIBLE = (p: number) => p > 0;
const NONE: readonly number[] = [];

/** Every authored arc's guard under `env`, or with `chance` read as "possible". */
export function evaluateArcs(s: Site, env: EvalEnv, possible = false): Tri[] {
  const e = possible ? { ...env, roll: POSSIBLE } : env;
  return s.guards.map((g) => evalCond(g, e));
}

/** A site is stalled under a state when it has authored edges and none can hold, chance or not. */
export function isStalled(s: Site, env: EvalEnv): boolean {
  return s.authored.length > 0 && !s.exit && !s.free && evaluateArcs(s, env, true).every((v) => v === false);
}

/** Rank inside one option: guarded-true 0, unguarded-true 1, unknown 2. */
const rankOf = (s: Site, i: number, v: Tri) => (v === null ? 2 : s.guards[i] ? 0 : 1);

export function resolve(model: WalkModel, s: Site, env: EvalEnv, pick: Pick, policy: PolicyPick): Resolution {
  const n = s.authored.length;
  if (n === 0) {
    if (s.ending) return { kind: 'ending' };
    if (s.fallback.length === 0) return { kind: 'terminal' };
    return { kind: 'move', to: s.fallback[s.fallback.length === 1 ? 0 : pick(s.fallback.length)] };
  }
  if (n === 1 && s.free && !s.choice && !s.exit) return { kind: 'move', to: s.authored[0].to, arc: s.authored[0] };
  // `v === null` means every arc is unguarded: all hold, definitely.
  let v: Tri[] | null = null;
  if (!s.free) {
    v = evaluateArcs(s, env);
    if (v.every((x) => x === false)) {
      v = evaluateArcs(s, env, true);
      if (v.every((x) => x === false)) {
        if (s.ending) return { kind: 'ending' };
        if (s.exit) return { kind: 'move', to: s.exit };
        return { kind: 'stall', offered: s.choice ? NONE : undefined };
      }
    }
  }
  const vals = v;
  const holds = (i: number) => vals === null || vals[i] !== false;
  let live: readonly number[];
  let offered: readonly number[] | undefined;
  if (s.choice) {
    offered = s.byKey.map((arcs, k) => (vals === null || arcs.some(holds) ? k : -1)).filter((k) => k >= 0);
    const k = offered[offered.length === 1 ? 0 : policy(offered.map((o) => s.optionKeys[o]))];
    live = vals === null ? s.byKey[k] : s.byKey[k].filter(holds);
    if (vals !== null) {
      const best = Math.min(...live.map((i) => rankOf(s, i, vals[i])));
      live = live.filter((i) => rankOf(s, i, vals[i]) === best);
    }
  } else {
    live = s.authored.map((_, i) => i).filter(holds);
  }
  if (s.gate) {
    const prec = (i: number) => model.endingByNode.get(s.authored[i].to)?.precedence ?? Infinity;
    const unknown = (i: number) => (vals !== null && vals[i] === null ? 1 : 0);
    const first = [...live].sort((a, b) => prec(a) - prec(b) || unknown(a) - unknown(b) || a - b)[0];
    return { kind: 'move', to: s.authored[first].to, arc: s.authored[first], offered };
  }
  if (s.exit) {
    // On a last line the container's continuation competes with the way on the line itself
    // offers (at a choice: AFTER the option is picked, so the exit is never counted as an option).
    const ways = s.choice ? 1 : live.length;
    const k = pick(ways + 1);
    if (k === ways) return { kind: 'move', to: s.exit, offered };
    const j = s.choice ? live[live.length === 1 ? 0 : pick(live.length)] : live[k];
    return { kind: 'move', to: s.authored[j].to, arc: s.authored[j], offered };
  }
  const i = live[live.length === 1 ? 0 : pick(live.length)];
  return { kind: 'move', to: s.authored[i].to, arc: s.authored[i], offered };
}
