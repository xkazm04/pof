/**
 * Asset Scout truth: the engine partitions the feature matrix three ways — missing /
 * partial are GAPS, unknown / absent are UNREVIEWED, implemented / improved are
 * excluded — so an unmeasured feature is never printed as a gap. Groups carry
 * `featureNames[]` (no join/re-split), the GAS bonus goes only to GAS-compatible
 * assets, and a module's unreviewed features become one feature-review CLITask.
 *
 * scan-sweep --challenge run challenge-2026-09-28c, card asset-visual-studio/B.
 */
import { describe, it, expect } from 'vitest';
import {
  buildFeatureGaps,
  partitionFeatureMatrix,
  generateRecommendations,
  scoreAsset,
} from '@/lib/marketplace/recommendation-engine';
import { scoutReviewTask } from '@/lib/marketplace/scout-review';
import { ASSET_CATALOG } from '@/lib/marketplace/asset-catalog';
import { MODULE_FEATURE_DEFINITIONS } from '@/lib/feature-definitions';
import type { FeatureStatus } from '@/types/feature-matrix';

const ALL = Object.entries(MODULE_FEATURE_DEFINITIONS).flatMap(([moduleId, defs]) =>
  (defs ?? []).map((d) => ({ moduleId, featureName: d.featureName })),
);
const names = (moduleId: string) => (MODULE_FEATURE_DEFINITIONS[moduleId as keyof typeof MODULE_FEATURE_DEFINITIONS] ?? []).map((d) => d.featureName);
const COMBAT = names('arpg-combat');
const LOOT = names('arpg-loot');

describe('partitionFeatureMatrix — gaps vs unreviewed', () => {
  it('an empty status map yields 0 gaps and every defined feature as unreviewed', () => {
    expect(ALL.length).toBe(240);
    expect(buildFeatureGaps(new Map())).toHaveLength(0);
    const { gaps, unreviewed } = partitionFeatureMatrix(new Map());
    expect(gaps).toHaveLength(0);
    expect(unreviewed.reduce((n, m) => n + m.featureNames.length, 0)).toBe(240);
  });

  it('implemented features drop out of both lists; one missing loot feature is the only loot gap', () => {
    const map = new Map<string, FeatureStatus>();
    for (const f of COMBAT) map.set(`arpg-combat::${f}`, 'implemented');
    map.set(`arpg-loot::${LOOT[1]}`, 'missing');
    const { gaps, unreviewed } = partitionFeatureMatrix(map);
    expect(gaps.some((g) => g.moduleId === 'arpg-combat')).toBe(false);
    expect(unreviewed.some((m) => m.moduleId === 'arpg-combat')).toBe(false);
    const recs = generateRecommendations(gaps).recommendations;
    const loot = recs.find((r) => r.gap.moduleId === 'arpg-loot');
    expect(loot?.gap.featureNames).toEqual([LOOT[1]]);
    expect(unreviewed.find((m) => m.moduleId === 'arpg-loot')?.featureNames).toHaveLength(LOOT.length - 1);
  });
});

describe('generateRecommendations — typed feature groups', () => {
  it('each group carries featureNames = the module missing|partial names in definition order; sort by featureNames.length', () => {
    const map = new Map<string, FeatureStatus>();
    // Loot: 3 gaps (missing, partial, missing) out of order in the map; combat: 1 gap.
    map.set(`arpg-loot::${LOOT[4]}`, 'missing');
    map.set(`arpg-loot::${LOOT[0]}`, 'partial');
    map.set(`arpg-loot::${LOOT[2]}`, 'missing');
    map.set(`arpg-loot::${LOOT[3]}`, 'implemented');
    map.set(`arpg-combat::${COMBAT[2]}`, 'partial');
    const { gaps } = partitionFeatureMatrix(map);
    const recs = generateRecommendations(gaps).recommendations;
    const loot = recs.find((r) => r.gap.moduleId === 'arpg-loot')!;
    const combat = recs.find((r) => r.gap.moduleId === 'arpg-combat')!;
    expect(loot.gap.featureNames).toEqual([LOOT[0], LOOT[2], LOOT[4]]);
    expect(combat.gap.featureNames).toEqual([COMBAT[2]]);
    expect(recs.indexOf(loot)).toBeLessThan(recs.indexOf(combat));
    // A feature name containing ', ' must not inflate the count (the old split did).
    const commaGap = { ...gaps.find((g) => g.moduleId === 'arpg-combat')!, featureName: 'Hit, stop', featureNames: ['Hit, stop'] };
    const ordered = generateRecommendations([commaGap, ...gaps.filter((g) => g.moduleId === 'arpg-loot')]).recommendations;
    expect(ordered[0].gap.moduleId).toBe('arpg-loot');
    expect(ordered.find((r) => r.gap.moduleId === 'arpg-combat')?.gap.featureNames).toEqual(['Hit, stop']);
  });
});

describe('scoreAsset — GAS bonus precedence', () => {
  it('a non-GAS asset on a combat gap gets neither the GAS reason nor the +10', () => {
    const map = new Map<string, FeatureStatus>([[`arpg-combat::${COMBAT[0]}`, 'missing']]);
    const gap = partitionFeatureMatrix(map).gaps[0];
    const agr = ASSET_CATALOG.find((a) => a.id === 'agr-pro')!;
    expect(agr.gasCompatible).toBe(false);
    const plain = scoreAsset(agr, gap)!;
    const gas = scoreAsset({ ...agr, gasCompatible: true }, gap)!;
    expect(plain.matchReasons).not.toContain('GAS compatible');
    expect(gas.matchReasons).toContain('GAS compatible');
    expect(gas.matchScore - plain.matchScore).toBe(10);
  });
});

describe('scoutReviewTask', () => {
  it('builds a feature-review task over exactly the matching definitions', () => {
    const task = scoutReviewTask('arpg-combat', [COMBAT[3], COMBAT[1], 'Not A Real Feature'], 'http://localhost:3000');
    expect(task).not.toBeNull();
    expect(task!.type).toBe('feature-review');
    expect(task!.moduleId).toBe('arpg-combat');
    const defs = (MODULE_FEATURE_DEFINITIONS['arpg-combat'] ?? []).filter((d) => d.featureName === COMBAT[1] || d.featureName === COMBAT[3]);
    expect(task!.features).toEqual(defs);
    expect(task!.appOrigin).toBe('http://localhost:3000');
    expect(scoutReviewTask('arpg-combat', ['Not A Real Feature'], 'http://x')).toBeNull();
  });
});
