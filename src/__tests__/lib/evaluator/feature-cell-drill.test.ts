/**
 * scan-sweep --challenge (cross-module-features/B): a Features heatmap cell opens
 * the features behind its count — ready vs blocked — and the bottom panel ranks
 * what is buildable now. Pure projection over the statusMap + implementation plan.
 */
import { describe, it, expect } from 'vitest';
import { drillCell, buildableNow } from '@/lib/evaluator/feature-cell-drill';
import { generatePlan, type ImplementationPlan, type PlanItem } from '@/lib/implementation-planner/plan-generator';
import { planDispatch } from '@/lib/implementation-planner/plan-dispatch';
import { unblockFrontier } from '@/lib/topology/unblockFrontier';
import { MODULE_FEATURE_DEFINITIONS } from '@/lib/feature-definitions';

const C = (name: string) => `arpg-combat::${name}`;

/** Melee attack ability + Hit detection are ready (every dep done); Combo system
 *  and GAS damage application wait on a combat feature that is not done. */
const STATUS_MAP = new Map<string, string>([
  ['arpg-gas::Base GameplayAbility', 'improved'],
  ['arpg-animation::Attack montages', 'implemented'],
  ['arpg-animation::Anim Notify classes', 'implemented'],
  [C('Melee attack ability'), 'missing'],
  [C('Hit detection'), 'missing'],
  [C('Combo system'), 'missing'],
  [C('GAS damage application'), 'missing'],
  [C('Death flow'), 'partial'],
  [C('Combat feedback'), 'unknown'],
]);

function fakeItem(key: string, score: number, over: Partial<PlanItem> = {}): PlanItem {
  const [moduleId, featureName] = key.split('::');
  return {
    key,
    moduleId: moduleId as PlanItem['moduleId'],
    featureName,
    category: 'x',
    description: '',
    depth: 0,
    impact: { directUnblocks: 0, transitiveUnblocks: 0, score, directDependents: [] },
    effort: { level: 'small', minutes: 30 } as PlanItem['effort'],
    dependsOn: [],
    isReady: true,
    unmetDeps: [],
    status: 'missing',
    ...over,
  };
}

const fakePlan = (items: PlanItem[]): ImplementationPlan => ({
  items, totalFeatures: items.length, implementedCount: 0, remainingCount: items.length, totalEffortMinutes: 0,
});

describe('drillCell — the features behind one heatmap count', () => {
  it("'missing' on arpg-combat is exactly the combat features whose status is missing", () => {
    const rows = drillCell(STATUS_MAP, 'arpg-combat', 'missing', generatePlan(STATUS_MAP));
    const missingCount = [...STATUS_MAP].filter(([k, s]) => k.startsWith('arpg-combat::') && s === 'missing').length;
    expect(rows).toHaveLength(missingCount);
    expect(rows.map((r) => r.key).sort()).toEqual(
      [C('Combo system'), C('GAS damage application'), C('Hit detection'), C('Melee attack ability')],
    );
    expect(rows.every((r) => r.status === 'missing')).toBe(true);
  });

  it("'unknown' also includes features defined for the module with no status row", () => {
    const rows = drillCell(STATUS_MAP, 'arpg-combat', 'unknown', generatePlan(STATUS_MAP));
    const expected = (MODULE_FEATURE_DEFINITIONS['arpg-combat'] ?? [])
      .map((f) => C(f.featureName))
      .filter((k) => (STATUS_MAP.get(k) ?? 'unknown') === 'unknown');
    expect(expected).toContain(C('Combat feedback'));
    expect(expected).toContain(C('Hit reaction system')); // no row at all
    expect(rows.map((r) => r.key).sort()).toEqual([...expected].sort());
  });

  it('a missing feature whose every dep is done is ready and carries its PlanItem', () => {
    const plan = generatePlan(STATUS_MAP);
    const rows = drillCell(STATUS_MAP, 'arpg-combat', 'missing', plan);
    const hit = rows.find((r) => r.key === C('Hit detection'))!;
    expect(hit.readiness).toBe('ready');
    expect(hit.unmetDeps).toEqual([]);
    expect(hit.frontier).toEqual([]);
    expect(hit.buildItem).toBe(plan.items.find((i) => i.key === C('Hit detection')));
  });

  it('one with an unmet dep is blocked: blockers named, frontier = unblockFrontier, no buildItem', () => {
    const rows = drillCell(STATUS_MAP, 'arpg-combat', 'missing', generatePlan(STATUS_MAP));
    const combo = rows.find((r) => r.key === C('Combo system'))!;
    expect(combo.readiness).toBe('blocked');
    expect(combo.unmetDeps).toEqual([C('Melee attack ability')]);
    expect(combo.frontier).toEqual(unblockFrontier(STATUS_MAP, C('Combo system')));
    expect(combo.frontier).toEqual([C('Melee attack ability')]);
    expect(combo.buildItem).toBeNull();
    const dmg = rows.find((r) => r.key === C('GAS damage application'))!;
    expect(dmg.readiness).toBe('blocked');
    expect(dmg.unmetDeps).toContain(C('Hit detection'));
    expect(dmg.frontier).toEqual(unblockFrontier(STATUS_MAP, C('GAS damage application')));
  });

  it('orders ready before blocked; within ready impact.score desc, then featureName asc', () => {
    const rows = drillCell(STATUS_MAP, 'arpg-combat', 'missing', generatePlan(STATUS_MAP));
    const firstBlocked = rows.findIndex((r) => r.readiness === 'blocked');
    expect(rows.slice(0, firstBlocked).every((r) => r.readiness === 'ready')).toBe(true);
    expect(rows.slice(firstBlocked).every((r) => r.readiness === 'blocked')).toBe(true);

    const two = new Map([[C('Hit detection'), 'missing'], [C('Melee attack ability'), 'missing']]);
    const tie = fakePlan([fakeItem(C('Melee attack ability'), 5), fakeItem(C('Hit detection'), 5)]);
    expect(drillCell(two, 'arpg-combat', 'missing', tie).map((r) => r.featureName))
      .toEqual(['Hit detection', 'Melee attack ability']);
    const ranked = fakePlan([fakeItem(C('Hit detection'), 1), fakeItem(C('Melee attack ability'), 9)]);
    expect(drillCell(two, 'arpg-combat', 'missing', ranked).map((r) => r.featureName))
      .toEqual(['Melee attack ability', 'Hit detection']);
  });
});

describe('buildableNow — the highest-impact ready features across modules', () => {
  it('only ready, not-done items, at most 8, by impact.score desc — each passes planDispatch', () => {
    const plan = generatePlan(STATUS_MAP);
    const top = buildableNow(plan, 8);
    const allReady = plan.items.filter((i) => i.isReady);
    expect(allReady.length).toBeGreaterThan(8);
    expect(top).toHaveLength(8);
    expect(new Set(top.map((i) => i.moduleId)).size).toBeGreaterThan(1);
    for (let i = 1; i < top.length; i++) {
      expect(top[i - 1].impact.score).toBeGreaterThanOrEqual(top[i].impact.score);
    }
    const best = Math.max(...allReady.map((i) => i.impact.score));
    expect(top[0].impact.score).toBe(best);
    for (const item of top) {
      expect(item.isReady).toBe(true);
      expect(planDispatch(item, 'http://localhost:3000').ok).toBe(true);
    }
  });

  it('drops blocked and already-done items even when they score highest', () => {
    const plan = fakePlan([
      fakeItem(C('Combo system'), 99, { isReady: false, unmetDeps: [C('Melee attack ability')] }),
      fakeItem(C('Death flow'), 50, { status: 'implemented' }),
      fakeItem(C('Hit detection'), 3),
      fakeItem('arpg-character::AARPGCharacterBase', 7),
    ]);
    expect(buildableNow(plan, 8).map((i) => i.key)).toEqual(['arpg-character::AARPGCharacterBase', C('Hit detection')]);
    expect(buildableNow(plan, 1)).toHaveLength(1);
  });
});
