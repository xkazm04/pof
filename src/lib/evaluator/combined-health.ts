import type { SubModuleId } from '@/types/modules';
import type { ModuleCorrelation } from './correlation-engine';

// ─── Combined health score ───────────────────────────────────────────────────
//
// Weighted composite: 40% quality + 30% dependency health + 20% coverage + 10% activity
//
// Each dimension is normalized to 0-100:
//   quality     = avgQuality / 5 * 100 (null → 0)
//   dep health  = 100 - (blockedCount / totalFeatures * 100), clamped [0,100]
//   coverage    = pctComplete * 100
//   activity    = min(100, sessionCount * 10) — caps at 10 sessions

export interface HealthBreakdown {
  quality: number;
  dependencyHealth: number;
  coverage: number;
  activity: number;
  combined: number;
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

const WEIGHTS = {
  quality: 0.40,
  dependencyHealth: 0.30,
  coverage: 0.20,
  activity: 0.10,
};

function computeBreakdown(m: ModuleCorrelation): HealthBreakdown {
  const quality = m.avgQuality !== null ? (m.avgQuality / 5) * 100 : 0;
  const depHealth = m.totalFeatures > 0
    ? Math.max(0, Math.min(100, 100 - (m.blockedCount / m.totalFeatures) * 100))
    : 100; // no features = no blocked issues
  const coverage = m.pctComplete * 100;
  const activity = Math.min(100, m.sessionCount * 10);

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

export function computeProjectHealth(modules: ModuleCorrelation[]): ProjectHealthSummary {
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
    breakdown: computeBreakdown(m),
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
