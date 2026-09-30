/**
 * scan-sweep --challenge (holistic-quality-overview/B): the combined-health composite
 * is a published linear weighting, so the points a dimension forfeits are exactly
 * weight x (100 - value). rankModuleLifts / topProjectLifts price each remedy in the
 * gauge's own units, using the SAME weight set computeBreakdown used.
 */
import { describe, it, expect } from 'vitest';
import { rankModuleLifts, topProjectLifts } from '@/lib/evaluator/health-lifts';
import type { HealthBreakdown, ProjectHealthSummary } from '@/lib/evaluator/combined-health';
import type { ModuleCorrelation } from '@/lib/evaluator/correlation-engine';
import type { SubModuleId } from '@/types/modules';

function corr(moduleId: string, over: Partial<ModuleCorrelation> = {}): ModuleCorrelation {
  return {
    moduleId,
    label: moduleId,
    avgQuality: null,
    pctComplete: 0,
    totalFeatures: 8,
    implemented: 0,
    partial: 0,
    missing: 0,
    blockedCount: 0,
    dependencyCount: 0,
    sessionCount: 0,
    successRate: 0,
    avgDurationMs: 0,
    scannerScore: null,
    issueCount: 0,
    hasData: true,
    ...over,
  };
}

type ModuleScore = ProjectHealthSummary['moduleScores'][number];
function score(moduleId: string, breakdown: HealthBreakdown): ModuleScore {
  return { moduleId: moduleId as SubModuleId, label: moduleId, breakdown };
}

const pick = (l: ReturnType<typeof rankModuleLifts>[number]) => ({
  dimension: l.dimension, moduleGain: l.moduleGain, projectGain: l.projectGain, action: l.action,
});

describe('rankModuleLifts', () => {
  it('prices an unreviewed module: quality forfeits its full 40%, dimensions at 100 yield no lift', () => {
    const lifts = rankModuleLifts(
      score('arpg-loot', { quality: 0, dependencyHealth: 100, coverage: 50, activity: 100, combined: 50 }),
      corr('arpg-loot', { avgQuality: null, totalFeatures: 8, blockedCount: 0, missing: 4, partial: 0, sessionCount: 12 }),
      4,
    );
    expect(lifts.map(pick)).toEqual([
      { dimension: 'quality', moduleGain: 40, projectGain: 10, action: { kind: 'review', moduleId: 'arpg-loot' } },
      { dimension: 'coverage', moduleGain: 10, projectGain: 2.5, action: { kind: 'open-module', moduleId: 'arpg-loot' } },
    ]);
  });

  it('base weights: combined + sum of module gains === 100', () => {
    const b = { quality: 50, dependencyHealth: 80, coverage: 30, activity: 20, combined: 52 };
    const lifts = rankModuleLifts(score('arpg-combat', b), corr('arpg-combat'), 1);
    const byDim = Object.fromEntries(lifts.map((l) => [l.dimension, l.moduleGain]));
    expect(byDim).toEqual({ quality: 20, dependencyHealth: 6, coverage: 14, activity: 8 });
    expect(b.combined + lifts.reduce((s, l) => s + l.moduleGain, 0)).toBe(100);
  });

  it('judge weights: gains follow WEIGHTS_WITH_JUDGE when the breakdown carries judgedContent', () => {
    const lifts = rankModuleLifts(
      score('arpg-loot', { quality: 80, judgedContent: 40, dependencyHealth: 100, coverage: 100, activity: 100, combined: 79 }),
      corr('arpg-loot', { avgQuality: 4 }),
      1,
    );
    expect(lifts).toHaveLength(2);
    expect(lifts[0]).toMatchObject({ dimension: 'judgedContent', moduleGain: 15, action: { kind: 'open-tab', tab: 'quality' } });
    expect(lifts[1]).toMatchObject({ dimension: 'quality', moduleGain: 6 });
  });

  it('a blocked module gets a dependency lift that opens the Dependencies tab and names the blocked count', () => {
    const lifts = rankModuleLifts(
      score('arpg-combat', { quality: 100, dependencyHealth: 70, coverage: 100, activity: 100, combined: 91 }),
      corr('arpg-combat', { blockedCount: 3, totalFeatures: 10, avgQuality: 5 }),
      1,
    );
    const dep = lifts.find((l) => l.dimension === 'dependencyHealth');
    expect(dep).toMatchObject({ moduleGain: 9, action: { kind: 'open-tab', tab: 'dependencies' } });
    expect(dep!.reason).toContain('3 blocked');
  });
});

describe('topProjectLifts', () => {
  it('returns at most n lifts, projectGain desc then moduleId asc; unscored modules never appear', () => {
    const moduleScores = [
      score('b-mod', { quality: 0, dependencyHealth: 100, coverage: 100, activity: 100, combined: 60 }),
      score('a-mod', { quality: 0, dependencyHealth: 100, coverage: 100, activity: 100, combined: 60 }),
      score('c-mod', { quality: 100, dependencyHealth: 100, coverage: 50, activity: 0, combined: 80 }),
    ];
    const correlations = [
      corr('a-mod'), corr('b-mod'), corr('c-mod'),
      // In correlations but not scored (no features): must never surface.
      corr('ghost', { totalFeatures: 0 }),
    ];
    const top = topProjectLifts(moduleScores, correlations, 3);
    expect(top).toHaveLength(3);
    expect(top.map((l) => [l.moduleId, l.dimension])).toEqual([
      ['a-mod', 'quality'],
      ['b-mod', 'quality'],
      ['c-mod', 'coverage'],
    ]);
    for (let i = 1; i < top.length; i++) expect(top[i - 1].projectGain).toBeGreaterThanOrEqual(top[i].projectGain);
    expect(top.some((l) => (l.moduleId as string) === 'ghost')).toBe(false);
    expect(topProjectLifts(moduleScores, correlations, 10).some((l) => (l.moduleId as string) === 'ghost')).toBe(false);
  });
});
