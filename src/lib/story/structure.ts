/**
 * The graph-shape half of the structural pass (§8): is the document a graph at all
 * (`DANGLING_EDGE`, `DUPLICATE_ID`, `CONTAINMENT_CYCLE`), and what do the forward and backward
 * walks prove (`ORPHAN_NODE`, `ENDING_UNREACHABLE`, `NO_ENDING_REACHABLE`, `UNDECLARED_TERMINAL`).
 *
 * Split out of `validate.ts` to keep each file small; it also owns the finding constructor and the
 * severity table every structural module shares. Pure: no clock, no I/O.
 */

import type { StoryFinding, StoryFindingCode, StoryGraph } from '@/lib/story/types';
import { isCoReached, isReached, type StoryTopology } from '@/lib/story/reachability';

/** One severity per code, so a code never means two things. */
export const STRUCTURAL_SEVERITY: Readonly<Partial<Record<StoryFindingCode, StoryFinding['severity']>>> = {
  DANGLING_EDGE: 'error',
  DUPLICATE_ID: 'error',
  CONTAINMENT_CYCLE: 'error',
  ORPHAN_NODE: 'warn',
  ENDING_UNREACHABLE: 'error',
  NO_ENDING_REACHABLE: 'error',
  UNDECLARED_TERMINAL: 'warn',
  VAR_UNDECLARED: 'error',
  VAR_NO_REACHING_WRITE: 'error',
  VAR_DOMAIN_VIOLATION: 'error',
  VAR_WRITER_NOT_OWNER: 'warn',
  VAR_SINGLETON: 'warn',
  FALSE_CHOICE: 'warn',
  TEXT_BUDGET_EXCEEDED: 'warn',
  UNTYPED_CONDITION: 'warn',
};

/** Every structural finding is built here: altitude fixed, never a `lead`. */
export function structural(
  code: StoryFindingCode,
  nodes: readonly string[],
  detail: string,
  extra: { variables?: readonly string[]; path?: readonly string[] } = {},
): StoryFinding {
  const f: StoryFinding = { code, altitude: 'structural', severity: STRUCTURAL_SEVERITY[code] ?? 'warn', nodes, detail };
  if (extra.variables) f.variables = extra.variables;
  if (extra.path) f.path = extra.path;
  return f;
}

/* ---------------------------------------------------------------- containment */

export interface Containment {
  /** Acyclic: members of a cycle are cut loose to the top level. */
  parentOf: Map<string, string>;
  cycles: string[][];
  /** `node.parent` naming a node that does not exist. */
  danglingParents: { node: string; parent: string }[];
}

/** `node.parent` wins; a `contains` edge supplies the parent of a node that declares none (§5). */
export function resolveContainment(graph: StoryGraph, ids: ReadonlySet<string>): Containment {
  const parentOf = new Map<string, string>();
  const danglingParents: Containment['danglingParents'] = [];
  for (const n of graph.nodes) {
    if (n.parent === undefined || parentOf.has(n.id)) continue;
    if (ids.has(n.parent)) parentOf.set(n.id, n.parent);
    else danglingParents.push({ node: n.id, parent: n.parent });
  }
  const declared = new Set(graph.nodes.filter((n) => n.parent !== undefined).map((n) => n.id));
  for (const e of graph.edges) {
    if (e.kind !== 'contains' || declared.has(e.to) || parentOf.has(e.to)) continue;
    if (ids.has(e.from) && ids.has(e.to)) parentOf.set(e.to, e.from);
  }
  // Each node has at most one parent, so cycles are found by walking up with three colours.
  const cycles: string[][] = [];
  const state = new Map<string, 1 | 2>();
  for (const start of parentOf.keys()) {
    const chain: string[] = [];
    let at: string | undefined = start;
    while (at !== undefined && !state.has(at)) {
      state.set(at, 1);
      chain.push(at);
      at = parentOf.get(at);
    }
    if (at !== undefined && state.get(at) === 1) cycles.push(chain.slice(chain.indexOf(at)));
    for (const c of chain) state.set(c, 2);
  }
  for (const cycle of cycles) for (const id of cycle) parentOf.delete(id);
  return { parentOf, cycles, danglingParents };
}

/* ------------------------------------------------------------- "is it a graph at all" */

function duplicates(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const v of values) (seen.has(v) ? dup : seen).add(v);
  return [...dup];
}

export function integrityFindings(graph: StoryGraph, ids: ReadonlySet<string>, containment: Containment): StoryFinding[] {
  const out: StoryFinding[] = [];
  for (const id of duplicates(graph.nodes.map((n) => n.id))) {
    out.push(structural('DUPLICATE_ID', [id], `node id "${id}" is declared more than once`));
  }
  const edgeById = new Map(graph.edges.map((e) => [e.id, e]));
  for (const id of duplicates(graph.edges.map((e) => e.id))) {
    const e = edgeById.get(id)!;
    out.push(structural('DUPLICATE_ID', [e.from, e.to].filter((n) => ids.has(n)), `edge id "${id}" is declared more than once`));
  }
  for (const name of duplicates(graph.variables.map((v) => v.name))) {
    out.push(structural('DUPLICATE_ID', [], `variable "${name}" is declared more than once`, { variables: [name] }));
  }

  for (const e of graph.edges) {
    const missing = [e.from, e.to].filter((n) => !ids.has(n));
    if (missing.length === 0) continue;
    const present = [e.from, e.to].filter((n) => ids.has(n));
    out.push(structural('DANGLING_EDGE', [...new Set(present)], `edge ${e.id} (${e.kind}) ${e.from} -> ${e.to} names missing node ${missing.join(', ')}`));
  }
  // References outside `edges` that name a node are dangling the same way.
  for (const id of graph.entries) {
    if (!ids.has(id)) out.push(structural('DANGLING_EDGE', [], `entries[] names missing node ${id}`));
  }
  for (const e of graph.endings) {
    if (!ids.has(e.node)) out.push(structural('DANGLING_EDGE', [], `endings[] names missing node ${e.node}`));
  }
  for (const d of containment.danglingParents) {
    out.push(structural('DANGLING_EDGE', [d.node], `node ${d.node} names missing parent ${d.parent}`));
  }

  for (const cycle of containment.cycles) {
    out.push(structural('CONTAINMENT_CYCLE', [...cycle].sort(), `containment cycle: ${cycle.join(' -> ')} -> ${cycle[0]}`));
  }
  return out;
}

/* -------------------------------------------------------------- what the walks prove */

/** Group flagged nodes into regions joined by traversal edges or containment between them. */
function regions(flagged: readonly string[], topo: StoryTopology): string[][] {
  const set = new Set(flagged);
  const up = new Map<string, string>(flagged.map((id) => [id, id]));
  const find = (x: string): string => {
    let r = x;
    while (up.get(r) !== r) r = up.get(r)!;
    up.set(x, r);
    return r;
  };
  const join = (a: string, b: string) => up.set(find(a), find(b));
  for (const id of flagged) {
    for (const e of topo.outEdges.get(id) ?? []) if (set.has(e.to)) join(id, e.to);
    const p = topo.parentOf.get(id);
    if (p !== undefined && set.has(p)) join(id, p);
  }
  const groups = new Map<string, string[]>();
  for (const id of flagged) {
    const r = find(id);
    const g = groups.get(r);
    if (g) g.push(id);
    else groups.set(r, [id]);
  }
  return [...groups.values()].map((g) => g.sort());
}

const hasExitAbove = (topo: StoryTopology, id: string): boolean => {
  for (let p = topo.parentOf.get(id); p !== undefined; p = topo.parentOf.get(p)) if (topo.exits.has(p)) return true;
  return false;
};

export function reachFindings(graph: StoryGraph, topo: StoryTopology): StoryFinding[] {
  const out: StoryFinding[] = [];
  const declaredEndings = new Set(graph.endings.map((e) => e.node));
  const nodes = [...topo.nodeById.values()].filter((n) => !topo.excluded.has(n.id));
  const isContainer = (id: string) => topo.children.has(id);

  const orphans = nodes.filter((n) => !declaredEndings.has(n.id) && !isReached(topo, n.id)).map((n) => n.id);
  for (const r of regions(orphans, topo)) {
    out.push(structural('ORPHAN_NODE', r, `${r.length === 1 ? r[0] : `${r.length} nodes (${r[0]}, ...)`} not reachable forward from any declared entry`));
  }

  for (const id of declaredEndings) {
    if (!topo.nodeById.has(id) || topo.excluded.has(id) || isReached(topo, id)) continue;
    out.push(structural('ENDING_UNREACHABLE', [id], `declared ending ${id} has no backward path to any entry`));
  }

  // Set difference: nodes with no way on (no traversal edge out, none from an enclosing container)
  // minus the declared endings. Containers continue through their children; templates are excluded.
  const terminals = new Set(
    nodes
      .filter((n) => !isContainer(n.id) && !declaredEndings.has(n.id))
      .filter((n) => !topo.outEdges.has(n.id) && !hasExitAbove(topo, n.id))
      .map((n) => n.id),
  );
  for (const id of terminals) {
    out.push(structural('UNDECLARED_TERMINAL', [id], `${id} has no outgoing traversal edge and is not in endings[]`));
  }

  // Co-reachability over reached nodes. Each dead node carries ONE code: an undeclared terminal is
  // already that finding, so the region report covers the dead nodes that still have a way on.
  const dead = nodes
    .filter((n) => !isContainer(n.id) && !terminals.has(n.id) && isReached(topo, n.id) && !isCoReached(topo, n.id))
    .map((n) => n.id);
  for (const r of regions(dead, topo)) {
    out.push(structural('NO_ENDING_REACHABLE', r, `${r.join(', ')}: reachable from an entry, but no ending is reachable from ${r.length === 1 ? 'it' : 'them'}`));
  }
  return out;
}
