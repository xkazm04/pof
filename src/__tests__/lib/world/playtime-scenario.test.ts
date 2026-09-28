import { describe, it, expect } from 'vitest';
import {
  applyLevers, scenarioReducer, EMPTY_SCENARIO, diffVsBaseline, bindingChain,
  type WorldLever,
} from '@/lib/world/playtime-scenario';
import {
  computeZonePlaytime, computeCumulativePath, type ZonePlaytimeEstimate,
} from '@/lib/world/world-model';
import { STATIC_WORLD } from '@/components/modules/core-engine/sub_world/_shared/data';
import {
  allocateZoneBudgets, suggestLevers, buildInterestPoints,
} from '@/components/modules/core-engine/sub_world/playtime/playtime-target';

const byId = (rows: ZonePlaytimeEstimate[]) => new Map(rows.map((r) => [r.zoneId, r]));

describe('allocateZoneBudgets — level-span budgets can single out a zone', () => {
  it('splits 1 h over the critical zones by level span and yields distinct flags', () => {
    const out = allocateZoneBudgets([
      { zoneId: 'z1', levelMin: 1, levelMax: 1, totalSec: 128 },
      { zoneId: 'z2', levelMin: 1, levelMax: 3, totalSec: 604 },
      { zoneId: 'z4', levelMin: 3, levelMax: 5, totalSec: 1186 },
      { zoneId: 'z6', levelMin: 5, levelMax: 7, totalSec: 940 },
    ], 3600);
    expect(out.map((b) => [b.zoneId, b.budgetSec])).toEqual([['z1', 360], ['z2', 1080], ['z4', 1080], ['z6', 1080]]);
    expect(out.map((b) => b.flag)).toEqual(['under', 'under', 'on', 'under']);
    expect(new Set(out.map((b) => b.flag)).size).toBeGreaterThanOrEqual(2);
  });
});

describe('suggestLevers — structured, applicable levers', () => {
  it('first over-budget lever on Bandit Camp is a z4 enemies cut priced at 8 s/enemy, label unchanged', () => {
    const z4: ZonePlaytimeEstimate = {
      zoneId: 'z4', zoneName: 'Bandit Camp', enemyCount: 77, combatMeasured: true,
      combatSec: 616, bossSec: 270, explorationSec: 300, totalSec: 1186,
    };
    const [first] = suggestLevers(z4, 900);
    expect(first).toMatchObject({ zoneId: 'z4', kind: 'enemies' });
    expect(first.amount).toBeLessThan(0);
    const n = -first.amount;
    expect(first.savesSec).toBe(8 * n);
    expect(first.label).toBe(`Drop ${n} enemy spawns`);
  });
});

describe('applyLevers — a pure what-if over the world model', () => {
  const baseline = byId(computeZonePlaytime(STATIC_WORLD));

  it('cutting 10 z4 enemies reprices z4 only', () => {
    const scenario = applyLevers(STATIC_WORLD, [{ zoneId: 'z4', kind: 'enemies', amount: -10 }]);
    const after = byId(computeZonePlaytime(scenario));
    expect(after.get('z4')).toMatchObject({ enemyCount: 67, combatSec: 536, totalSec: 1106 });
    for (const [id, row] of baseline) if (id !== 'z4') expect(after.get(id)).toEqual(row);
  });

  it('the critical total moves by the saved seconds on-path, not off-path', () => {
    const onPath = applyLevers(STATIC_WORLD, [{ zoneId: 'z4', kind: 'enemies', amount: -10 }]);
    expect(computeCumulativePath(onPath, 'critical').totalSec).toBeCloseTo(2783.4, 6);
    const offPath = applyLevers(STATIC_WORLD, [{ zoneId: 'z3', kind: 'enemies', amount: -10 }]);
    expect(computeCumulativePath(offPath, 'critical').totalSec).toBeCloseTo(2863.4, 6);
    expect(diffVsBaseline(STATIC_WORLD, onPath, 'critical').totalDeltaSec).toBeCloseTo(-80, 6);
  });

  it('cutting a Ruined Keep boss phase lowers its boss time and its interest-curve intensity', () => {
    const scenario = applyLevers(STATIC_WORLD, [{ zoneId: 'z6', kind: 'bossPhases', amount: -1 }]);
    expect(byId(computeZonePlaytime(scenario)).get('z6')!.bossSec).toBe(270);
    expect(baseline.get('z6')!.bossSec).toBe(360);
    const base = buildInterestPoints(STATIC_WORLD, 'critical').find((p) => p.zoneId === 'z6')!;
    const next = buildInterestPoints(scenario, 'critical').find((p) => p.zoneId === 'z6')!;
    expect(base.intensity).toBeCloseTo(1, 2);
    expect(next.intensity).toBeLessThan(base.intensity);
  });

  it('the binding chain is the zone sequence that sets the path total', () => {
    expect(bindingChain(computeCumulativePath(STATIC_WORLD, 'critical'))).toEqual(['z1', 'z2', 'z4', 'z6']);
    expect(bindingChain(computeCumulativePath(STATIC_WORLD, 'all'))).toEqual(['z1', 'z2', 'z-ashen', 'z4', 'z6']);
  });
});

describe('scenarioReducer — Try / Undo / Reset', () => {
  const L: WorldLever = { zoneId: 'z4', kind: 'enemies', amount: -10 };

  it('toggle twice undoes back to the baseline world', () => {
    const once = scenarioReducer(EMPTY_SCENARIO, { type: 'toggle', lever: L });
    expect(once.applied).toEqual([L]);
    const twice = scenarioReducer(once, { type: 'toggle', lever: { ...L } });
    expect(twice.applied).toEqual([]);
    expect(applyLevers(STATIC_WORLD, twice.applied)).toEqual(STATIC_WORLD);
  });

  it('three distinct levers then reset clears the scenario', () => {
    let s = EMPTY_SCENARIO;
    for (const lever of [L, { zoneId: 'z6', kind: 'bossPhases', amount: -1 }, { zoneId: 'z2', kind: 'sideBeat', amount: 120 }] as WorldLever[]) {
      s = scenarioReducer(s, { type: 'toggle', lever });
    }
    expect(s.applied).toHaveLength(3);
    expect(scenarioReducer(s, { type: 'reset' }).applied).toEqual([]);
  });
});
