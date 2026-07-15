import type { SubModuleId } from '@/types/modules';
import type { ModuleCorrelation } from './correlation-engine';
import type { JudgeVerdict } from '@/lib/status/judge-verdicts-db';
import { CATALOG_MODULE } from '@/lib/catalog/catalog-module';

// ─── Combined health score ───────────────────────────────────────────────────
//
// Base weighted composite: 40% quality + 30% dependency health + 20% coverage + 10% activity
//
// Each dimension is normalized to 0-100:
//   quality     = avgQuality / 5 * 100 (null → 0)
//   dep health  = 100 - (blockedCount / totalFeatures * 100), clamped [0,100]
//   coverage    = pctComplete * 100
//   activity    = min(100, sessionCount * 10) — caps at 10 sessions
//
// When a module has AI content-judge verdicts, a fifth "judged content" term is folded in
// (see WEIGHTS_WITH_JUDGE below) so a module can no longer read green while the judges failed
// its produced content — the false-green the base composite was blind to. Modules WITHOUT
// verdicts are scored exactly as before (backward compatible).

export interface HealthBreakdown {
  quality: number;
  dependencyHealth: number;
  coverage: number;
  activity: number;
  combined: number;
  /** Avg content-judge score (0-100) when the module has verdicts; omitted otherwise. */
  judgedContent?: number;
  /** True when feature-matrix quality reads healthy but the content judges disagree. */
  discrepancy?: boolean;
  /** Plain-language explanation of the discrepancy (present only when `discrepancy`). */
  discrepancyReason?: string;
}

/** Aggregated content-judge signal for one module (folded across its catalogs' verdicts). */
export interface ModuleJudgeSignal {
  /** Average 0-100 content-quality score across the module's verdicts. */
  avgScore: number;
  /** Number of verdicts considered. */
  count: number;
  /** How many of them are fail verdicts. */
  failCount: number;
}

/** Base composite weights (no content-judge signal) — the historical behavior. */
const WEIGHTS = {
  quality: 0.40,
  dependencyHealth: 0.30,
  coverage: 0.20,
  activity: 0.10,
};

/**
 * Composite weights WHEN a module has content-judge verdicts. The judged-content term takes
 * 25%, carved mostly from feature-matrix quality (40→30) and dependency health (30→20) plus
 * coverage (20→15): the judges' read of the actual produced content is a first-class signal,
 * not a footnote. Sums to 1.0.
 */
const WEIGHTS_WITH_JUDGE = {
  quality: 0.30,
  judgedContent: 0.25,
  dependencyHealth: 0.20,
  coverage: 0.15,
  activity: 0.10,
};

/** Feature-matrix quality at/above this (0-100) reads as "healthy/green". */
const HEALTHY_QUALITY_LINE = 70;
/** Content-judge average below this (0-100) reads as "failing content". */
const JUDGE_FAIL_LINE = 70;

/**
 * The single discrepancy rule, shared by the composite and the badge so they never diverge:
 * feature-matrix quality reads healthy but the content judges disagree (a fail verdict exists,
 * or the average judged score is below the fail line). Pure. `matrixQuality` is 0-100.
 */
export function judgeDiscrepancy(
  matrixQuality: number,
  signal: ModuleJudgeSignal,
): { discrepancy: boolean; reason?: string } {
  const qualityHealthy = matrixQuality >= HEALTHY_QUALITY_LINE;
  const judgeFailing = signal.failCount > 0 || signal.avgScore < JUDGE_FAIL_LINE;
  if (!qualityHealthy || !judgeFailing) return { discrepancy: false };
  const why = signal.failCount > 0
    ? `${signal.failCount} of ${signal.count} content judgment${signal.count === 1 ? '' : 's'} failed`
    : `content judgments average only ${Math.round(signal.avgScore)}/100`;
  return {
    discrepancy: true,
    reason: `Feature-matrix quality reads healthy (${Math.round(matrixQuality)}/100) but ${why}.`,
  };
}

export interface ProjectHealthSummary {
  overallScore: number;
  moduleScores: Array<{
    moduleId: SubModuleId;
    label: string;
    breakdown: HealthBreakdown;
  }>;
  topStrength: string | null;
  topWeakness: string | null;
  dimensionAverages: HealthBreakdown;
}

function computeBreakdown(m: ModuleCorrelation, judge?: ModuleJudgeSignal): HealthBreakdown {
  const quality = m.avgQuality !== null ? (m.avgQuality / 5) * 100 : 0;
  const depHealth = m.totalFeatures > 0
    ? Math.max(0, Math.min(100, 100 - (m.blockedCount / m.totalFeatures) * 100))
    : 100; // no features = no blocked issues
  const coverage = m.pctComplete * 100;
  const activity = Math.min(100, m.sessionCount * 10);

  // No content-judge signal → identical to the historical base composite (backward compatible).
  if (!judge || judge.count === 0) {
    const combined = Math.round(
      quality * WEIGHTS.quality +
      depHealth * WEIGHTS.dependencyHealth +
      coverage * WEIGHTS.coverage +
      activity * WEIGHTS.activity,
    );
    return {
      quality: Math.round(quality),
      dependencyHealth: Math.round(depHealth),
      coverage: Math.round(coverage),
      activity: Math.round(activity),
      combined,
    };
  }

  const judgedContent = Math.max(0, Math.min(100, judge.avgScore));
  const combined = Math.round(
    quality * WEIGHTS_WITH_JUDGE.quality +
    judgedContent * WEIGHTS_WITH_JUDGE.judgedContent +
    depHealth * WEIGHTS_WITH_JUDGE.dependencyHealth +
    coverage * WEIGHTS_WITH_JUDGE.coverage +
    activity * WEIGHTS_WITH_JUDGE.activity,
  );
  const { discrepancy, reason } = judgeDiscrepancy(quality, judge);

  return {
    quality: Math.round(quality),
    dependencyHealth: Math.round(depHealth),
    coverage: Math.round(coverage),
    activity: Math.round(activity),
    combined,
    judgedContent: Math.round(judgedContent),
    discrepancy,
    ...(reason ? { discrepancyReason: reason } : {}),
  };
}

/**
 * Fold a flat verdict list into a per-MODULE judge signal, mapping each verdict's catalog to
 * its owning module via the explicit CATALOG_MODULE table. Catalogs with no mapping are
 * EXCLUDED (conservative — never guessed into a module), so an unmapped catalog can never
 * mis-attribute a fail to the wrong module's health.
 *
 * De-dupes to one verdict per (catalog, entity, step): if a step was re-judged under multiple
 * rubric versions, only the newest rubric counts (mirrors statusModel), so stale scores don't
 * double-count.
 */
export function aggregateJudgeByModule(verdicts: JudgeVerdict[]): Map<string, ModuleJudgeSignal> {
  // 1) newest-rubric dedupe per (catalog, entity, step).
  const byKey = new Map<string, JudgeVerdict>();
  for (const v of verdicts) {
    const key = `${v.catalogId}::${v.entityId}::${v.step}`;
    const prev = byKey.get(key);
    if (!prev || (v.rubricVersion ?? 1) >= (prev.rubricVersion ?? 1)) byKey.set(key, v);
  }

  // 2) group by owning module (explicit map only; unmapped catalogs excluded).
  const acc = new Map<string, { sum: number; count: number; failCount: number }>();
  for (const v of byKey.values()) {
    const moduleId = CATALOG_MODULE[v.catalogId];
    if (!moduleId) continue; // conservative: unmapped catalog contributes to no module
    const a = acc.get(moduleId) ?? { sum: 0, count: 0, failCount: 0 };
    a.sum += v.score;
    a.count += 1;
    if (v.verdict === 'fail') a.failCount += 1;
    acc.set(moduleId, a);
  }

  const out = new Map<string, ModuleJudgeSignal>();
  for (const [moduleId, a] of acc) {
    out.set(moduleId, { avgScore: a.count ? a.sum / a.count : 0, count: a.count, failCount: a.failCount });
  }
  return out;
}

/** One flagged health/judge disagreement for the quality-tab badge. */
export interface JudgeDiscrepancyFlag {
  moduleId: string;
  label: string;
  matrixQuality: number; // 0-100
  judgedContent: number; // 0-100
  count: number;
  failCount: number;
  reason: string;
}

/**
 * Detect modules where feature-matrix quality reads healthy but the content judges disagree.
 * Pure and decoupled from the full ModuleCorrelation so the quality tab can call it with just
 * `{ moduleId, label, avgQuality }` cells. A module with no matrix quality (avgQuality null)
 * can't claim green health, so it is never flagged.
 */
export function detectJudgeDiscrepancies(
  modules: Array<{ moduleId: string; label: string; avgQuality: number | null }>,
  judgeByModule: Map<string, ModuleJudgeSignal>,
): JudgeDiscrepancyFlag[] {
  const flags: JudgeDiscrepancyFlag[] = [];
  for (const m of modules) {
    if (m.avgQuality === null) continue;
    const signal = judgeByModule.get(m.moduleId);
    if (!signal || signal.count === 0) continue;
    const matrixQuality = (m.avgQuality / 5) * 100;
    const { discrepancy, reason } = judgeDiscrepancy(matrixQuality, signal);
    if (discrepancy && reason) {
      flags.push({
        moduleId: m.moduleId,
        label: m.label,
        matrixQuality: Math.round(matrixQuality),
        judgedContent: Math.round(signal.avgScore),
        count: signal.count,
        failCount: signal.failCount,
        reason,
      });
    }
  }
  return flags;
}

export function computeProjectHealth(
  modules: ModuleCorrelation[],
  judgeByModule?: Map<string, ModuleJudgeSignal>,
): ProjectHealthSummary {
  // Only score modules that have feature definitions
  const scorable = modules.filter((m) => m.totalFeatures > 0);

  if (scorable.length === 0) {
    return {
      overallScore: 0,
      moduleScores: [],
      topStrength: null,
      topWeakness: null,
      dimensionAverages: {
        quality: 0,
        dependencyHealth: 0,
        coverage: 0,
        activity: 0,
        combined: 0,
      },
    };
  }

  const moduleScores = scorable.map((m) => ({
    moduleId: m.moduleId as SubModuleId,
    label: m.label,
    breakdown: computeBreakdown(m, judgeByModule?.get(m.moduleId)),
  }));

  // Averages per dimension
  const totals = { quality: 0, dependencyHealth: 0, coverage: 0, activity: 0, combined: 0 };
  for (const ms of moduleScores) {
    totals.quality += ms.breakdown.quality;
    totals.dependencyHealth += ms.breakdown.dependencyHealth;
    totals.coverage += ms.breakdown.coverage;
    totals.activity += ms.breakdown.activity;
    totals.combined += ms.breakdown.combined;
  }
  const n = moduleScores.length;
  const dimensionAverages: HealthBreakdown = {
    quality: Math.round(totals.quality / n),
    dependencyHealth: Math.round(totals.dependencyHealth / n),
    coverage: Math.round(totals.coverage / n),
    activity: Math.round(totals.activity / n),
    combined: Math.round(totals.combined / n),
  };

  // Find top strength (highest dimension avg) and weakness (lowest)
  const dims: { name: string; value: number }[] = [
    { name: 'Quality', value: dimensionAverages.quality },
    { name: 'Dependency Health', value: dimensionAverages.dependencyHealth },
    { name: 'Coverage', value: dimensionAverages.coverage },
    { name: 'Activity', value: dimensionAverages.activity },
  ];
  dims.sort((a, b) => b.value - a.value);
  const topStrength = dims[0].value > 0 ? dims[0].name : null;
  const topWeakness = dims[dims.length - 1].value < 100 ? dims[dims.length - 1].name : null;

  return {
    overallScore: dimensionAverages.combined,
    moduleScores,
    topStrength,
    topWeakness,
    dimensionAverages,
  };
}
