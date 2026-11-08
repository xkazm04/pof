import { describe, it, expect } from 'vitest';
import { buildBudgetReport } from '@/components/modules/core-engine/sub_world/playtime/playtime-target';
import { STATIC_WORLD } from '@/components/modules/core-engine/sub_world/_shared/data';
import { applyLevers, isLeverApplied, type WorldLever } from '@/lib/world/playtime-scenario';

const MIN = 60;

describe('buildBudgetReport: an applied lever stays undoable', () => {
  it('keeps the applied lever on its row after the target (and so its sizing) moves', () => {
    const first = buildBudgetReport(STATIC_WORLD, STATIC_WORLD, 'critical', 45 * MIN, []);
    const l = first.rows.find((r) => r.zoneId === 'z4')!.levers[0];
    const lever: WorldLever = { zoneId: l.zoneId, kind: l.kind, amount: l.amount };
    const scenario = applyLevers(STATIC_WORLD, [lever]);

    const moved = buildBudgetReport(scenario, STATIC_WORLD, 'critical', 35 * MIN, [lever]);
    const row = moved.rows.find((r) => r.zoneId === 'z4')!;
    expect(row.levers.some((x) => isLeverApplied([lever], x))).toBe(true);
  });

  it('[control] adds no lever when nothing is applied', () => {
    const report = buildBudgetReport(STATIC_WORLD, STATIC_WORLD, 'critical', 35 * MIN, []);
    for (const row of report.rows) expect(row.levers.length).toBeLessThanOrEqual(3);
  });
});
