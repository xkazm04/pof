import { describe, it, expect } from 'vitest';
import { calculateXpForLevel, COMPARISON_LEVELS } from '@/components/modules/core-engine/sub_progression/_shared/data';
import * as data from '@/components/modules/core-engine/sub_progression/_shared/data';
import { cumulativeMinutes, pacingModel } from '@/components/modules/core-engine/sub_progression/_shared/rewardPacing';
import { generateProgressionTable } from '@/components/modules/core-engine/sub_progression/_internals/XpTableGenerator/helpers';
import { curveDelta, curveTotals } from '@/components/modules/core-engine/sub_progression/_shared/curveModel';

describe('curveModel: one curve model over the XP law + the Rewards clock', () => {
  it('case 1: curveTotals(100, 1.5) reports the export total and the Rewards-clock hours', () => {
    const t = curveTotals(100, 1.5);
    let sum = 0;
    for (let L = 1; L <= 50; L++) sum += calculateXpForLevel(L, 100, 1.5);
    expect(t.totalXp).toBe(724849);
    expect(t.totalXp).toBe(sum);
    expect(t.totalXp).toBe(generateProgressionTable(50, 100, 1.5, 10, 5, 3, new Map()).at(-1)!.xpTotal);
    // cumulative XP per level is the export's XPTotal column, level by level
    const table = generateProgressionTable(50, 100, 1.5, 10, 5, 3, new Map());
    table.forEach((row) => expect(t.cumulativeXp[row.level]).toBe(row.xpTotal));
    expect(t.hoursToMax).toBeCloseTo(cumulativeMinutes(pacingModel(100, 1.5))[50] / 60, 10);
    expect(t.hoursToMax).toBeCloseTo(3.984, 3);
    // the hand-typed second milestone list is gone from the module data
    expect('ABILITY_UNLOCKS' in data).toBe(false);
  });

  it('case 4: curveDelta(100/1.5 -> 200/1.5) has 5 rows at the comparison levels, each ~+100%', () => {
    const d = curveDelta({ baseXp: 100, curveExp: 1.5 }, { baseXp: 200, curveExp: 1.5 });
    expect(d.rows).toHaveLength(5);
    expect(d.rows.map((r) => r.level)).toEqual([...COMPARISON_LEVELS]);
    expect(d.rows.map((r) => r.level)).toEqual([10, 20, 30, 40, 50]);
    d.rows.forEach((r) => expect(Math.abs(r.pct - 100)).toBeLessThanOrEqual(0.5));
    expect(d.snapshot.totalXp).toBe(724849);
    expect(d.live.totalXp).toBe(1449717);
    expect(d.live.hoursToMax).toBeCloseTo(7.968, 3);
  });
});
