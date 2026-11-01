/**
 * The §4 / §5 / §6 MUSTs that had no finding code until the wave-4 amendment pass:
 *
 *   UNKNOWN_KIND             (§4) a node or edge `kind` outside the closed core set. `info`: the
 *                            document is kept and read; the finding is the report §4 obliges.
 *   GATE_WITHOUT_CONDITION   (§4, §5) a `gate` edge, or a traversal edge out of a `gate` node,
 *                            that carries no `when`. One finding per offending edge.
 *   PARENT_CONTAINS_MISMATCH (§5) `contains` mirrors `node.parent`; where both forms name a
 *                            child's parent they must agree.
 *   PRECEDENCE_NOT_TOTAL     (§6) where endings declare `precedence` it must be a total order:
 *                            a tie is `error`; some endings declaring it and others not is `warn`.
 *
 * Split out of `structure.ts` to keep each file small. Pure: no clock, no I/O.
 */

import type { StoryFinding, StoryGraph, StoryNode } from '@/lib/story/types';
import { CORE_EDGE_KINDS, CORE_NODE_KINDS } from '@/lib/story/schema';
import { isTraversalKind } from '@/lib/story/reachability';
import { structural } from '@/lib/story/structure';

const NODE_KINDS: ReadonlySet<string> = new Set(CORE_NODE_KINDS);
const EDGE_KINDS: ReadonlySet<string> = new Set(CORE_EDGE_KINDS);

/** UNKNOWN_KIND — one per node and one per edge, saying how each is treated by the walks. */
export function unknownKindFindings(graph: StoryGraph, ids: ReadonlySet<string>): StoryFinding[] {
  const out: StoryFinding[] = [];
  for (const n of graph.nodes) {
    if (NODE_KINDS.has(n.kind)) continue;
    out.push(structural('UNKNOWN_KIND', [n.id], `node ${n.id} has unknown kind "${n.kind}": kept and walked as an ordinary node`));
  }
  for (const e of graph.edges) {
    if (EDGE_KINDS.has(e.kind)) continue;
    const ends = [...new Set([e.from, e.to].filter((id) => ids.has(id)))];
    out.push(structural('UNKNOWN_KIND', ends, `edge ${e.id} (${e.from} -> ${e.to}) has unknown kind "${e.kind}": kept but NOT walked, so a node reached only through it reads as unreachable`));
  }
  return out;
}

/** GATE_WITHOUT_CONDITION — per edge; `contains` / `influences` / unknown kinds are not branches. */
export function gateFindings(graph: StoryGraph, nodeById: ReadonlyMap<string, StoryNode>): StoryFinding[] {
  const out: StoryFinding[] = [];
  for (const e of graph.edges) {
    if (e.when !== undefined && e.when !== null) continue;
    const gateEdge = e.kind === 'gate';
    const fromGate = nodeById.get(e.from)?.kind === 'gate' && isTraversalKind(e.kind);
    if (!gateEdge && !fromGate) continue;
    const why = gateEdge ? `gate edge ${e.id}` : `${e.kind} edge ${e.id} out of gate node ${e.from}`;
    out.push(structural('GATE_WITHOUT_CONDITION', nodeById.has(e.from) ? [e.from] : [], `${why} (${e.from} -> ${e.to}) carries no \`when\``));
  }
  return out;
}

/**
 * PARENT_CONTAINS_MISMATCH — per child. A child named by only one form is fine. Compared: the
 * declared `parent` (when it exists; a missing one is DANGLING_EDGE) against every `contains` edge
 * into the child whose ends both exist; and, with no declared parent, `contains` edges from two
 * different parents (a node has at most one parent, so they cannot both mirror it).
 */
export function containsFindings(graph: StoryGraph, nodeById: ReadonlyMap<string, StoryNode>): StoryFinding[] {
  const viaEdges = new Map<string, Set<string>>();
  for (const e of graph.edges) {
    if (e.kind !== 'contains' || !nodeById.has(e.from) || !nodeById.has(e.to)) continue;
    viaEdges.set(e.to, (viaEdges.get(e.to) ?? new Set<string>()).add(e.from));
  }
  const out: StoryFinding[] = [];
  for (const [child, parents] of viaEdges) {
    const declared = nodeById.get(child)!.parent;
    if (declared !== undefined) {
      if (!nodeById.has(declared)) continue;
      const others = [...parents].filter((p) => p !== declared).sort();
      if (others.length === 0) continue;
      out.push(structural('PARENT_CONTAINS_MISMATCH', [child, declared, ...others], `${child} declares parent ${declared} but a contains edge places it in ${others.join(', ')}`));
    } else if (parents.size > 1) {
      const all = [...parents].sort();
      out.push(structural('PARENT_CONTAINS_MISMATCH', [child, ...all], `${child} declares no parent and contains edges place it in ${all.length} parents (${all.join(', ')})`));
    }
  }
  return out;
}

/** PRECEDENCE_NOT_TOTAL — lower number wins (ratified); one entry per ending node. */
export function precedenceFindings(graph: StoryGraph): StoryFinding[] {
  const first = new Map<string, number | undefined>();
  for (const e of graph.endings) if (!first.has(e.node)) first.set(e.node, e.precedence);
  const declaring = [...first].filter(([, p]) => p !== undefined) as [string, number][];
  if (declaring.length === 0) return [];
  const out: StoryFinding[] = [];
  const byValue = new Map<number, string[]>();
  for (const [node, p] of declaring) byValue.set(p, [...(byValue.get(p) ?? []), node]);
  for (const [p, nodes] of byValue) {
    if (nodes.length < 2) continue;
    out.push(structural('PRECEDENCE_NOT_TOTAL', [...nodes].sort(), `endings ${[...nodes].sort().join(', ')} tie at precedence ${p}: not a total order`));
  }
  const silent = [...first].filter(([, p]) => p === undefined).map(([n]) => n).sort();
  if (silent.length > 0) {
    out.push(structural('PRECEDENCE_NOT_TOTAL', silent, `${declaring.length} ending(s) declare precedence but ${silent.join(', ')} do${silent.length === 1 ? 'es' : ''} not: their order is undefined`, { severity: 'warn' }));
  }
  return out;
}
