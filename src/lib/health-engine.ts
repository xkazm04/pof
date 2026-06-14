/* ------------------------------------------------------------------ */
/*  Holistic Project Health — Aggregation Engine                      */
/* ------------------------------------------------------------------ */

import type {
  ProjectHealthSummary,
  ModuleHealthSummary,
  ModuleHealthStatus,
  VelocityPoint,
  QualityPoint,
  Milestone,
  BurnChartPoint,
  SubsystemSignal,
  PerfHealthInput,
  CrashHealthInput,
} from '@/types/project-health';
import type { EvaluatorReport, ModuleScore } from '@/types/evaluator';
import { ALL_MODULE_DEFS, ALL_CHECKLIST_TOTAL } from './module-registry';

/* ---- Module definitions ------------------------------------------ */
// "Overall completion" must span EVERY module, not just core-engine — otherwise
// the Holistic Health dashboard contradicts the weekly digest and top-bar stats,
// which both count all modules (ALL_CHECKLIST_TOTAL). We derive the module list
// and the X/Y denominator from the same all-module registry constants so the
// numerator (iterating MODULE_DEFS) and denominator (TOTAL_CHECKLIST_ITEMS) share
// one scope and can't drift from each other or from the digest.

const MODULE_DEFS = ALL_MODULE_DEFS;

const TOTAL_CHECKLIST_ITEMS = ALL_CHECKLIST_TOTAL;

/* ---- Seeded RNG for reproducible simulated data ------------------ */

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---- Compute module health from checklist + evaluator data ------- */

function computeModuleHealth(
  checklistProgress: Record<string, Record<string, boolean>>,
  evaluatorScores: ModuleScore[],
): ModuleHealthSummary[] {
  return MODULE_DEFS.map((mod) => {
    const progress = checklistProgress[mod.id] ?? {};
    const completed = Object.values(progress).filter(Boolean).length;
    const checklistCompletion = mod.checklistCount > 0
      ? Math.round((completed / mod.checklistCount) * 100)
      : 0;

    const evalScore = evaluatorScores.find((s) => s.moduleId === mod.id);
    const qualityScore = evalScore?.score ?? null;
    const issueCount = evalScore?.issues?.length ?? 0;

    // Combined health: 60% checklist, 40% quality (if available)
    let healthScore: number;
    if (qualityScore !== null) {
      healthScore = Math.round(checklistCompletion * 0.6 + qualityScore * 0.4);
    } else {
      healthScore = checklistCompletion;
    }

    let status: ModuleHealthStatus;
    if (completed === 0 && qualityScore === null) status = 'not-started';
    else if (healthScore >= 70) status = 'healthy';
    else if (healthScore >= 40) status = 'warning';
    else status = 'critical';

    return {
      moduleId: mod.id,
      label: mod.label,
      status,
      checklistCompletion,
      qualityScore,
      issueCount,
      healthScore,
    };
  });
}

/* ---- Generate simulated velocity history ------------------------- */

function generateVelocityHistory(
  completedItems: number,
  rng: () => number,
): VelocityPoint[] {
  const points: VelocityPoint[] = [];
  const totalWeeks = 8;
  let cumulative = 0;

  // Distribute completedItems across weeks with increasing velocity
  const basePerWeek = Math.max(1, Math.floor(completedItems / totalWeeks));

  for (let w = 0; w < totalWeeks; w++) {
    const weekDate = new Date();
    weekDate.setDate(weekDate.getDate() - (totalWeeks - w) * 7);
    const weekLabel = `W${w + 1}`;

    // Velocity tends to increase over time (ramp up)
    const rampFactor = 0.5 + (w / totalWeeks) * 1.0;
    const variance = 0.7 + rng() * 0.6;
    const itemsThisWeek = Math.max(0, Math.round(basePerWeek * rampFactor * variance));
    cumulative += itemsThisWeek;

    // Cap at actual completedItems
    if (cumulative > completedItems) {
      cumulative = completedItems;
    }

    points.push({
      weekLabel,
      weekStart: weekDate.toISOString(),
      itemsCompleted: itemsThisWeek,
      cumulativeCompleted: cumulative,
    });
  }

  return points;
}

/* ---- Generate quality history from scan history ------------------ */

function generateQualityHistory(scanHistory: EvaluatorReport[]): QualityPoint[] {
  if (scanHistory.length === 0) {
    // Generate simulated quality trend
    const rng = mulberry32(42);
    const points: QualityPoint[] = [];
    let score = 40 + Math.floor(rng() * 20);

    for (let i = 0; i < 6; i++) {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i) * 5);
      // Quality generally improves
      score = Math.min(100, Math.max(0, score + Math.floor(rng() * 15) - 3));
      points.push({
        timestamp: d.toISOString(),
        label: `Scan ${i + 1}`,
        overallScore: score,
        criticalIssues: Math.max(0, Math.floor(rng() * 4) - i),
        highIssues: Math.max(0, Math.floor(rng() * 8) - i),
      });
    }
    return points;
  }

  return scanHistory.map((scan, i) => ({
    timestamp: new Date(scan.timestamp).toISOString(),
    label: `Scan ${i + 1}`,
    overallScore: scan.overallScore,
    criticalIssues: scan.recommendations.filter((r) => r.priority === 'critical').length,
    highIssues: scan.recommendations.filter((r) => r.priority === 'high').length,
  }));
}

/* ---- Milestone predictions --------------------------------------- */

function predictMilestones(
  completedItems: number,
  totalItems: number,
  avgVelocity: number,
): Milestone[] {
  const completionPct = totalItems > 0 ? (completedItems / totalItems) * 100 : 0;

  const milestones: Milestone[] = [
    {
      id: 'vertical-slice',
      name: 'Playable Vertical Slice',
      targetCompletion: 30,
      predictedDate: null,
      predictedWeeks: null,
      currentProgress: Math.min(100, Math.round((completionPct / 30) * 100)),
      color: '#34d399',
    },
    {
      id: 'feature-complete',
      name: 'Feature Complete',
      targetCompletion: 75,
      predictedDate: null,
      predictedWeeks: null,
      currentProgress: Math.min(100, Math.round((completionPct / 75) * 100)),
      color: '#60a5fa',
    },
    {
      id: 'beta-ready',
      name: 'Beta Ready',
      targetCompletion: 90,
      predictedDate: null,
      predictedWeeks: null,
      currentProgress: Math.min(100, Math.round((completionPct / 90) * 100)),
      color: '#a78bfa',
    },
    {
      id: 'release',
      name: 'Release Candidate',
      targetCompletion: 100,
      predictedDate: null,
      predictedWeeks: null,
      currentProgress: Math.min(100, Math.round(completionPct)),
      color: '#f472b6',
    },
  ];

  if (avgVelocity > 0) {
    for (const ms of milestones) {
      const targetItems = Math.ceil((ms.targetCompletion / 100) * totalItems);
      const remaining = Math.max(0, targetItems - completedItems);
      const weeksNeeded = remaining / avgVelocity;

      if (remaining <= 0) {
        ms.predictedWeeks = 0;
        ms.predictedDate = new Date().toISOString();
      } else {
        ms.predictedWeeks = Math.round(weeksNeeded * 10) / 10;
        const predicted = new Date();
        predicted.setDate(predicted.getDate() + Math.ceil(weeksNeeded * 7));
        ms.predictedDate = predicted.toISOString();
      }
    }
  }

  return milestones;
}

/* ---- Burndown/burnup chart --------------------------------------- */

function generateBurnChart(
  velocityHistory: VelocityPoint[],
  totalItems: number,
): BurnChartPoint[] {
  const totalWeeks = velocityHistory.length;
  if (totalWeeks === 0) return [];

  return velocityHistory.map((v, i) => {
    const idealBurnedPerWeek = totalItems / (totalWeeks + 4); // +4 for future projection
    return {
      weekLabel: v.weekLabel,
      weekStart: v.weekStart,
      remaining: totalItems - v.cumulativeCompleted,
      completed: v.cumulativeCompleted,
      idealRemaining: Math.max(0, Math.round(totalItems - idealBurnedPerWeek * (i + 1))),
    };
  });
}

/* ---- Subsystem signals ------------------------------------------- */

/** Map a 0-100 score to a traffic-light signal status. */
function scoreStatus(score: number): SubsystemSignal['status'] {
  if (score >= 70) return 'healthy';
  if (score >= 40) return 'warning';
  return 'critical';
}

/** Real performance signal derived from the latest profiling triage. */
function buildPerfSignal(perf: PerfHealthInput | null): SubsystemSignal {
  if (!perf) {
    return {
      subsystem: 'performance',
      label: 'Performance Profiling',
      status: 'inactive',
      metric: 'No trace triaged',
      detail: 'Import a trace or generate a sample to triage frame budget',
      linkTab: 'perf',
    };
  }

  const fpsPrefix = perf.avgFPS != null ? `${Math.round(perf.avgFPS)} FPS · ` : '';
  const bottleneck = perf.bottleneck === 'balanced' ? 'balanced load' : `${perf.bottleneck}-bound`;
  const findings = perf.findingCount > 0 ? ` · ${perf.findingCount} finding${perf.findingCount === 1 ? '' : 's'}` : '';

  return {
    subsystem: 'performance',
    label: 'Performance Profiling',
    status: scoreStatus(perf.overallScore),
    metric: `Score ${perf.overallScore}/100`,
    detail: `${fpsPrefix}${bottleneck}${findings}`,
    linkTab: 'perf',
  };
}

/** Real crash signal derived from the persisted crash-analyzer stats. */
function buildCrashSignal(crash: CrashHealthInput | null): SubsystemSignal {
  if (!crash) {
    return {
      subsystem: 'crash-analyzer',
      label: 'Crash Analyzer',
      status: 'inactive',
      metric: 'Ready',
      detail: 'Import crash logs for AI analysis',
      linkTab: 'crashes',
    };
  }

  if (crash.totalCrashes === 0) {
    return {
      subsystem: 'crash-analyzer',
      label: 'Crash Analyzer',
      status: 'healthy',
      metric: 'No crashes',
      detail: 'No crashes recorded in the database',
      linkTab: 'crashes',
    };
  }

  const status: SubsystemSignal['status'] =
    crash.criticalCrashes > 0 || crash.systemicIssues > 0
      ? 'critical'
      : crash.recentCrashes > 0
        ? 'warning'
        : 'healthy';

  const where = crash.mostAffectedModule && crash.mostAffectedModule !== 'none'
    ? `Most in ${crash.mostAffectedModule}`
    : 'Across modules';
  const recent = crash.recentCrashes > 0 ? ` · ${crash.recentCrashes} in 24h` : '';
  const systemic = crash.systemicIssues > 0 ? ` · ${crash.systemicIssues} systemic` : '';

  return {
    subsystem: 'crash-analyzer',
    label: 'Crash Analyzer',
    status,
    metric: `${crash.totalCrashes} crash${crash.totalCrashes === 1 ? '' : 'es'}`,
    detail: `${where}${recent}${systemic}`,
    linkTab: 'crashes',
  };
}

function generateSubsystemSignals(
  checklistProgress: Record<string, Record<string, boolean>>,
  lastScan: EvaluatorReport | null,
  perfInput: PerfHealthInput | null,
  crashInput: CrashHealthInput | null,
): SubsystemSignal[] {
  // Check how many modules have any progress at all
  const modulesWithProgress = Object.keys(checklistProgress).filter(
    (k) => Object.values(checklistProgress[k] ?? {}).some(Boolean),
  ).length;

  return [
    {
      subsystem: 'checklist',
      label: 'Checklist Engine',
      status: modulesWithProgress > 0 ? 'healthy' : 'inactive',
      metric: `${modulesWithProgress}/${MODULE_DEFS.length} modules started`,
      detail: modulesWithProgress > 6 ? 'Good coverage across modules' : 'Focus on starting more modules',
    },
    {
      subsystem: 'evaluator',
      label: 'Quality Evaluator',
      status: lastScan ? scoreStatus(lastScan.overallScore) : 'inactive',
      metric: lastScan ? `Score ${lastScan.overallScore}/100` : 'No scan yet',
      detail: lastScan ? 'Latest deep-eval quality score' : 'Run deep eval to update quality scores',
      linkTab: 'scanner',
    },
    buildCrashSignal(crashInput),
    buildPerfSignal(perfInput),
    {
      subsystem: 'localization',
      label: 'Localization Pipeline',
      status: 'healthy',
      metric: 'Ready',
      detail: 'Run pipeline to check i18n readiness',
      linkTab: 'i18n',
    },
    {
      subsystem: 'combat-sim',
      label: 'Combat Simulator',
      status: 'healthy',
      metric: 'Ready',
      detail: 'Run simulations to balance combat',
      linkTab: 'combat',
    },
    {
      subsystem: 'economy-sim',
      label: 'Economy Simulator',
      status: 'healthy',
      metric: 'Ready',
      detail: 'Simulate economy for inflation checks',
      linkTab: 'economy',
    },
  ];
}

/* ------------------------------------------------------------------ */
/*  Main Aggregation Function                                          */
/* ------------------------------------------------------------------ */

export function computeProjectHealth(
  checklistProgress: Record<string, Record<string, boolean>>,
  scanHistory: EvaluatorReport[],
  lastScan: EvaluatorReport | null,
  perfInput: PerfHealthInput | null = null,
  crashInput: CrashHealthInput | null = null,
): ProjectHealthSummary {
  const rng = mulberry32(99);

  // Count completed checklist items
  let completedChecklistItems = 0;
  for (const mod of MODULE_DEFS) {
    const progress = checklistProgress[mod.id] ?? {};
    completedChecklistItems += Object.values(progress).filter(Boolean).length;
  }

  const overallCompletion = TOTAL_CHECKLIST_ITEMS > 0
    ? Math.round((completedChecklistItems / TOTAL_CHECKLIST_ITEMS) * 100)
    : 0;

  // Module health
  const evalScores = lastScan?.moduleScores ?? [];
  const moduleHealth = computeModuleHealth(checklistProgress, evalScores);

  // Quality
  const currentQualityScore = lastScan?.overallScore ?? null;
  const qualityHistory = generateQualityHistory(scanHistory);
  let qualityTrend: 'improving' | 'stable' | 'declining' | 'unknown' = 'unknown';
  if (qualityHistory.length >= 2) {
    const last = qualityHistory[qualityHistory.length - 1].overallScore;
    const prev = qualityHistory[qualityHistory.length - 2].overallScore;
    if (last > prev + 3) qualityTrend = 'improving';
    else if (last < prev - 3) qualityTrend = 'declining';
    else qualityTrend = 'stable';
  }

  // Velocity
  const velocityHistory = generateVelocityHistory(completedChecklistItems, rng);
  const recentWeeks = velocityHistory.slice(-3);
  const avgVelocity = recentWeeks.length > 0
    ? recentWeeks.reduce((s, v) => s + v.itemsCompleted, 0) / recentWeeks.length
    : 0;

  // Milestones
  const milestones = predictMilestones(completedChecklistItems, TOTAL_CHECKLIST_ITEMS, avgVelocity);

  // Burndown
  const burnChart = generateBurnChart(velocityHistory, TOTAL_CHECKLIST_ITEMS);

  // Performance — fused from the latest profiling triage (null if untriaged)
  const performanceScore = perfInput?.overallScore ?? null;

  // Subsystem signals — crash + performance are now real, drillable signals
  const subsystemSignals = generateSubsystemSignals(checklistProgress, lastScan, perfInput, crashInput);

  return {
    overallCompletion,
    totalChecklistItems: TOTAL_CHECKLIST_ITEMS,
    completedChecklistItems,
    currentQualityScore,
    performanceScore,
    qualityTrend,
    avgVelocity: Math.round(avgVelocity * 10) / 10,
    moduleHealth,
    velocityHistory,
    qualityHistory,
    milestones,
    burnChart,
    subsystemSignals,
  };
}
