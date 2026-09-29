/**
 * scan-sweep --challenge (cross-module-features/A): ONE feature-done rule.
 *
 * The app's own Build (the feature-fix callback) lands a feature as 'improved'.
 * The planner, topology and unblock walk already count that as done via
 * `isFeatureDone`, but `computeBlockers` (every blocked badge), the NBA engine
 * and the evaluator completion roll-ups still counted only 'implemented' — so a
 * feature Claude just built kept blocking its dependents, and the Quality /
 * Overview tabs reported a different completion % than the Features tab.
 *
 * The rule now lives in `@/lib/feature-done`; every reader goes through it.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildDependencyMap, computeBlockers } from '@/lib/feature-definitions';
import { buildModuleTopology, isOpenBlocked } from '@/lib/topology/moduleGraph';
import { unblockFrontier } from '@/lib/topology/unblockFrontier';
import { computeNBA, NBA_FACTOR_WEIGHTS } from '@/lib/nba-engine';
import { correlateModuleData } from '@/lib/evaluator/correlation-engine';
import { computeProjectHealth } from '@/lib/evaluator/combined-health';
import { generateInsights } from '@/lib/evaluator/insight-generator';
import * as featureDone from '@/lib/feature-done';
import * as layout from '@/lib/constellation/layout';
import { useModuleStore } from '@/stores/moduleStore';
import { usePatternLibraryStore } from '@/stores/patternLibraryStore';
import { useEvaluatorStore } from '@/stores/evaluatorStore';
import type { ModuleAggregate } from '@/lib/feature-matrix-db';
import type { SubModuleId } from '@/types/modules';

const BASE = 'arpg-character::AARPGCharacterBase';
const PLAYER = 'arpg-character::AARPGPlayerCharacter';

beforeEach(() => {
  useModuleStore.setState({ checklistProgress: {}, moduleHistory: {}, moduleHealth: {} });
  usePatternLibraryStore.setState({ patterns: [] });
  useEvaluatorStore.setState({ lastScan: null });
});

describe('computeBlockers — an improved dep is done', () => {
  it("an 'improved' dependency no longer blocks its dependent", () => {
    const info = computeBlockers(buildDependencyMap(), new Map([[BASE, 'improved']])).get(PLAYER)!;
    expect(info.isBlocked).toBe(false);
    expect(info.blockers).toEqual([]);
  });

  it('[guard] partial / missing / unknown / absent still block, naming the dep', () => {
    for (const status of ['partial', 'missing', 'unknown', undefined]) {
      const statusMap = new Map<string, string>(status ? [[BASE, status]] : []);
      const info = computeBlockers(buildDependencyMap(), statusMap).get(PLAYER)!;
      expect(info.isBlocked, String(status)).toBe(true);
      expect(info.blockers.map((b) => b.key)).toContain(BASE);
    }
  });
});

describe('Dependencies tab — isOpenBlocked agrees with unblockFrontier', () => {
  it("with the base 'improved', the player is ready in both readers", () => {
    const statusMap = new Map([[BASE, 'improved']]);
    const topo = buildModuleTopology(statusMap);
    expect(isOpenBlocked(topo.depMap.get(PLAYER), 'unknown')).toBe(false);
    expect(unblockFrontier(statusMap, PLAYER)).toEqual([PLAYER]);
  });
});

describe('NBA — improved counts as done', () => {
  const SAVE = 'arpg-save::Save function';
  const recAs3 = (statusMap: Map<string, string>) => {
    const rec = computeNBA('arpg-save', statusMap).find((r) => r.item.id === 'as-3');
    expect(rec).toBeDefined();
    return rec!;
  };

  it("an item whose bound features are all 'improved' claims no unblock urgency", () => {
    const rec = recAs3(new Map([[SAVE, 'improved']]));
    expect(rec.breakdown.urgency).toBe(0);
    expect(rec.reason).not.toMatch(/Unblocks \d+ dependent/);
  });

  it("an item whose features' deps are all 'improved' scores full readiness", () => {
    const deps = buildDependencyMap().get(SAVE)!.deps.map((d) => d.key);
    expect(deps.length).toBeGreaterThan(0);
    const rec = recAs3(new Map(deps.map((k) => [k, 'improved'])));
    expect(rec.breakdown.readiness).toBe(NBA_FACTOR_WEIGHTS.readiness);
    expect(rec.reason).not.toContain('Blocked by:');
  });
});

const SRC = (p: string) => readFileSync(resolve(process.cwd(), 'src', p), 'utf8');
const QUALITY_TAB = 'components/modules/evaluator/AggregateQualityDashboard/index.tsx';
const FEATURES_HOOK = 'components/modules/evaluator/CrossModuleFeatureDashboard/useCrossModuleFeatureDashboard.ts';

describe('completion roll-up helper', () => {
  it('moduleCompletion / projectCompletionPct count improved as done', () => {
    expect(featureDone.moduleCompletion({ implemented: 0, improved: 5, total: 10 })).toBe(0.5);
    expect(featureDone.moduleCompletion({ implemented: 0, improved: 0, total: 0 })).toBe(0);
    expect(featureDone.projectCompletionPct([{ implemented: 0, improved: 5, total: 10 }])).toBe(50);
    expect(featureDone.projectCompletionPct([])).toBe(0);
  });

  it("the Quality tab's and the Features tab's overallPct are both computed by it", () => {
    for (const file of [QUALITY_TAB, FEATURES_HOOK]) {
      const src = SRC(file);
      expect(src, file).toMatch(/overallPct\s*=\s*projectCompletionPct\(/);
      expect(src, file).toMatch(/pctComplete\s*=\s*moduleCompletion\(/);
      expect(src, file).not.toMatch(/implemented\s*\+\s*improved\)?\s*\//);
    }
  });
});

describe('correlation → Summary health — the grade effect is pinned', () => {
  const agg = (over: Partial<ModuleAggregate>): ModuleAggregate => ({
    moduleId: 'arpg-combat' as SubModuleId, total: 8, implemented: 0, improved: 4, partial: 0,
    missing: 0, unknown: 4, avgQuality: null, lastReviewedAt: null, ...over,
  });

  it('pctComplete 0.5 and health coverage 50 for {implemented:0, improved:4, total:8}', () => {
    const { modules } = correlateModuleData([agg({})], null, null, new Map(), new Map());
    const m = modules.find((x) => x.moduleId === 'arpg-combat')!;
    expect(m.pctComplete).toBe(0.5);
    const health = computeProjectHealth(modules);
    const row = health.moduleScores.find((x) => x.moduleId === 'arpg-combat')!;
    expect(row.breakdown.coverage).toBe(50);
  });

  it("the strong-module insight copy says 'done', not 'implemented'", () => {
    const { modules } = correlateModuleData(
      [agg({ improved: 8, unknown: 0, avgQuality: 4.5 })], null, null, new Map(), new Map(),
    );
    const strong = generateInsights(modules).find((i) => i.id === 'strong-arpg-combat');
    expect(strong).toBeDefined();
    expect(strong!.description).toContain('100% features done');
    expect(strong!.description).not.toMatch(/implemented/);
  });
});

describe('ratchet — one done rule', () => {
  const MIGRATED: Array<[string, RegExp]> = [
    ['lib/feature-definitions.ts', /import\s*\{[^}]*\bisFeatureDone\b[^}]*\}\s*from\s*'@\/lib\/feature-done'/],
    ['lib/nba-engine.ts', /import\s*\{[^}]*\bisFeatureDone\b[^}]*\}\s*from\s*'@\/lib\/feature-done'/],
    ['components/modules/shared/FeatureMatrix/FeatureRowItem.tsx', /import\s*\{[^}]*\bisFeatureDone\b[^}]*\}\s*from\s*'@\/lib\/feature-done'/],
    ['components/modules/evaluator/DependencyGraph/SelectedModuleDetail.tsx', /import\s*\{[^}]*\bisFeatureDone\b[^}]*\}\s*from\s*'@\/lib\/feature-done'/],
    // Roll-up sites count statuses, not compare them: they take the rule's completion helpers.
    ['lib/evaluator/correlation-engine.ts', /import\s*\{[^}]*\bmoduleCompletion\b[^}]*\}\s*from\s*'@\/lib\/feature-done'/],
    [QUALITY_TAB, /import\s*\{[^}]*\bprojectCompletionPct\b[^}]*\}\s*from\s*'@\/lib\/feature-done'/],
  ];

  it('the 6 migrated files import the rule and hold no implemented-only done comparison', () => {
    for (const [file, importRe] of MIGRATED) {
      const src = SRC(file);
      expect(src, file).toMatch(importRe);
      expect(src, file).not.toMatch(/status\s*(===|!==)\s*'implemented'/);
      expect(src, file).not.toMatch(/\)\s*(===|!==)\s*'implemented'/);
      expect(src, file).not.toMatch(/\bimplemented\s*\/\s*total/);
    }
  });

  it('constellation/layout re-exports the SAME isFeatureDone', () => {
    expect(layout.isFeatureDone).toBe(featureDone.isFeatureDone);
  });

  it('[guard] isFeatureDone: implemented/improved done; partial/missing/unknown not', () => {
    for (const s of ['implemented', 'improved'] as const) expect(featureDone.isFeatureDone(s)).toBe(true);
    for (const s of ['partial', 'missing', 'unknown'] as const) expect(featureDone.isFeatureDone(s)).toBe(false);
    expect([...featureDone.DONE_STATUSES].sort()).toEqual(['implemented', 'improved']);
  });
});
