/**
 * Storygraph reachability — the pure graph core of the structural pass (§8).
 *
 * `buildAdjacency` and `bfs` are LIFTED from `src/lib/state-machine-validator.ts` (the forward and
 * backward passes there); that file is untouched. Two changes, both behaviour-preserving for a
 * single start: `bfs` takes several starts (a storygraph has several entries and several endings),
 * and it dequeues with a head index instead of `Array.shift()`, which is O(n) per call and turns a
 * 10k-node walk quadratic. The visit set is identical.
 *
 * `buildStoryTopology` turns a document into the graph a reader actually walks:
 *   - Only `then` / `option` / `gate` edges are traversal. `contains` and `influences` are NOT, and
 *     an edge of an unknown kind is not assumed to be either — it is left out (loud: whatever it
 *     was meant to connect then shows up as unreachable, never silently connected).
 *   - Containment (§4, "a collapsed container is one node") becomes two arcs per container X:
 *     an ENTER node (X's own id: an edge into X lands here and reaches X's entry children — the
 *     children no sibling inside X points at) and an EXIT node (`exitId(X)`: every child, and X
 *     itself, reaches it; X's own outgoing edges leave from it — except an edge from X to something
 *     inside X, which is an entry). Being anywhere inside X is being
 *     in X, so X's continuation is open from every child. Over-approximate on purpose, like every
 *     structural claim: guards are ignored too.
 *   - `template` nodes and everything inside them are excluded from every walk (§4).
 * Pure: no clock, no I/O, no module state.
 */

import type { StoryEdge, StoryGraph, StoryNode } from '@/lib/story/types';

/* ------------------------------------------------- lifted from state-machine-validator.ts */

export interface Transition {
  from: string;
  to: string;
}

export function buildAdjacency<T extends Transition>(transitions: readonly T[]): {
  forward: Map<string, string[]>;
  backward: Map<string, string[]>;
} {
  const forward = new Map<string, string[]>();
  const backward = new Map<string, string[]>();
  for (const t of transitions) {
    if (!forward.has(t.from)) forward.set(t.from, []);
    forward.get(t.from)!.push(t.to);
    if (!backward.has(t.to)) backward.set(t.to, []);
    backward.get(t.to)!.push(t.from);
  }
  return { forward, backward };
}

export function bfs(starts: Iterable<string>, adj: ReadonlyMap<string, readonly string[]>): Set<string> {
  const visited = new Set<string>(starts);
  const queue = [...visited];
  for (let head = 0; head < queue.length; head++) {
    const neighbors = adj.get(queue[head]) ?? [];
    for (const n of neighbors) {
      if (!visited.has(n)) {
        visited.add(n);
        queue.push(n);
      }
    }
  }
  return visited;
}

/** Forward pass: everything reachable from `roots` over `transitions`. */
export function forwardReachable(roots: Iterable<string>, transitions: readonly Transition[]): Set<string> {
  return bfs(roots, buildAdjacency(transitions).forward);
}

/** Backward pass: everything from which some node in `targets` is reachable. */
export function coReachable(targets: Iterable<string>, transitions: readonly Transition[]): Set<string> {
  return bfs(targets, buildAdjacency(transitions).backward);
}

/* ---------------------------------------------------------------- storygraph topology */

export const TRAVERSAL_EDGE_KINDS: ReadonlySet<string> = new Set(['then', 'option', 'gate']);
export const isTraversalKind = (kind: string): boolean => TRAVERSAL_EDGE_KINDS.has(kind);

const EXIT = '\u0000exit\u0000';
/** The exit node of a container. The NUL prefix cannot occur in a parsed id that means anything. */
export const exitId = (containerId: string): string => EXIT + containerId;
/** A walk id rendered for a person: an exit node reads as its container. */
export const displayId = (walkId: string): string => (walkId.startsWith(EXIT) ? walkId.slice(EXIT.length) : walkId);

/** One walkable arc. `edge` is the authored edge it came from; absent for a containment arc. */
export interface StoryArc extends Transition {
  edge?: StoryEdge;
}

export interface StoryTopology {
  /** First record per id; a duplicate id is reported elsewhere and never walked twice. */
  nodeById: ReadonlyMap<string, StoryNode>;
  /** Acyclic parent map: cycle members are cut loose to the top level. */
  parentOf: ReadonlyMap<string, string>;
  children: ReadonlyMap<string, readonly string[]>;
  /** Templates and their descendants. */
  excluded: ReadonlySet<string>;
  /** Containers (nodes with at least one child) that have an outgoing traversal edge. */
  exits: ReadonlySet<string>;
  /** Valid traversal edges (both ends exist) by source node id. */
  outEdges: ReadonlyMap<string, readonly StoryEdge[]>;
  arcs: readonly StoryArc[];
  arcsFrom: ReadonlyMap<string, readonly StoryArc[]>;
  roots: readonly string[];
  /** Co-reachability targets: declared endings plus every node of kind `ending`. */
  targets: ReadonlySet<string>;
  reached: ReadonlySet<string>;
  coReached: ReadonlySet<string>;
}

/** Is a real node reached? A container counts when it was entered or anything inside it was. */
export const isReached = (t: StoryTopology, id: string): boolean => t.reached.has(id) || t.reached.has(exitId(id));
export const isCoReached = (t: StoryTopology, id: string): boolean => t.coReached.has(id) || t.coReached.has(exitId(id));

export function buildStoryTopology(graph: StoryGraph, parentOf: ReadonlyMap<string, string>): StoryTopology {
  const nodeById = new Map<string, StoryNode>();
  for (const n of graph.nodes) if (!nodeById.has(n.id)) nodeById.set(n.id, n);

  const children = new Map<string, string[]>();
  for (const [child, parent] of parentOf) {
    const list = children.get(parent);
    if (list) list.push(child);
    else children.set(parent, [child]);
  }
  const isContainer = (id: string) => children.has(id);
  const isInside = (id: string, container: string) => {
    for (let p = parentOf.get(id); p !== undefined; p = parentOf.get(p)) if (p === container) return true;
    return false;
  };

  const excluded = new Set<string>();
  const stack = graph.nodes.filter((n) => n.kind === 'template').map((n) => n.id);
  while (stack.length) {
    const id = stack.pop()!;
    if (excluded.has(id)) continue;
    excluded.add(id);
    for (const c of children.get(id) ?? []) stack.push(c);
  }

  const outEdges = new Map<string, StoryEdge[]>();
  const siblingFed = new Set<string>();
  const arcs: StoryArc[] = [];
  const exits = new Set<string>();
  for (const e of graph.edges) {
    if (!isTraversalKind(e.kind) || !nodeById.has(e.from) || !nodeById.has(e.to)) continue;
    const list = outEdges.get(e.from);
    if (list) list.push(e);
    else outEdges.set(e.from, [e]);
    const p = parentOf.get(e.from);
    if (p !== undefined && parentOf.get(e.to) === p) siblingFed.add(e.to);
    if (excluded.has(e.from) || excluded.has(e.to)) continue;
    // An edge from a container to something inside it enters it; any other leaves through its exit.
    const leaves = isContainer(e.from) && !isInside(e.to, e.from);
    if (leaves) exits.add(e.from);
    arcs.push({ from: leaves ? exitId(e.from) : e.from, to: e.to, edge: e });
  }
  for (const [x, kids] of children) {
    if (excluded.has(x)) continue;
    arcs.push({ from: x, to: exitId(x) });
    for (const c of kids) {
      if (excluded.has(c)) continue;
      arcs.push({ from: isContainer(c) ? exitId(c) : c, to: exitId(x) });
      if (!siblingFed.has(c)) arcs.push({ from: x, to: c });
    }
  }

  const arcsFrom = new Map<string, StoryArc[]>();
  for (const a of arcs) {
    const list = arcsFrom.get(a.from);
    if (list) list.push(a);
    else arcsFrom.set(a.from, [a]);
  }

  const rootSet = new Set<string>();
  for (const id of graph.entries) if (nodeById.has(id) && !excluded.has(id)) rootSet.add(id);
  for (const n of nodeById.values()) if (n.kind === 'entry' && !excluded.has(n.id)) rootSet.add(n.id);
  const targets = new Set<string>();
  for (const e of graph.endings) if (nodeById.has(e.node) && !excluded.has(e.node)) targets.add(e.node);
  for (const n of nodeById.values()) if (n.kind === 'ending' && !excluded.has(n.id)) targets.add(n.id);

  const { forward, backward } = buildAdjacency(arcs);
  const roots = [...rootSet];
  return {
    nodeById,
    parentOf,
    children,
    excluded,
    exits,
    outEdges,
    arcs,
    arcsFrom,
    roots,
    targets,
    reached: bfs(roots, forward),
    coReached: bfs(targets, backward),
  };
}

/**
 * Breadth-first search tree from the roots over the arcs `allow` admits, returned as a parent map.
 * Used for witness paths: the shortest admitted path to a node is read back with {@link pathTo}.
 */
export function bfsTree(
  roots: readonly string[],
  arcsFrom: ReadonlyMap<string, readonly StoryArc[]>,
  allow: (arc: StoryArc) => boolean,
): Map<string, string | null> {
  const parent = new Map<string, string | null>();
  for (const r of roots) if (!parent.has(r)) parent.set(r, null);
  const queue = [...parent.keys()];
  for (let head = 0; head < queue.length; head++) {
    const at = queue[head];
    for (const a of arcsFrom.get(at) ?? []) {
      if (parent.has(a.to) || !allow(a)) continue;
      parent.set(a.to, at);
      queue.push(a.to);
    }
  }
  return parent;
}

/** The path from a root to `id` in a {@link bfsTree}, exits rendered as their container. */
export function pathTo(tree: ReadonlyMap<string, string | null>, id: string): string[] {
  const rev: string[] = [];
  for (let at: string | null | undefined = id; at != null; at = tree.get(at)) rev.push(displayId(at));
  const path = rev.reverse();
  return path.filter((p, i) => i === 0 || p !== path[i - 1]);
}
