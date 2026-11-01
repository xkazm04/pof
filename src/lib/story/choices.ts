/**
 * `FALSE_CHOICE` (§5, §8): two options of one choice whose `(sorted writes, target)` pairs are
 * identical. Convergence is craft — two options with DIFFERENT writes landing on the same node is
 * honest and never flagged; an identical rejoin means the branch was decoration.
 *
 * An option is identified by its `optionId` (an edge without one stands as its own option); an
 * option wired by several edges is compared as the sorted set of its edges' pairs. Guards are not
 * part of the pair: the standard compares what an option DOES, not when it is offered.
 * Pure: no clock, no I/O.
 */

import type { StoryEdge, StoryFinding, StoryGraph, StoryWrite } from '@/lib/story/types';
import { canonicalize } from '@/lib/story/canonical';
import { structural } from '@/lib/story/structure';

function stable(value: unknown): string {
  try {
    return canonicalize(value);
  } catch {
    return String(value);
  }
}

const writeKey = (w: StoryWrite): string => stable([w.var, w.op, w.value ?? null]);

/** The `(sorted writes, target)` pair of one edge, as a comparable string. */
export function optionPair(e: StoryEdge): string {
  const writes = (e.writes ?? []).map(writeKey).sort();
  return `${writes.join('|')}=>${e.to}`;
}

export function choiceFindings(graph: StoryGraph): StoryFinding[] {
  const byChoice = new Map<string, Map<string, StoryEdge[]>>();
  for (const e of graph.edges) {
    if (e.kind !== 'option') continue;
    const options = byChoice.get(e.from) ?? new Map<string, StoryEdge[]>();
    const key = e.optionId ?? `#${e.id}`;
    options.set(key, [...(options.get(key) ?? []), e]);
    byChoice.set(e.from, options);
  }

  const out: StoryFinding[] = [];
  for (const [choice, options] of byChoice) {
    if (options.size < 2) continue;
    const bySignature = new Map<string, string[]>();
    for (const [optionId, edges] of options) {
      const signature = edges.map(optionPair).sort().join(' & ');
      bySignature.set(signature, [...(bySignature.get(signature) ?? []), optionId]);
    }
    const same = [...bySignature.values()].filter((ids) => ids.length > 1);
    if (same.length === 0) continue;
    const groups = same.map((ids) => ids.join(' = ')).join('; ');
    out.push(structural('FALSE_CHOICE', [choice], `${choice}: options ${groups} have identical writes and target`));
  }
  return out;
}
