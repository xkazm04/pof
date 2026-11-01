/**
 * Replay a state-altitude lead — the falsifiability half of §8 ("a softlock report is a lead to
 * reproduce ... it must carry the state it got stuck in so the claim stays falsifiable").
 *
 * `replayLead(graph, lead)` re-executes `lead.path` from the declared start state, independently of
 * the walk that produced it: at each step it may take any move the walker could have taken
 * (authored edges whose guard CAN hold — `chance` read as possible — plus a last line's container
 * exit, or the containment fall-through), restricted to moves whose display id is the next one on
 * the path. Where several moves fit (two options landing on one node with different writes), it
 * searches them depth-first. The lead is REPRODUCED when some branch arrives at the path's last
 * node with exactly `lead.state` (canonical comparison) AND that position is stalled under it:
 * authored edges exist and none can hold. External variables start at their `lead.state` value
 * (the walk sampled them; nothing in the path records them). `visited`/`flag` atoms read the path
 * prefix and the options taken on the branch.
 *
 * A reproduced lead is still a lead: it proves the walk is real under the walker's reading of the
 * graph, not that a shipped runtime reads the graph the same way. Pure.
 */

import type { StoryGraph, StoryLead } from '@/lib/story/types';
import { canonicalize } from '@/lib/story/canonical';
import { displayId, exitId } from '@/lib/story/reachability';
import { evalCond, type EvalEnv } from '@/lib/story/cond-eval';
import { buildWalkModel } from '@/lib/story/walker-model';
import { isStalled } from '@/lib/story/walker-resolve';
import { applyWrites, initialState, type VarState } from '@/lib/story/walker-state';

export interface ReplayResult {
  reproduced: boolean;
  /** The node the replay stalled at, when reproduced. */
  node: string | null;
  reason: string;
  expansions: number;
}

/** Search budget: moves examined before the replay gives up (reported, never a pass). */
export const REPLAY_BUDGET = 200_000;

interface Frame {
  pos: string;
  idx: number;
  state: VarState;
  opts: readonly string[];
}

export function replayLead(graph: StoryGraph, lead: StoryLead, budget = REPLAY_BUDGET): ReplayResult {
  const model = buildWalkModel(graph);
  const path = lead.path;
  const fail = (reason: string, expansions = 0): ReplayResult => ({ reproduced: false, node: null, reason, expansions });
  if (path.length === 0) return fail('the lead carries no path');
  if (!model.topo.roots.includes(path[0])) return fail(`path starts at ${path[0]}, which is not a declared entry`);

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

  const envAt = (f: Frame): EvalEnv => {
    const visited = { has: (id: string) => (firstIdx.get(id) ?? Infinity) <= f.idx };
    const fired = { has: (id: string) => visited.has(id) || f.opts.includes(id) };
    // evalCond reads only `.has` of these sets.
    return {
      state: f.state, declared: model.declared, visited: visited as unknown as ReadonlySet<string>,
      fired: fired as unknown as ReadonlySet<string>, axis: model.site(f.pos).node?.axis,
      definitions: graph.definitions, roll: (p) => p > 0,
    };
  };

  const stack: Frame[] = [{ pos: path[0], idx: 0, state: start, opts: [] }];
  let expansions = 0;
  let sawEnd = false;
  while (stack.length > 0) {
    if (expansions >= budget) return fail(`search budget of ${budget} moves exhausted`, expansions);
    const f = stack.pop()!;
    const s = model.site(f.pos);
    const env = envAt(f);
    if (f.idx === last) {
      sawEnd = true;
      if (!s.ending && isStalled(s, env) && canonicalize(f.state) === target) {
        return { reproduced: true, node: path[last], reason: `stalled at ${path[last]} with the lead's state`, expansions };
      }
    }
    const moves: { to: string; frame: () => Frame }[] = [];
    if (s.authored.length === 0) {
      if (!s.ending) for (const to of s.fallback) moves.push({ to, frame: () => ({ ...f, pos: to }) });
    } else {
      for (const [i, a] of s.authored.entries()) {
        if (evalCond(s.guards[i], env) === false) continue;
        const edge = a.edge!;
        moves.push({
          to: a.to,
          frame: () => {
            const state = { ...f.state };
            applyWrites(state, edge.writes, edge.id, model.vars);
            return { pos: a.to, idx: f.idx, state, opts: edge.optionId ? [...f.opts, edge.optionId] : f.opts };
          },
        });
      }
      if (s.exit) moves.push({ to: s.exit, frame: () => ({ ...f, pos: s.exit! }) });
    }
    for (let k = moves.length - 1; k >= 0; k--) {
      const m = moves[k];
      expansions += 1;
      const d = displayId(m.to);
      // Same display id: only a container's enter -> exit step; a self-loop collapses in the path.
      const idx = d === path[f.idx] ? (m.to === exitId(d) ? f.idx : -1) : d === path[f.idx + 1] ? f.idx + 1 : -1;
      if (idx < 0) continue;
      stack.push({ ...m.frame(), idx });
    }
  }
  return fail(sawEnd
    ? `reached ${path[last]} along the path, but never with the lead's state stalled there`
    : 'the path cannot be walked from the declared start under the graph', expansions);
}
