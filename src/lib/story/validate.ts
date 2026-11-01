/**
 * The storygraph structural validator suite — §8's structural pass, total and cheap.
 *
 * `validateStoryGraph(graph)` is the pure core: same graph in, same findings out, no clock. Every
 * finding is `altitude: 'structural'` and carries no `lead` (state-altitude codes — SOFTLOCK_LEAD,
 * GUARD_UNSATISFIABLE, OPTION_NEVER_OFFERED, NODE_NEVER_REACHED, ENDING_BELOW_FLOOR — belong to the
 * walker and are never emitted here). `timeStoryValidation` wraps it with a measurement for callers
 * that report one (the findings route).
 *
 * A structural pass is necessary and never sufficient: zero findings here does not make a graph
 * playable (§8). A node or edge of an unknown kind is walked as a generic node / left out as a
 * non-traversal edge — nothing here throws on one — and reported as UNKNOWN_KIND (`info`, §4).
 */

import type { StoryFinding, StoryFindingCode, StoryGraph } from '@/lib/story/types';
import { STORY_FINDING_CODES } from '@/lib/story/types';
import { buildStoryTopology } from '@/lib/story/reachability';
import { integrityFindings, reachFindings, resolveContainment, STRUCTURAL_SEVERITY } from '@/lib/story/structure';
import { variableFindings } from '@/lib/story/variables';
import { choiceFindings } from '@/lib/story/choices';
import { budgetFindings } from '@/lib/story/budgets';
import { containsFindings, gateFindings, precedenceFindings, unknownKindFindings } from '@/lib/story/integrity';

/** The codes this pass can emit, in the standard's order. */
export const STRUCTURAL_CODES: readonly StoryFindingCode[] = STORY_FINDING_CODES.filter((c) => c in STRUCTURAL_SEVERITY);

const ORDER = new Map<string, number>(STORY_FINDING_CODES.map((c, i) => [c, i]));

/** Run the whole structural pass. Findings are ordered by code (the standard's order), then node. */
export function validateStoryGraph(graph: StoryGraph): StoryFinding[] {
  const ids = new Set(graph.nodes.map((n) => n.id));
  const containment = resolveContainment(graph, ids);
  const topo = buildStoryTopology(graph, containment.parentOf);
  const findings = [
    ...integrityFindings(graph, ids, containment),
    ...unknownKindFindings(graph, ids),
    ...gateFindings(graph, topo.nodeById),
    ...containsFindings(graph, topo.nodeById),
    ...precedenceFindings(graph),
    ...reachFindings(graph, topo),
    ...variableFindings(graph, topo),
    ...choiceFindings(graph),
    ...budgetFindings(graph),
  ];
  const key = (f: StoryFinding) => `${f.nodes[0] ?? ''}\u0000${(f.variables ?? []).join(',')}\u0000${f.detail}`;
  return findings.sort((a, b) => (ORDER.get(a.code)! - ORDER.get(b.code)!) || (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
}

export interface FindingCounts {
  byCode: Partial<Record<StoryFindingCode, number>>;
  bySeverity: Partial<Record<StoryFinding['severity'], number>>;
}

export function countFindings(findings: readonly StoryFinding[]): FindingCounts {
  const byCode: FindingCounts['byCode'] = {};
  const bySeverity: FindingCounts['bySeverity'] = {};
  for (const f of findings) {
    byCode[f.code] = (byCode[f.code] ?? 0) + 1;
    bySeverity[f.severity] = (bySeverity[f.severity] ?? 0) + 1;
  }
  return { byCode, bySeverity };
}

/** The pure core plus a wall-clock measurement. `now` is injectable so tests stay deterministic. */
export function timeStoryValidation(
  graph: StoryGraph,
  now: () => number = () => performance.now(),
): { findings: StoryFinding[]; durationMs: number } {
  const t0 = now();
  const findings = validateStoryGraph(graph);
  return { findings, durationMs: now() - t0 };
}
