/**
 * INFLUENCES_UNSUPPORTED (§5, wave 5): a declared `influences` edge X -> Y asserts "what X writes
 * is read by Y's guard". A reader MUST report one the data does not support.
 *
 *   WRITTEN BY X — `writes[].var` on every traversal edge whose `from` is X or a descendant of X
 *                  (a container owns the writes made inside it; §5 ratified: a write is made by
 *                  its source node or an enclosing container).
 *   READ BY Y    — the variables a `when` reads (definitions resolved through `ref`) on every edge
 *                  out of Y or a descendant of Y, and on every `endings[]` entry whose node is Y or
 *                  a descendant of Y. Node `options` carry no guards in this schema, so option
 *                  guards are the `when` of the option edges, already counted.
 *
 * SUPPORTED iff the two sets intersect. One `warn` per unsupported edge, `nodes: [X, Y]`. An edge
 * with a missing endpoint is DANGLING_EDGE already and is skipped. `influences` stays
 * non-traversal: nothing here walks it. Pure: no clock, no I/O.
 */

import type { Cond, StoryFinding, StoryGraph } from '@/lib/story/types';
import { isTraversalKind, type StoryTopology } from '@/lib/story/reachability';
import { walkCond } from '@/lib/story/variables';
import { structural } from '@/lib/story/structure';

const SHOWN = 6;

/** `{a, b, c, +4 more}`, sorted; `{}` when empty. */
function named(set: ReadonlySet<string> | undefined): string {
  const all = [...(set ?? [])].sort();
  const head = all.slice(0, SHOWN).join(', ');
  return `{${head}${all.length > SHOWN ? `, +${all.length - SHOWN} more` : ''}}`;
}

export function influencesFindings(graph: StoryGraph, topo: StoryTopology): StoryFinding[] {
  const declared = graph.edges.filter((e) => e.kind === 'influences' && topo.nodeById.has(e.from) && topo.nodeById.has(e.to));
  if (declared.length === 0) return [];

  // Credit a variable to a node and every container above it.
  const credit = (into: Map<string, Set<string>>, node: string, name: string) => {
    for (let at: string | undefined = node; at !== undefined; at = topo.parentOf.get(at)) {
      const s = into.get(at);
      if (s) {
        if (s.has(name)) break; // ancestors already credited by an earlier walk up
        s.add(name);
      } else into.set(at, new Set([name]));
    }
  };
  const written = new Map<string, Set<string>>();
  const read = new Map<string, Set<string>>();
  const reads = (cond: Cond | undefined, node: string) =>
    walkCond(cond, (atom) => { if ('var' in atom && typeof atom.var === 'string') credit(read, node, atom.var); }, graph.definitions);

  for (const e of graph.edges) {
    reads(e.when, e.from);
    if (!isTraversalKind(e.kind)) continue;
    for (const w of e.writes ?? []) credit(written, e.from, w.var);
  }
  for (const end of graph.endings) reads(end.when, end.node);

  const out: StoryFinding[] = [];
  for (const e of declared) {
    const w = written.get(e.from);
    const r = read.get(e.to);
    if (w && r && [...w].some((name) => r.has(name))) continue;
    out.push(structural(
      'INFLUENCES_UNSUPPORTED',
      e.from === e.to ? [e.from] : [e.from, e.to],
      `influences edge ${e.id} (${e.from} -> ${e.to}) is not supported by the data: ${e.from} writes ${named(w)}, ${e.to}'s guards read ${named(r)}; no variable in common`,
    ));
  }
  return out;
}
