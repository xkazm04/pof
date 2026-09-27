/**
 * What to build first to unblock a feature — the backward half of the feature
 * dependency graph.
 *
 * The Dependencies tab names each feature's DIRECT blockers, but what is actually
 * buildable can sit several modules upstream (combat's Hit detection waits on
 * animation's Anim Notify classes, whose chain bottoms out at character's
 * AARPGCharacterBase). `unblockFrontier` walks the unmet prerequisites back to
 * that buildable edge; `previewUnblock` says what building one feature clears;
 * `criticalUnblocker` picks the single best next build across all modules,
 * ranked by the implementation planner's own impact scorer so the two never drift.
 *
 * Done rule: `isFeatureDone` (implemented OR improved) — the constellation's and
 * the module topology's rule. Pure and deterministic; results are sorted by key.
 */

import { buildDependencyMap } from '@/lib/feature-definitions';
import { isFeatureDone } from '@/lib/constellation/layout';
import { computeImpactScores } from '@/lib/implementation-planner/impact-scorer';
import { buildModuleTopology } from '@/lib/topology/moduleGraph';
import type { FeatureStatus } from '@/types/feature-matrix';

/** The slice of `DependencyInfo` the walk needs — lets callers pass a synthetic graph. */
export type PrerequisiteGraph = ReadonlyMap<string, { deps: ReadonlyArray<{ key: string }> }>;

const byKey = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

function doneIn(statusMap: ReadonlyMap<string, string>) {
  return (key: string) => isFeatureDone((statusMap.get(key) ?? 'unknown') as FeatureStatus);
}

/** Not done, with every prerequisite done. */
function isReadyIn(depMap: PrerequisiteGraph, done: (key: string) => boolean, key: string): boolean {
  return !done(key) && (depMap.get(key)?.deps ?? []).every((d) => done(d.key));
}

/**
 * The build frontier of `key`: the not-done features among `key` and its
 * transitive unmet prerequisites whose own prerequisites are all done — what can
 * be built now to move `key` closer to buildable. [] when `key` is done;
 * [key] when it is ready itself. Visited-set walk, so a cycle terminates.
 */
export function unblockFrontier(
  statusMap: ReadonlyMap<string, string>,
  key: string,
  depMap: PrerequisiteGraph = buildDependencyMap(),
): string[] {
  const done = doneIn(statusMap);
  if (done(key)) return [];
  const frontier: string[] = [];
  const visited = new Set<string>([key]);
  const stack = [key];
  while (stack.length > 0) {
    const current = stack.pop()!;
    const unmet = (depMap.get(current)?.deps ?? []).filter((d) => !done(d.key));
    if (unmet.length === 0) frontier.push(current);
    for (const dep of unmet) {
      if (visited.has(dep.key)) continue;
      visited.add(dep.key);
      stack.push(dep.key);
    }
  }
  return frontier.sort(byKey);
}

export interface UnblockPreview {
  /** Features that are not done and have an unmet prerequisite, today. */
  blockedBefore: number;
  /** The same count once `key` is done. */
  blockedAfter: number;
  /** Features (other than `key`) that become ready once `key` is done, sorted. */
  newlyReady: string[];
}

function openBlocked(depMap: PrerequisiteGraph, done: (key: string) => boolean): Set<string> {
  const blocked = new Set<string>();
  for (const [key, info] of depMap) {
    if (!done(key) && info.deps.some((d) => !done(d.key))) blocked.add(key);
  }
  return blocked;
}

/** What building `key` clears: blocked counts before/after and the newly ready features. */
export function previewUnblock(statusMap: ReadonlyMap<string, string>, key: string): UnblockPreview {
  const depMap = buildDependencyMap();
  const before = doneIn(statusMap);
  const after = (k: string) => k === key || before(k);
  const blockedBefore = openBlocked(depMap, before);
  const blockedAfter = openBlocked(depMap, after);
  const newlyReady = [...blockedBefore]
    .filter((k) => k !== key && !blockedAfter.has(k))
    .sort(byKey);
  return { blockedBefore: blockedBefore.size, blockedAfter: blockedAfter.size, newlyReady };
}

/**
 * Cross-module edges (`from->to`, as the canvas keys them) that stop carrying a
 * blocker once `key` is built — what the Dependencies graph lights on a Build
 * preview. Edges keep the topology's own blocker rule, so the preview matches
 * what the graph will draw after the build lands.
 */
export function clearedEdgeIds(statusMap: ReadonlyMap<string, string>, key: string): Set<string> {
  const before = buildModuleTopology(new Map(statusMap));
  const after = new Map(
    buildModuleTopology(new Map([...statusMap, [key, 'implemented']])).edges.map((e) => [`${e.from}->${e.to}`, e]),
  );
  const cleared = new Set<string>();
  for (const edge of before.edges) {
    const id = `${edge.from}->${edge.to}`;
    if (edge.hasBlockers && after.get(id)?.hasBlockers === false) cleared.add(id);
  }
  return cleared;
}

/**
 * The single best next build across every module: the ready, unbuilt feature
 * with the most direct unblocks per `computeImpactScores` (ties by key), or null
 * when nothing is ready.
 */
export function criticalUnblocker(statusMap: ReadonlyMap<string, string>): string | null {
  const depMap = buildDependencyMap();
  const done = doneIn(statusMap);
  const doneKeys = new Set([...depMap.keys()].filter(done));
  let best: { key: string; direct: number } | null = null;
  for (const [key, score] of computeImpactScores(doneKeys)) {
    if (!isReadyIn(depMap, done, key)) continue;
    const direct = score.directUnblocks;
    if (!best || direct > best.direct || (direct === best.direct && key < best.key)) {
      best = { key, direct };
    }
  }
  return best?.key ?? null;
}
