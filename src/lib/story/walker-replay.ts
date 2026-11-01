/**
 * Replay a state-altitude lead — the falsifiability half of §8 ("a softlock report is a lead to
 * reproduce ... it must carry the state it got stuck in so the claim stays falsifiable").
 *
 * `replayLead(graph, lead, budget, claim)` re-executes `lead.path` from the declared start state,
 * independently of the walk that produced it: at each step it may take any move the walker could
 * have taken (authored edges whose guard CAN hold — `chance` read as possible — plus a last line's
 * container exit, or the containment fall-through), restricted to moves whose display id is the
 * next one on the path. Where several moves fit (two options landing on one node with different
 * writes), it searches them depth-first. External variables start at their `lead.state` value (the
 * walk sampled them; nothing in the path records them). `visited`/`flag` atoms read the path prefix
 * and the options taken on the branch.
 *
 * A lead from a forked walk (`mode: 'all'`) carries `lead.threads`: step j is a move of thread
 * `threads[j]`. A thread number seen for the first time is spawned from the fork the previous move
 * left; merges (arriving at a node another thread visited, while other threads are live) and
 * dead-end completions follow the walker's rules (`walker-walk.ts`), so the set of live threads at
 * the end is the walker's.
 *
 * The claim is checked where the path ends, with exactly `lead.state` (canonical comparison):
 *   - `softlock` (SOFTLOCK_LEAD): every live thread is stalled there — authored edges exist and none
 *     can hold;
 *   - `livelock` (LIVELOCK_LEAD): one live thread, and its (position, state) lies in a closed loop
 *     with no ending, re-checked over the bounded model (`livelockClosure`).
 *
 * A reproduced lead is still a lead: it proves the walk is real under the walker's reading of the
 * graph, not that a shipped runtime reads the graph the same way. Pure.
 */

import type { StoryFinding, StoryGraph, StoryLead } from '@/lib/story/types';
import { canonicalize } from '@/lib/story/canonical';
import { displayId, exitId } from '@/lib/story/reachability';
import { evalCond, type EvalEnv } from '@/lib/story/cond-eval';
import { buildWalkModel, type Site } from '@/lib/story/walker-model';
import { isStalled } from '@/lib/story/walker-resolve';
import { livelockClosure } from '@/lib/story/walker-livelock';
import { applyWrites, initialState, type VarState } from '@/lib/story/walker-state';

export type ReplayClaim = 'softlock' | 'livelock';

export interface ReplayResult {
  reproduced: boolean;
  /** The node the replay stalled at (softlock) or circles in (livelock), when reproduced. */
  node: string | null;
  reason: string;
  expansions: number;
}

/** Search budget: moves examined before the replay gives up (reported, never a pass). */
export const REPLAY_BUDGET = 200_000;

interface Frame {
  /** Walk id per thread; null once the thread completed (merged or dead end). */
  pos: readonly (string | null)[];
  idx: number;
  state: VarState;
  opts: readonly string[];
  /** Node -> the thread that first visited it (forked leads only). */
  owner: ReadonlyMap<string, number> | null;
  /** The fork the last move left, while its spawns are being placed. */
  forkFrom: string | null;
}

/** Replay a finding's lead with the claim its code makes. */
export function replayFinding(graph: StoryGraph, f: StoryFinding, budget = REPLAY_BUDGET): ReplayResult {
  if (!f.lead) return { reproduced: false, node: null, reason: 'the finding carries no lead', expansions: 0 };
  return replayLead(graph, f.lead, budget, f.code === 'LIVELOCK_LEAD' ? 'livelock' : 'softlock');
}

export function replayLead(graph: StoryGraph, lead: StoryLead, budget = REPLAY_BUDGET, claim: ReplayClaim = 'softlock'): ReplayResult {
  const model = buildWalkModel(graph);
  const path = lead.path;
  const tids = lead.threads;
  const fail = (reason: string, expansions = 0): ReplayResult => ({ reproduced: false, node: null, reason, expansions });
  if (path.length === 0) return fail('the lead carries no path');
  if (tids && (tids.length !== path.length || tids[0] !== 0)) return fail('lead.threads does not match lead.path');
  if (!model.topo.roots.includes(path[0])) return fail(`path starts at ${path[0]}, which is not a declared entry`);
  const tid = (j: number) => (tids ? tids[j] : 0);

  // First path index at which each node (or anything inside it) was visited.
  const firstIdx = new Map<string, number>();
  path.forEach((d, i) => {
    if (!model.topo.nodeById.has(d)) return;
    for (const id of model.lineage(d)) if (!firstIdx.has(id)) firstIdx.set(id, i);
  });
  const start = initialState(model.vars, model.setVars);
  for (const v of model.vars.values()) if (v.external && v.name in lead.state) start[v.name] = lead.state[v.name];
  const target = canonicalize(lead.state);
  const last = path.length - 1;

  const envAt = (f: Frame, s: Site): EvalEnv => {
    const visited = { has: (id: string) => (firstIdx.get(id) ?? Infinity) <= f.idx };
    const fired = { has: (id: string) => visited.has(id) || f.opts.includes(id) };
    // evalCond reads only `.has` of these sets.
    return {
      state: f.state, declared: model.declared, visited: visited as unknown as ReadonlySet<string>,
      fired: fired as unknown as ReadonlySet<string>, axis: s.node?.axis, definitions: graph.definitions, roll: (p) => p > 0,
    };
  };
  const owner0 = tids ? new Map<string, number>(model.site(path[0]).real ? [[path[0], 0]] : []) : null;

  /** The walker's arrival rules: merge into another thread's story, or complete at a dead end. */
  const arrive = (f: Frame, t: number, to: string): Frame => {
    const s = model.site(to);
    const pos = [...f.pos];
    pos[t] = to;
    let owner = f.owner;
    if (owner && s.real) {
      const liveN = pos.filter((p) => p !== null).length;
      const o = owner.get(s.display);
      if (o === undefined) owner = new Map(owner).set(s.display, t);
      else if (o !== t && liveN > 1) pos[t] = null;
      if (pos[t] !== null && liveN > 1 && s.authored.length === 0 && !s.ending && s.fallback.length === 0) pos[t] = null;
    }
    return { ...f, pos, owner };
  };

  const check = (f: Frame): ReplayResult | null => {
    if (canonicalize(f.state) !== target) return null;
    const liveT = f.pos.flatMap((p, t) => (p === null ? [] : [t]));
    if (liveT.length === 0) return null;
    const node = displayId(f.pos[liveT[0]]!);
    if (claim === 'softlock') {
      const stuck = liveT.every((t) => {
        const s = model.site(f.pos[t]!);
        return !s.ending && isStalled(s, envAt(f, s));
      });
      return stuck ? { reproduced: true, node, reason: `stalled at ${node} with the lead's state`, expansions: 0 } : null;
    }
    if (liveT.length !== 1) return null;
    const v = livelockClosure(model, f.pos[liveT[0]]!, f.state);
    return v.kind === 'livelock'
      ? { reproduced: true, node, reason: `at ${node} with the lead's state, inside a closed loop over ${v.closure.nodes.join(', ')} with no ending`, expansions: 0 }
      : null;
  };

  const stack: Frame[] = [{ pos: [path[0]], idx: 0, state: start, opts: [], owner: owner0, forkFrom: null }];
  let expansions = 0;
  let sawEnd = false;
  while (stack.length > 0) {
    if (expansions >= budget) return fail(`search budget of ${budget} moves exhausted`, expansions);
    const f = stack.pop()!;
    if (f.idx === last) {
      sawEnd = true;
      const hit = check(f);
      if (hit) return { ...hit, expansions };
    }
    const j = f.idx + 1;
    const t = j <= last ? tid(j) : tid(f.idx);
    const spawning = t === f.pos.length;
    if (t > f.pos.length) continue;
    const from = spawning ? f.forkFrom : f.pos[t];
    if (from === null || from === undefined) continue;
    const s = model.site(from);
    const env = envAt(f, s);
    const moves: { to: string; frame: () => Frame }[] = [];
    if (s.authored.length === 0) {
      if (!s.ending) for (const to of s.fallback) moves.push({ to, frame: () => f });
    } else {
      for (const [i, a] of s.authored.entries()) {
        if (evalCond(s.guards[i], env) === false) continue;
        const edge = a.edge!;
        moves.push({
          to: a.to,
          frame: () => {
            const state = { ...f.state };
            applyWrites(state, edge.writes, edge.id, model.vars);
            return { ...f, state, opts: edge.optionId ? [...f.opts, edge.optionId] : f.opts };
          },
        });
      }
      if (s.exit) moves.push({ to: s.exit, frame: () => f });
    }
    const here = displayId(from);
    for (let k = moves.length - 1; k >= 0; k--) {
      const m = moves[k];
      expansions += 1;
      const d = displayId(m.to);
      if (!spawning && d === here) {
        // Same display id: only a container's enter -> exit step (no path entry); a self-loop collapses.
        if (m.to !== exitId(d)) continue;
        const pos = [...f.pos];
        pos[t] = m.to;
        stack.push({ ...m.frame(), pos });
        continue;
      }
      if (j > last || d !== path[j]) continue;
      const base = m.frame();
      const grown = spawning ? { ...base, pos: [...base.pos, null] } : base;
      const next = arrive({ ...grown, idx: j }, t, m.to);
      stack.push({ ...next, forkFrom: spawning ? f.forkFrom : s.fork ? from : null });
    }
  }
  return fail(sawEnd
    ? `reached ${path[last]} along the path, but never with the lead's state ${claim === 'softlock' ? 'stalled' : 'inside a closed loop'} there`
    : 'the path cannot be walked from the declared start under the graph', expansions);
}
