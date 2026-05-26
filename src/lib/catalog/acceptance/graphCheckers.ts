import type { Checker } from './types';

export interface GraphNode { id: string; label?: string; terminal?: boolean }
export interface GraphEdge { from: string; to: string; label?: string }
export interface GraphData { nodes?: GraphNode[]; edges?: GraphEdge[] }

/** L0 structural validation of a node/edge graph: edges reference real nodes, every node is
 *  reachable from the first node, and at least one node is terminal. Dangling edge / unreachable
 *  node → fail; missing terminal → pending; empty → pending. */
export function graphValid(field: string, label: string): Checker {
  return (data) => {
    const g = (data[field] ?? {}) as GraphData;
    const nodes = g.nodes ?? [];
    const edges = g.edges ?? [];
    if (!nodes.length) return { label, tier: 'L0', status: 'pending', detail: 'no graph' };
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
  };
}
