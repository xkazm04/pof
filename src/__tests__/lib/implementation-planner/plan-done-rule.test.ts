/**
 * scan-sweep --challenge (core-engine-planning-shell/A): the planner counts a
 * feature as done by the repo's ONE done rule, `isFeatureDone` (implemented OR
 * improved) — the rule unblockFrontier, moduleGraph and the constellation use.
 *
 * The plan's own Build dispatches a feature-fix task whose callback PATCHes
 * `status: 'improved'`; before this change the planner only counted
 * 'implemented', so a feature Claude just built stayed in the plan as item #1,
 * 'Ready', its dependents stayed blocked and implementedCount never moved.
 */
import { describe, it, expect } from 'vitest';
import { MODULE_FEATURE_DEFINITIONS, buildDependencyMap } from '@/lib/feature-definitions';
import { generatePlan } from '@/lib/implementation-planner/plan-generator';
import { unblockFrontier, criticalUnblocker } from '@/lib/topology/unblockFrontier';
import { isFeatureDone } from '@/lib/constellation/layout';
import type { FeatureStatus } from '@/types/feature-matrix';

const depMap = buildDependencyMap();
const allKeys = Object.entries(MODULE_FEATURE_DEFINITIONS).flatMap(([m, fs]) =>
  fs.map((f) => `${m}::${f.featureName}`),
);
/** Dependency-free features — the graph's roots. */
const roots = allKeys.filter((k) => (depMap.get(k)?.deps.length ?? 0) === 0);
const rootsAs = (status: string) => new Map(roots.map((k) => [k, status]));

describe('generatePlan — one done rule (isFeatureDone)', () => {
  it("a feature marked 'improved' leaves the plan and counts as implemented", () => {
    const key = 'arpg-character::AARPGCharacterBase';
    const plan = generatePlan(new Map([[key, 'improved']]));
    expect(plan.items.map((i) => i.key)).not.toContain(key);
    expect(plan.implementedCount).toBe(1);
  });

  it("improved roots produce the same plan as implemented roots: 180 items, 81 ready", () => {
    expect(roots).toHaveLength(60);
    const improved = generatePlan(rootsAs('improved'));
    const implemented = generatePlan(rootsAs('implemented'));
    expect(improved.items).toHaveLength(180);
    expect(improved.items.filter((i) => i.isReady)).toHaveLength(81);
    expect(improved.implementedCount).toBe(60);
    expect(improved.items.map((i) => [i.key, i.isReady])).toEqual(
      implemented.items.map((i) => [i.key, i.isReady]),
    );
  });

  it('planner readiness equals the Dependencies-tab topology readiness (unblockFrontier)', () => {
    const statusMap = rootsAs('improved');
    const planReady = new Set(generatePlan(statusMap).items.filter((i) => i.isReady).map((i) => i.key));
    const topologyReady = new Set(
      allKeys.filter((k) => {
        if (isFeatureDone((statusMap.get(k) ?? 'unknown') as FeatureStatus)) return false;
        const frontier = unblockFrontier(statusMap, k);
        return frontier.length === 1 && frontier[0] === k;
      }),
    );
    expect([...planReady].sort()).toEqual([...topologyReady].sort());
  });

  it("the Dependencies tab's critical build is a Ready plan item", () => {
    const statusMap = rootsAs('improved');
    const critical = criticalUnblocker(statusMap);
    expect(critical).toBe('arpg-inventory::UARPGItemInstance');
    const item = generatePlan(statusMap).items.find((i) => i.key === critical);
    expect(item).toBeDefined();
    expect(item!.isReady).toBe(true);
  });

  it("a blocked item names its not-done prerequisites in unmetDeps", () => {
    const plan = generatePlan(new Map());
    const blocked = plan.items.find((i) => !i.isReady)!;
    expect(blocked.unmetDeps.length).toBeGreaterThan(0);
    expect(blocked.unmetDeps.every((d) => blocked.dependsOn.includes(d))).toBe(true);
    for (const ready of plan.items.filter((i) => i.isReady)) expect(ready.unmetDeps).toEqual([]);
  });
});
