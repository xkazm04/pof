/**
 * The walker's model of a graph: WP2's topology, read as a runtime would walk it (§8: "the graph a
 * runtime walks is not the graph an author drew"; it walks (node, state) pairs).
 *
 * Positions are WP2's walk ids — a real node id, or `exitId(X)` for container X — so the walker
 * walks exactly the graph the structural pass reasons about. At each position (a {@link Site}):
 *   - an ending (kind `ending` or listed in `endings[]`) ends the walk when it has no authored way
 *     on, or none that holds. An ending WITH a way on is a sub-graph outcome (a conversation that
 *     ends "turned away" and returns to its quest) and the walk continues through it;
 *   - AUTHORED traversal edges (then/option/gate; `contains`/`influences`/unknown kinds are never
 *     walked) are the way on, each guarded by its `when` AND, when it lands on an ending, that
 *     ending's own `when` (§6: an ending fires only when its condition holds);
 *   - a position with NO authored edge falls through WP2's containment arcs: entering a container
 *     goes to an entry child, a child with no way on goes to its container's exit;
 *   - "reaching anything inside opens the container's exits" is read at runtime as: on a LAST LINE
 *     of container X — a non-gate position whose every authored edge leaves X — X's own
 *     continuation (when X has an authored leaving edge) is one more unguarded way on, picked
 *     uniformly beside the authored edges (at a choice: beside the picked option's edge, and never
 *     counted as an option). Offering it at EVERY child would end a 30-line conversation at its
 *     first line half the time; never offering it loops a conversation whose last line returns to
 *     its hub forever. Mid-container positions do not see it;
 *   - a position whose authored edges all fail, with no exit to take, is a STALL.
 * Resolution at a site (which way on a walk takes) lives in `walker-resolve.ts`.
 */

import type { Cond, StoryEnding, StoryGraph, StoryNode, StoryVariable } from '@/lib/story/types';
import { buildStoryTopology, exitId, displayId, type StoryArc, type StoryTopology } from '@/lib/story/reachability';
import { resolveContainment } from '@/lib/story/structure';
import { walkCond } from '@/lib/story/variables';
import { hasUntypedAtom } from '@/lib/story/cond-eval';

export interface Site {
  /** The node whose kind decides resolution: the node itself, or the container of an exit. */
  node: StoryNode | undefined;
  /** The id a person reads: an exit reads as its container. */
  display: string;
  real: boolean;
  /** Indices of the node and every container above it (real positions only; empty for an exit). */
  line: Int32Array;
  /** Position is the real choice node (not an exit). */
  choice: boolean;
  gate: boolean;
  ending: boolean;
  authored: readonly StoryArc[];
  /** Effective guard per authored arc (edge `when` AND landing ending's `when` AND edge `chance`). */
  guards: readonly (Cond | undefined)[];
  /** No authored arc carries a guard: every one holds in every state. */
  free: boolean;
  /** Containment moves, used only when there is no authored edge. */
  fallback: readonly string[];
  /** On a last line: the enclosing container's exit, one more (unguarded) way on. */
  exit?: string;
  /** Choice sites: distinct option keys (`optionId`, else edge id) and the arcs of each. */
  optionKeys: readonly string[];
  byKey: readonly (readonly number[])[];
}

export interface WalkModel {
  graph: StoryGraph;
  topo: StoryTopology;
  /** Real node ids in index order (the order `Site.line` indexes). */
  ids: readonly string[];
  vars: ReadonlyMap<string, StoryVariable>;
  declared: ReadonlySet<string>;
  setVars: ReadonlySet<string>;
  endingByNode: ReadonlyMap<string, StoryEnding>;
  untypedEdges: readonly string[];
  /** Some guard reads `flag` / `visited`, so walks must keep their history. */
  needsHistory: boolean;
  site(pos: string): Site;
  /** The node and every container above it. */
  lineage(id: string): readonly string[];
}

export function buildWalkModel(graph: StoryGraph): WalkModel {
  const nodeIds = new Set(graph.nodes.map((n) => n.id));
  const topo = buildStoryTopology(graph, resolveContainment(graph, nodeIds).parentOf);
  const ids = [...topo.nodeById.keys()];
  const index = new Map(ids.map((id, i) => [id, i]));
  const vars = new Map<string, StoryVariable>();
  for (const v of graph.variables) if (!vars.has(v.name)) vars.set(v.name, v);
  const setVars = new Set<string>();
  for (const e of graph.edges) for (const w of e.writes ?? []) if (w.op === 'push') setVars.add(w.var);
  const endingByNode = new Map<string, StoryEnding>();
  for (const e of graph.endings) if (!endingByNode.has(e.node)) endingByNode.set(e.node, e);
  const isEnding = (id: string) => endingByNode.has(id) || topo.nodeById.get(id)?.kind === 'ending';

  const guards = new Map<StoryArc, Cond | undefined>();
  const untyped = new Set<string>();
  let needsHistory = false;
  const history = (atom: Cond) => {
    if ('flag' in atom || 'visited' in atom) needsHistory = true;
  };
  for (const a of topo.arcs) {
    if (!a.edge) continue;
    // Edge `chance` (§5: "modelled traversal probability for the walker") is one more conjunct.
    const parts = [a.edge.when, endingByNode.get(a.to)?.when, typeof a.edge.chance === 'number' ? { chance: a.edge.chance } : undefined]
      .filter((c): c is Cond => c !== undefined);
    const g = parts.length === 0 ? undefined : parts.length === 1 ? parts[0] : { all: parts };
    guards.set(a, g);
    if (hasUntypedAtom(g, graph.definitions)) untyped.add(a.edge.id);
    walkCond(g, history, graph.definitions);
  }

  const lineages = new Map<string, string[]>();
  const lineage = (id: string): readonly string[] => {
    let l = lineages.get(id);
    if (!l) {
      l = [id];
      for (let p = topo.parentOf.get(id); p !== undefined; p = topo.parentOf.get(p)) l.push(p);
      lineages.set(id, l);
    }
    return l;
  };
  /** Is walk id `to` the container `x` itself or anything inside it? */
  const within = (to: string, x: string): boolean => lineage(displayId(to)).includes(x);

  const sites = new Map<string, Site>();
  const site = (pos: string): Site => {
    const hit = sites.get(pos);
    if (hit) return hit;
    const display = displayId(pos);
    const real = display === pos;
    const node = topo.nodeById.get(display);
    const arcs = topo.arcsFrom.get(pos) ?? [];
    const authored = arcs.filter((a) => a.edge);
    let fallback = arcs.filter((a) => !a.edge).map((a) => a.to);
    if (real && topo.children.has(pos)) {
      const entries = fallback.filter((to) => to !== exitId(pos));
      fallback = entries.length > 0 ? entries : fallback;
    }
    const choice = real && node?.kind === 'choice';
    const gate = node?.kind === 'gate';
    // A "last line": every authored way on leaves the enclosing container X. X's own continuation
    // (an authored edge leaving X) is then one more way on (see the header).
    let exit: string | undefined;
    const x = real && topo.children.has(pos) ? undefined : topo.parentOf.get(display);
    if (x !== undefined && !gate && authored.length > 0 && authored.every((a) => !within(a.to, x))) {
      if ((topo.arcsFrom.get(exitId(x)) ?? []).some((a) => a.edge)) exit = exitId(x);
    }
    const arcGuards = authored.map((a) => guards.get(a));
    const optionKeys: string[] = [];
    const byKey: number[][] = [];
    if (choice) {
      authored.forEach((a, i) => {
        const key = a.edge!.optionId ?? a.edge!.id;
        let k = optionKeys.indexOf(key);
        if (k < 0) {
          k = optionKeys.push(key) - 1;
          byKey.push([]);
        }
        byKey[k].push(i);
      });
    }
    const s: Site = {
      node,
      display,
      real,
      line: real && index.has(pos) ? Int32Array.from(lineage(pos), (id) => index.get(id)!) : new Int32Array(0),
      choice,
      gate,
      ending: real && isEnding(pos),
      authored,
      guards: arcGuards,
      free: arcGuards.every((g) => g === undefined),
      fallback,
      exit,
      optionKeys,
      byKey,
    };
    sites.set(pos, s);
    return s;
  };

  return {
    graph, topo, ids, vars, declared: new Set(vars.keys()), setVars, endingByNode,
    untypedEdges: [...untyped].sort(), needsHistory, site, lineage,
  };
}
