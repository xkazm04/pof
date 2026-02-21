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
  MODULE_FEATURE_DEFINITIONS,
  buildDependencyMap,
  computeBlockers,
  type DependencyInfo,
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
}

interface ScoreBreakdown {
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

// ── Engine ───────────────────────────────────────────────────────────────────

/**
 * Compute NBA recommendations for a single module's checklist items.
 * Reads all cross-system data synchronously from Zustand stores.
 * The featureStatusMap must be fetched externally (API call).
 */
export function computeNBA(
  moduleId: SubModuleId,
  featureStatusMap?: Map<string, string>,
): NBARecommendation[] {
  const mod = SUB_MODULE_MAP[moduleId as keyof typeof SUB_MODULE_MAP];
  if (!mod?.checklist?.length) return [];

  // ── Gather data from stores ────────────────────────────────────────────────
  const { checklistProgress, moduleHistory } = useModuleStore.getState();
  const progress = checklistProgress[moduleId] ?? {};
  const history = moduleHistory[moduleId] ?? [];
  const patterns = usePatternLibraryStore.getState().patterns;
  const lastScan = useEvaluatorStore.getState().lastScan;

  // Dependency graph
  const statusMap = featureStatusMap ?? new Map<string, string>();
  const depMap = computeBlockers(buildDependencyMap(), statusMap);

  // Module features for mapping checklist items → features
  const moduleFeatures = MODULE_FEATURE_DEFINITIONS[moduleId] ?? [];

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
    // Match item to feature(s) by label similarity
    const matchingFeature = moduleFeatures.find((f) =>
      item.label.toLowerCase().includes(f.featureName.toLowerCase().split(' ')[0].toLowerCase()) ||
      f.featureName.toLowerCase().includes(item.label.toLowerCase().split(' ')[0].toLowerCase()),
    );

    if (matchingFeature) {
      const featureKey = `${moduleId}::${matchingFeature.featureName}`;
      const featureStatus = statusMap.get(featureKey);

      // Count how many other features depend on this one (fan-out)
      let dependentCount = 0;
      for (const [, info] of depMap) {
        if (info.deps.some((d) => d.key === featureKey)) {
          dependentCount++;
        }
      }

      if (dependentCount > 0 && featureStatus !== 'implemented') {
        // This unimplemented feature blocks others
        const urgencyScore = Math.min(dependentCount * 6, W.urgency);
        breakdown.urgency = urgencyScore;
        reasons.push(`Unblocks ${dependentCount} dependent feature${dependentCount > 1 ? 's' : ''}`);
      }

      // Check if this item itself is blocked
      const info = depMap.get(featureKey);
      if (info && !info.isBlocked) {
        breakdown.readiness = W.readiness; // all deps met
        reasons.push('All dependencies satisfied');
      } else if (info?.isBlocked) {
        breakdown.readiness = 0;
        const blockerNames = info.blockers.map((b) => b.featureName).slice(0, 2);
        reasons.push(`Blocked by: ${blockerNames.join(', ')}`);
      } else {
        // No dependency info — assume ready
        breakdown.readiness = W.readiness * 0.7;
      }

      // ── 3. Impact (0–20): Fan-out unblocking ────────────────────────────
      breakdown.impact = Math.min(dependentCount * 4, W.impact);
    } else {
      // No feature match — neutral readiness
      breakdown.readiness = W.readiness * 0.5;
    }

    // ── Evaluator recommendation boost ──────────────────────────────────────
    const evalRec = evalRecs.find((r) =>
      item.label.toLowerCase().includes(r.title.toLowerCase().split(' ')[0].toLowerCase()) ||
      r.title.toLowerCase().includes(item.label.toLowerCase().split(' ')[0].toLowerCase()),
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
        item.label.toLowerCase().includes(p.title.toLowerCase().split(' ')[0].toLowerCase()) ||
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
      if (fail.prompt.toLowerCase().includes(item.label.toLowerCase().split(' ')[0].toLowerCase())) {
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

    // Build reason string
    const reason = reasons.length > 0
      ? reasons[0]
      : 'Next uncompleted item';

    return {
      item,
      moduleId,
      score,
      reason,
      pattern: matchedPattern,
      pitfalls: [...new Set(pitfalls)], // deduplicate
      successProbability,
      breakdown,
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
