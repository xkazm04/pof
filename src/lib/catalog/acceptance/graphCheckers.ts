import type { Checker } from './types';
import { tagRequiredFields } from './requiredFields';

export interface GraphNode { id: string; label?: string; terminal?: boolean }
export interface GraphEdge { from: string; to: string; label?: string }
export interface GraphData { nodes?: GraphNode[]; edges?: GraphEdge[] }

/** L0 structural validation of a node/edge graph: edges reference real nodes, every node is
 *  reachable from the first node, and at least one node is terminal. Dangling edge / unreachable
 *  node → fail; missing terminal → pending; empty → pending. */
export function graphValid(field: string, label: string): Checker {
  // Tagged so the produce prompt NAMES the graph field and its shape (/diablo W22: all 21 codex Cross-References were written
  // under 'crossReferences' because the prompt listed only wiringContract, and graded "no nodes").
  return tagRequiredFields((data) => {
    const g = (data[field] ?? {}) as GraphData;
    const nodes = g.nodes ?? [];
    const edges = g.edges ?? [];
    if (!nodes.length) return { label, tier: 'L0', status: 'pending', detail: 'no graph', reason: `field "${field}" has no nodes — produce a node/edge graph` };
    const ids = new Set(nodes.map((n) => n.id));
    const bad = edges.find((e) => !ids.has(e.from) || !ids.has(e.to));
    if (bad) return { label, tier: 'L0', status: 'fail', detail: 'dangling edge', reason: `edge ${bad.from}→${bad.to} references a missing node` };
    const adj = new Map<string, string[]>();
    for (const e of edges) { const a = adj.get(e.from) ?? []; a.push(e.to); adj.set(e.from, a); }
    const start = nodes[0].id;
    const seen = new Set<string>([start]);
    const stack = [start];
    while (stack.length) { const n = stack.pop()!; for (const m of adj.get(n) ?? []) if (!seen.has(m)) { seen.add(m); stack.push(m); } }
    const unreachable = nodes.filter((n) => !seen.has(n.id));
    if (unreachable.length) return { label, tier: 'L0', status: 'fail', detail: `${unreachable.length} unreachable`, reason: `unreachable from start: ${unreachable.map((n) => n.id).join(', ')}` };
    if (!nodes.some((n) => n.terminal)) return { label, tier: 'L0', status: 'pending', detail: 'no terminal node', reason: 'mark at least one node terminal' };
    return { label, tier: 'L0', status: 'pass', detail: `${nodes.length} nodes · ${edges.length} edges · reachable` };
  }, { field, shape: 'a node/edge graph { nodes: [{ id, label, terminal? }], edges: [{ from, to, label? }] } — every node reachable from the FIRST node, at least one node terminal: true' });
}

/**
 * Nodes written as `<catalog>::<id>` are CLAIMS that an entity exists (/diablo W22: 21 Diablo lore graphs passed while naming
 * factions::horadrim and locations::high-heavens — an entity that does not exist and a catalog that does not exist). A node in a
 * catalog PoF does not have fails; a node naming a missing entity defers, like a declared link (the target may be authored
 * later). Plain nodes without `::` are concepts and are not checked. No context (a rollup path) → not graded here.
 */
export function graphNodesResolve(field: string, label: string, knownCatalogs: () => ReadonlySet<string>): Checker {
  return tagRequiredFields((data, ctx) => {
    const nodes = ((data[field] ?? {}) as GraphData).nodes ?? [];
    const refs = nodes.map((n) => /^([a-z0-9-]+)::(.+)$/.exec(n.id)).filter((m): m is RegExpExecArray => !!m);
    if (!refs.length) return { label, tier: 'L2', status: 'pass', detail: 'no catalog nodes' };
    const catalogs = knownCatalogs();
    const foreign = refs.filter((m) => !catalogs.has(m[1]));
    if (foreign.length) {
      return { label, tier: 'L2', status: 'fail', detail: `${foreign.length} node(s) in no catalog`, reason: `graph nodes name catalogs PoF does not have: ${foreign.map((m) => m[0]).join(', ')} — use a registered catalog id, or write the node as a plain concept (no "::")` };
    }
    if (!ctx) return { label, tier: 'L2', status: 'pass', detail: `${refs.length} catalog node(s) — resolution needs catalog context` };
    const missing = refs.filter((m) => !ctx.has(m[1], m[2]));
    return missing.length
      ? { label, tier: 'L2', status: 'deferred', detail: `${refs.length - missing.length}/${refs.length} resolve`, reason: `graph nodes name entities that do not exist: ${missing.map((m) => m[0]).join(', ')} — seed them, or write them as plain concepts (no "::")` }
      : { label, tier: 'L2', status: 'pass', detail: `${refs.length}/${refs.length} catalog nodes resolve` };
  }, { field, shape: 'a node id written "<catalog>::<entity id>" must name a REAL entity of a registered PoF catalog (it is checked); anything else — a place, a faction, an idea the entity only mentions — is a plain node id without "::"' });
}
