/**
 * Next Best Action Engine
 *
 * Queries across checklist progress, dependency graph, pattern library,
 * evaluator recommendations, and task history to produce a ranked list
 * of the best next checklist items to work on.
 *
 * All data is read from Zustand stores (client-side, synchronous) except
 * feature-matrix statuses which require an API call.
 */

import type { SubModuleId } from '@/types/modules';
import {
  buildDependencyMap,
  computeBlockers,
  getDependentCounts,
  resolveItemFeatures,
  firstWordMatch,
  HEURISTIC_MATCH_NOTE,
  type ItemFeatureSource,
} from '@/lib/feature-definitions';
import { SUB_MODULE_MAP } from '@/lib/module-registry';
import { useModuleStore } from '@/stores/moduleStore';
import { usePatternLibraryStore } from '@/stores/patternLibraryStore';
import { useEvaluatorStore } from '@/stores/evaluatorStore';
import type { ChecklistItem } from '@/types/modules';
import type { ImplementationPattern } from '@/types/pattern-library';
import type { Recommendation } from '@/types/evaluator';

// ── Public types ─────────────────────────────────────────────────────────────

export interface NBARecommendation {
  /** Checklist item this recommendation targets */
  item: ChecklistItem;
  /** Module this item belongs to */
  moduleId: SubModuleId;
  /** 0–100 composite score (higher = do first) */
  score: number;
  /** Human-readable reason why this item is recommended */
  reason: string;
  /** Matched pattern with success data, if any */
  pattern?: ImplementationPattern;
  /** Known pitfalls from patterns or failed history */
  pitfalls: string[];
  /** Estimated success probability 0–1 */
  successProbability: number;
  /** Score breakdown for transparency */
  breakdown: ScoreBreakdown;
  /**
   * Which feature rows the urgency/impact/readiness numbers were computed from,
   * and how that binding was established. Every confident claim on the card
   * ("Unblocks 3 dependent features") is only as true as this — so it travels
   * WITH the score instead of being re-derived by whoever renders it.
   */
  featureMatch: ItemFeatureMatch;
}

/** Provenance of the item→feature binding a recommendation was scored against. */
export interface ItemFeatureMatch {
  /** Which resolution tier produced the binding (`none` ⇒ nothing was scored). */
  source: ItemFeatureSource;
  /** Feature names (unqualified) the score was computed from. */
  featureNames: readonly string[];
  /** Declared names that match no feature row — reported, never scored. */
  unresolved: readonly string[];
  /**
   * Fan-out actually used for urgency + impact: the MAX dependent count across
   * `featureNames` (an item that produces several features is as urgent as its
   * most-depended-on one; summing would multiply-count shared dependents).
   */
  dependentCount: number;
  /** One sentence naming where the relation came from. */
  note: string;
}

export interface ScoreBreakdown {
  urgency: number;       // 0–30: dependency blockers, critical priority
  successProb: number;   // 0–25: pattern success rate, module track record
  impact: number;        // 0–20: how many features does this unblock
  recency: number;       // 0–15: evaluator recommendation priority
  readiness: number;     // 0–10: all deps met, not blocked
}

// ── Scoring weights ──────────────────────────────────────────────────────────

const W = {
  urgency: 30,
  successProb: 25,
  impact: 20,
  recency: 15,
  readiness: 10,
} as const;

/**
 * Public alias of the scoring weights — the max points each factor can
 * contribute. UI that visualises a {@link ScoreBreakdown} (e.g. the
 * why-recommended bar) reads these so segment maxes stay single-sourced.
 */
export const NBA_FACTOR_WEIGHTS = W;

// ── Fuzzy matching ─────────────────────────────────────────────────────────

/**
 * Re-exported from `feature-definitions` (its new home, beside the exact
 * `CHECKLIST_FEATURE_MAP` it is the fallback for). It still drives the NBA's
 * evaluator-rec, pattern and failure-history matches — where a fuzzy match is
 * appropriate because no exact map exists for those relations.
 */
export { firstWordMatch };

// ── Engine ───────────────────────────────────────────────────────────────────

/**
 * Compute NBA recommendations for a single module's checklist items.
 * Reads all cross-system data synchronously from Zustand stores.
 * The featureStatusMap must be fetched externally (API call).
 */
export function computeNBA(
  moduleId: SubModuleId,
  featureStatusMap?: Map<string, string>,
  modulePatterns?: readonly ImplementationPattern[],
): NBARecommendation[] {
  const mod = SUB_MODULE_MAP[moduleId as keyof typeof SUB_MODULE_MAP];
  if (!mod?.checklist?.length) return [];

  // ── Gather data from stores ────────────────────────────────────────────────
  const { checklistProgress, moduleHistory } = useModuleStore.getState();
  const progress = checklistProgress[moduleId] ?? {};
  const history = moduleHistory[moduleId] ?? [];
  // Patterns feed the pitfalls warning and the success/approach metrics row.
  // The store slice is filled ONLY by the Pattern Library evaluator tab (no
  // persist middleware), so relying on it made both structurally unreachable
  // from a module view — callers now pass a module-scoped read explicitly
  // (see RoadmapChecklist/useModulePatterns). The store stays the fallback so
  // an existing caller that has it loaded keeps working.
  const patterns = modulePatterns ?? usePatternLibraryStore.getState().patterns;
  const lastScan = useEvaluatorStore.getState().lastScan;

  // Dependency graph
  const statusMap = featureStatusMap ?? new Map<string, string>();
  const depMap = computeBlockers(buildDependencyMap(), statusMap);
  // Fan-out counts are a static graph property — looked up, not rescanned.
  const dependentCounts = getDependentCounts();

  // Every item in this module's checklist — used to resolve `dependsOn` refs.
  const checklist = mod.checklist;

  // Evaluator recommendations for this module
  const evalRecs: Recommendation[] = lastScan?.recommendations?.filter(
    (r) => r.moduleId === moduleId,
  ) ?? [];

  // Failure history analysis
  const failedPrompts = history.filter((h) => h.status === 'failed');
  const successCount = history.filter((h) => h.status === 'completed').length;
  const failCount = failedPrompts.length;
  const moduleSuccessRate = successCount + failCount > 0
    ? successCount / (successCount + failCount)
    : 0.5; // neutral default

  // ── Score each uncompleted item ────────────────────────────────────────────
  const uncompleted = mod.checklist.filter((item) => !progress[item.id]);
  if (uncompleted.length === 0) return [];

  const recommendations: NBARecommendation[] = uncompleted.map((item) => {
    const breakdown: ScoreBreakdown = { urgency: 0, successProb: 0, impact: 0, recency: 0, readiness: 0 };
    const pitfalls: string[] = [];
    let matchedPattern: ImplementationPattern | undefined;
    const reasons: string[] = [];

    // ── 1. Urgency (0–30): Is this item blocking other work? ─────────────
    // Bind the item to the feature rows that can evidence it. The exact
    // CHECKLIST_FEATURE_MAP is consulted FIRST and is terminal — an item mapped
    // to `[]` scores no urgency and no impact, because nothing can evidence it.
    const resolved = resolveItemFeatures(moduleId, item);
    const featureKeys = resolved.names.map((n) => `${moduleId}::${n}`);

    // Fan-out across every feature the item produces. MAX, not sum: distinct
    // features often share dependents, and summing would count them twice.
    const dependentCount = featureKeys.length > 0
      ? Math.max(...featureKeys.map((k) => dependentCounts.get(k) ?? 0))
      : 0;

    if (featureKeys.length > 0) {
      // Only claim to unblock work while at least one produced feature is still
      // unimplemented — an item whose features are all done unblocks nothing.
      const allImplemented = featureKeys.every((k) => statusMap.get(k) === 'implemented');

      if (dependentCount > 0 && !allImplemented) {
        breakdown.urgency = Math.min(dependentCount * 6, W.urgency);
        const across = featureKeys.length > 1
          ? ` (most-depended-on of ${featureKeys.length} features this item produces)`
          : '';
        reasons.push(
          `Unblocks ${dependentCount} dependent feature${dependentCount > 1 ? 's' : ''}${across}`,
        );
      }

      // Blocked if ANY produced feature is blocked — the item is not startable
      // until every feature it owns can be built.
      const infos = featureKeys
        .map((k) => depMap.get(k))
        .filter((i): i is NonNullable<typeof i> => Boolean(i));

      if (infos.length === 0) {
        // No dependency info for any key — assume ready
        breakdown.readiness = W.readiness * 0.7;
      } else if (infos.some((i) => i.isBlocked)) {
        breakdown.readiness = 0;
        const blockerNames = [
          ...new Set(infos.flatMap((i) => i.blockers.map((b) => b.featureName))),
        ].slice(0, 2);
        reasons.push(`Blocked by: ${blockerNames.join(', ')}`);
      } else {
        breakdown.readiness = W.readiness; // all deps met
        reasons.push('All dependencies satisfied');
      }

      // ── 3. Impact (0–20): Fan-out unblocking ────────────────────────────
      breakdown.impact = Math.min(dependentCount * 4, W.impact);
    } else {
      // Nothing can evidence this item — neutral readiness, and NO fabricated
      // urgency/impact borrowed from a same-prefix neighbour.
      breakdown.readiness = W.readiness * 0.5;
    }

    // ── Checklist-level prerequisites ───────────────────────────────────────
    // `ChecklistItem.dependsOn` names sibling items in the same module. An item
    // whose prerequisites are unchecked is not ready however clean its feature
    // graph looks, so this can only ever LOWER readiness.
    const siblingDeps = item.dependsOn ?? [];
    const unmetDeps = siblingDeps
      .map((depId) => checklist.find((c) => c.id === depId))
      .filter((c): c is ChecklistItem => c !== undefined && !progress[c.id]);
    if (unmetDeps.length > 0) {
      breakdown.readiness = 0;
      const names = unmetDeps.slice(0, 2).map((c) => c.label).join(', ');
      reasons.unshift(
        `Waiting on checklist item${unmetDeps.length > 1 ? 's' : ''}: ${names}`,
      );
    }

    // ── Evaluator recommendation boost ──────────────────────────────────────
    const evalRec = evalRecs.find((r) =>
      firstWordMatch(item.label, r.title) || firstWordMatch(r.title, item.label),
    );
    if (evalRec) {
      const priorityScore = { critical: 1.0, high: 0.75, medium: 0.5, low: 0.25 }[evalRec.priority];
      breakdown.recency = Math.round(W.recency * priorityScore);
      if (evalRec.priority === 'critical') {
        breakdown.urgency = Math.max(breakdown.urgency, W.urgency * 0.8);
        reasons.push(`Evaluator: ${evalRec.priority} priority`);
      } else {
        reasons.push(`Evaluator: ${evalRec.priority} priority`);
      }
    }

    // ── 2. Success probability (0–25): Pattern match + module track record ──
    const matchingPatterns = patterns.filter((p) =>
      p.moduleId === moduleId && (
        firstWordMatch(item.label, p.title) ||
        p.tags.some((t) => item.label.toLowerCase().includes(t.toLowerCase()))
      ),
    );

    if (matchingPatterns.length > 0) {
      // Pick best pattern by success rate * session count (confidence)
      matchedPattern = matchingPatterns.reduce((best, p) =>
        (p.successRate * Math.min(p.sessionCount, 10)) > (best.successRate * Math.min(best.sessionCount, 10))
          ? p
          : best,
      );
      const patternScore = matchedPattern.successRate * W.successProb * 0.7;
      const moduleScore = moduleSuccessRate * W.successProb * 0.3;
      breakdown.successProb = Math.round(patternScore + moduleScore);

      pitfalls.push(...matchedPattern.pitfalls);
      reasons.push(
        `${Math.round(matchedPattern.successRate * 100)}% success rate (${matchedPattern.approach} approach, ${matchedPattern.sessionCount} sessions)`,
      );
    } else {
      // No pattern match — use module success rate only
      breakdown.successProb = Math.round(moduleSuccessRate * W.successProb * 0.5);
    }

    // Add pitfalls from failed history
    for (const fail of failedPrompts) {
      if (firstWordMatch(fail.prompt, item.label)) {
        pitfalls.push(`Previous failure on similar task`);
        break;
      }
    }

    // ── Composite score ───────────────────────────────────────────────────────
    const score = Math.round(
      breakdown.urgency + breakdown.successProb + breakdown.impact + breakdown.recency + breakdown.readiness,
    );

    // Success probability estimate
    const successProbability = matchedPattern
      ? matchedPattern.successRate
      : moduleSuccessRate || 0.5;

    // Build reason string. A tier-3 guess is ALWAYS labelled: the card's claims
    // are only as true as the binding they were computed from.
    const base = reasons.length > 0
      ? reasons[0]
      : resolved.source === 'mapped' && resolved.names.length === 0
        ? 'No feature row can evidence this item — nothing to unblock'
        : 'Next uncompleted item';
    const reason = resolved.source === 'heuristic'
      ? `${base} (${HEURISTIC_MATCH_NOTE})`
      : base;

    return {
      item,
      moduleId,
      score,
      reason,
      pattern: matchedPattern,
      pitfalls: [...new Set(pitfalls)], // deduplicate
      successProbability,
      breakdown,
      featureMatch: {
        source: resolved.source,
        featureNames: resolved.names,
        unresolved: resolved.unresolved,
        dependentCount,
        note: resolved.note,
      },
    };
  });

  // Sort by score descending
  recommendations.sort((a, b) => b.score - a.score);

  return recommendations;
}

/**
 * Get the single best next action for a module.
 * Convenience wrapper around computeNBA.
 */
export function getTopRecommendation(
  moduleId: SubModuleId,
  featureStatusMap?: Map<string, string>,
): NBARecommendation | null {
  const recs = computeNBA(moduleId, featureStatusMap);
  return recs[0] ?? null;
}

/**
 * Project-wide Next Best Actions: compute NBA for every sub-module and return
 * the top `limit` recommendations across the whole project, sorted by score.
 * Powers Mission Control's critical-path / what-to-do-next card (ECW Phase 10-MC).
 */
export function computeProjectNBA(
  featureStatusMap?: Map<string, string>,
  limit = 5,
): NBARecommendation[] {
  const all: NBARecommendation[] = [];
  for (const moduleId of Object.keys(SUB_MODULE_MAP) as SubModuleId[]) {
    all.push(...computeNBA(moduleId, featureStatusMap));
  }
  return all.sort((a, b) => b.score - a.score).slice(0, Math.max(0, limit));
}
