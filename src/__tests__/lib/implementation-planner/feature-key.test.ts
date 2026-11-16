/**
 * scan-sweep night 2026-11-08 (core-engine-planning-shell, tech-debt-tracker):
 * the `moduleId::featureName` key was re-split by hand in 8 places across the
 * plan UI (4 copies of `key.slice(key.indexOf('::') + 2)` and 4 split sites).
 * plan-generator now owns the format; the plan UI must not re-parse it.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { splitFeatureKey, featureKeyName } from '@/lib/implementation-planner/plan-generator';

describe('splitFeatureKey / featureKeyName', () => {
  it('splits at the first :: only', () => {
    expect(splitFeatureKey('arpg-combat::Combo system')).toEqual({ moduleId: 'arpg-combat', featureName: 'Combo system' });
    expect(splitFeatureKey('arpg-combat::Combo::Finisher')).toEqual({ moduleId: 'arpg-combat', featureName: 'Combo::Finisher' });
    expect(featureKeyName('arpg-combat::Combo::Finisher')).toBe('Combo::Finisher');
  });

  it('returns a key with no :: whole instead of dropping its first character', () => {
    expect(featureKeyName('Combo system')).toBe('Combo system');
    expect(splitFeatureKey('Combo system').moduleId).toBe('');
  });
});

describe('plan UI does not re-parse the feature key', () => {
  const FILES = [
    'src/hooks/usePlanDispatch.ts',
    'src/components/modules/core-engine/ImplementationPlan/useBuildSession.ts',
    'src/components/modules/core-engine/ImplementationPlan/BuildSessionPanel.tsx',
    'src/components/modules/core-engine/ImplementationPlan/PlanItemRow.tsx',
    'src/components/modules/core-engine/PlanMatrixMap/DetailPanel.tsx',
  ];
  it("has 0 indexOf('::') / split('::') sites", () => {
    const hits = FILES.filter((f) => /indexOf\('::'\)|split\('::'\)/.test(readFileSync(join(process.cwd(), f), 'utf-8')));
    expect(hits).toEqual([]);
  });
});
