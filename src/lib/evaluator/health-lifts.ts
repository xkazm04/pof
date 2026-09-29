import type { SubModuleId } from '@/types/modules';
import type { ModuleCorrelation } from '@/lib/evaluator/correlation-engine';
import { healthWeightsFor, type HealthBreakdown, type ProjectHealthSummary } from '@/lib/evaluator/combined-health';

// ─── Health lifts ────────────────────────────────────────────────────────────
//
// The combined-health composite is a published linear weighting, so the points a
// dimension forfeits are exactly weight x (100 - value), priced with the weight set
// the breakdown was computed with (base or WITH_JUDGE — see healthWeightsFor). A
// lift is that forfeited value plus the remedy the app already has for it. Pure: the
// UI decides when (on click only) an action runs.

export type LiftDimension = 'quality' | 'judgedContent' | 'dependencyHealth' | 'coverage' | 'activity';

/** The remedy for a lift — a structural action, resolved by the view. */
export type LiftAction =
  | { kind: 'review'; moduleId: SubModuleId }
  | { kind: 'open-tab'; tab: 'quality' | 'dependencies' }
  | { kind: 'open-module'; moduleId: SubModuleId };

export interface HealthLift {
  moduleId: SubModuleId;
  label: string;
  dimension: LiftDimension;
  /** The dimension's current 0-100 value. */
  value: number;
  /** Composite points this module regains when the dimension reaches 100. */
  moduleGain: number;
  /** Points the project gauge (mean of scored modules) regains. */
  projectGain: number;
  /** Why the dimension is short, from the module's correlation facts. */
  reason: string;
  action: LiftAction;
}

type ModuleScore = ProjectHealthSummary['moduleScores'][number];

/** Fixed dimension order: the tie-break when two lifts are worth the same. */
const DIMENSION_ORDER: LiftDimension[] = ['quality', 'judgedContent', 'dependencyHealth', 'coverage', 'activity'];

export const LIFT_DIMENSION_LABELS: Record<LiftDimension, string> = {
  quality: 'Quality',
  judgedContent: 'Judged content',
  dependencyHealth: 'Dependencies',
  coverage: 'Coverage',
  activity: 'Activity',
};

const round1 = (n: number) => Math.round(n * 10) / 10;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

function reasonFor(dim: LiftDimension, b: HealthBreakdown, c: ModuleCorrelation | undefined): string {
  switch (dim) {
    case 'quality':
      if (!c) return `quality ${b.quality}/100`;
      return c.avgQuality === null
        ? `never reviewed — ${plural(c.totalFeatures, 'feature')}`
        : `avg review quality ${c.avgQuality.toFixed(1)}/5`;
    case 'judgedContent':
      return `content judges average ${b.judgedContent ?? 0}/100`;
    case 'dependencyHealth':
      return c ? `${c.blockedCount} blocked of ${plural(c.totalFeatures, 'feature')}` : `dependency health ${b.dependencyHealth}/100`;
    case 'coverage': {
      if (!c) return `coverage ${b.coverage}%`;
      const parts = [`${plural(c.missing, 'feature')} missing`];
      if (c.partial > 0) parts.push(`${c.partial} partial`);
      return parts.join(' · ');
    }
    case 'activity':
      return c ? `${plural(c.sessionCount, 'CLI session')} (full at 10)` : `activity ${b.activity}/100`;
  }
}

function actionFor(dim: LiftDimension, moduleId: SubModuleId): LiftAction {
  switch (dim) {
    case 'quality': return { kind: 'review', moduleId };
    case 'judgedContent': return { kind: 'open-tab', tab: 'quality' };
    case 'dependencyHealth': return { kind: 'open-tab', tab: 'dependencies' };
    case 'coverage':
    case 'activity': return { kind: 'open-module', moduleId };
  }
}

function byDimension(a: HealthLift, b: HealthLift): number {
  return DIMENSION_ORDER.indexOf(a.dimension) - DIMENSION_ORDER.indexOf(b.dimension);
}

/**
 * The dimensions a scored module is losing points on, ranked by the composite points
 * fixing each returns (desc; ties in fixed dimension order). A dimension at 100 yields
 * no lift. `scoredModules` is the gauge's denominator (the project score is the mean).
 */
export function rankModuleLifts(
  moduleScore: Pick<ModuleScore, 'moduleId' | 'breakdown'> & { label?: string },
  correlation: ModuleCorrelation | undefined,
  scoredModules: number,
): HealthLift[] {
  const { moduleId, breakdown } = moduleScore;
  const weights = healthWeightsFor(breakdown);
  const n = Math.max(1, scoredModules);
  const lifts: HealthLift[] = [];
  for (const dim of DIMENSION_ORDER) {
    const weight = weights[dim];
    const value = breakdown[dim];
    if (weight === undefined || value === undefined) continue;
    const moduleGain = round1(weight * (100 - value));
    if (moduleGain <= 0) continue;
    lifts.push({
      moduleId,
      label: moduleScore.label ?? correlation?.label ?? moduleId,
      dimension: dim,
      value,
      moduleGain,
      projectGain: round1(moduleGain / n),
      reason: reasonFor(dim, breakdown, correlation),
      action: actionFor(dim, moduleId),
    });
  }
  return lifts.sort((a, b) => b.moduleGain - a.moduleGain || byDimension(a, b));
}

/**
 * The project's biggest levers: every scored module's lifts, ranked by the points the
 * gauge regains (desc), then moduleId (asc), then dimension order. Modules absent from
 * `moduleScores` (unscored — no features) never appear.
 */
export function topProjectLifts(
  moduleScores: ModuleScore[],
  correlations: ModuleCorrelation[],
  n: number,
): HealthLift[] {
  const byId = new Map(correlations.map((c) => [c.moduleId, c]));
  return moduleScores
    .flatMap((ms) => rankModuleLifts(ms, byId.get(ms.moduleId), moduleScores.length))
    .sort((a, b) => b.projectGain - a.projectGain || a.moduleId.localeCompare(b.moduleId) || byDimension(a, b))
    .slice(0, Math.max(0, n));
}
