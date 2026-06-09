import { describe, it, expect } from 'vitest';
import {
  CORE_MODULE_DEFS,
  CORE_CHECKLIST_TOTAL,
  ALL_CHECKLIST_TOTAL,
  SUB_MODULES,
  SUB_MODULE_MAP,
  MODULE_LABELS,
  ARPG_SUB_MODULES,
} from '@/lib/module-registry';
import { computeProjectHealth } from '@/lib/health-engine';

/**
 * Single-source-of-truth guard. The health engine used to hardcode a 12-module
 * list with per-module checklist counts; it now derives them from SUB_MODULES via
 * CORE_MODULE_DEFS. These tests fail if a future registry edit silently drifts the
 * derived module list, labels, or X/Y denominator.
 */
describe('CORE_MODULE_DEFS — derived from SUB_MODULES', () => {
  it('covers exactly the core-engine modules, excluding the plan pseudo-module', () => {
    const expected = ARPG_SUB_MODULES.filter((m) => !m.isSpecialItem).map((m) => m.id);
    expect(CORE_MODULE_DEFS.map((m) => m.id)).toEqual(expected);
    expect(CORE_MODULE_DEFS.map((m) => m.id)).not.toContain('core-engine-plan');
  });

  it('takes its label and checklist count from the registry definition (no hardcoded copy)', () => {
    for (const def of CORE_MODULE_DEFS) {
      const mod = SUB_MODULE_MAP[def.id as keyof typeof SUB_MODULE_MAP];
      expect(mod).toBeDefined();
      expect(def.label).toBe(mod!.label);
      expect(def.label).toBe(MODULE_LABELS[def.id]);
      expect(def.checklistCount).toBe(mod!.checklist?.length ?? 0);
    }
  });

  it('CORE_CHECKLIST_TOTAL is the live sum of core-module checklist lengths', () => {
    const sum = ARPG_SUB_MODULES
      .filter((m) => !m.isSpecialItem)
      .reduce((s, m) => s + (m.checklist?.length ?? 0), 0);
    expect(CORE_CHECKLIST_TOTAL).toBe(sum);
    expect(CORE_CHECKLIST_TOTAL).toBeGreaterThan(0);
  });

  it('ALL_CHECKLIST_TOTAL is the live sum across every module and spans the core total', () => {
    const sum = SUB_MODULES.reduce((s, m) => s + (m.checklist?.length ?? 0), 0);
    expect(ALL_CHECKLIST_TOTAL).toBe(sum);
    // The project-wide denominator includes the core modules and then some.
    expect(ALL_CHECKLIST_TOTAL).toBeGreaterThanOrEqual(CORE_CHECKLIST_TOTAL);
  });
});

describe('computeProjectHealth uses the derived totals', () => {
  it('reports the registry-derived denominator and labels', () => {
    const health = computeProjectHealth({}, [], null);

    expect(health.totalChecklistItems).toBe(CORE_CHECKLIST_TOTAL);
    expect(health.moduleHealth).toHaveLength(CORE_MODULE_DEFS.length);

    for (const card of health.moduleHealth) {
      // Labels flow from the single owner, not a private copy.
      expect(card.label).toBe(MODULE_LABELS[card.moduleId]);
    }
  });

  it('keeps completion in sync with the derived denominator when items are checked', () => {
    const firstDef = CORE_MODULE_DEFS[0];
    const progress = {
      [firstDef.id]: { 'item-a': true, 'item-b': true },
    };
    const health = computeProjectHealth(progress, [], null);

    expect(health.completedChecklistItems).toBe(2);
    expect(health.overallCompletion).toBe(
      Math.round((2 / CORE_CHECKLIST_TOTAL) * 100),
    );
  });
});
