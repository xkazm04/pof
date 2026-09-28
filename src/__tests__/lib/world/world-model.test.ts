import { describe, it, expect } from 'vitest';
import {
  computeZonePlaytime, computeCumulativePath, worldFromZones,
  type WorldModel, type ZonePlaytimeEstimate,
} from '@/lib/world/world-model';
import { STATIC_WORLD } from '@/components/modules/core-engine/sub_world/_shared/data';
import { getZoneStats, buildZoneComparisons } from '@/components/modules/core-engine/sub_world/_shared/helpers';
import { suggestLevers } from '@/components/modules/core-engine/sub_world/playtime/playtime-target';
import { generateZoneGraph } from '@/lib/world/zone-graph-generator';

const byId = (rows: ZonePlaytimeEstimate[]) => Object.fromEntries(rows.map((r) => [r.zoneId, r]));
const KOTOR = ['z-tatooine', 'z-nar-shaddaa', 'z-kashyyyk', 'z-korriban', 'z-malachor'];

describe('world-model — computeZonePlaytime', () => {
  it('[guard] reproduces today\'s figures for every zone with density data', () => {
    const pt = byId(computeZonePlaytime(STATIC_WORLD));
    const expected: Record<string, [number, number, number, number, number]> = {
      z1: [1, 8, 0, 120, 128],
      z2: [38, 304, 0, 300, 604],
      z3: [58, 464, 180, 300, 944],
      z4: [77, 616, 270, 300, 1186],
      z5: [85, 680, 180, 300, 1160],
      z6: [50, 400, 360, 180, 940],
      'z-ashen': [38, 304, 0, 300, 604],
    };
    for (const [id, [enemies, combat, boss, expl, total]] of Object.entries(expected)) {
      expect(pt[id], id).toMatchObject({
        enemyCount: enemies, combatSec: combat, bossSec: boss, explorationSec: expl, totalSec: total, combatMeasured: true,
      });
    }
  });

  it('reports the five KOTOR zones as combat-not-measured, not as 0 enemies', () => {
    const pt = byId(computeZonePlaytime(STATIC_WORLD));
    for (const id of KOTOR) {
      expect(pt[id].enemyCount, id).toBeNull();
      expect(pt[id].combatMeasured, id).toBe(false);
      expect(pt[id].combatSec, id).toBe(0);
    }
  });

  it('is keyed by zone id, not by row order (reversing the zones changes nothing)', () => {
    const reversed: WorldModel = { ...STATIC_WORLD, zones: [...STATIC_WORLD.zones].reverse() };
    expect(byId(computeZonePlaytime(reversed))).toEqual(byId(computeZonePlaytime(STATIC_WORLD)));
  });

  it('threads one cost table through the estimate and the lever sizing', () => {
    const costs = { secPerEnemy: 10, secPerBossPhase: 90 };
    const z4 = byId(computeZonePlaytime(STATIC_WORLD, costs)).z4;
    expect(z4.combatSec).toBe(770);
    const drop = suggestLevers(z4, 900, costs).find((l) => l.label.startsWith('Drop'));
    expect(drop).toBeDefined();
    expect(drop!.savesSec % 10).toBe(0);
  });
});

describe('world-model — computeCumulativePath', () => {
  it('walks from every hub, so the KOTOR cluster is on the critical path', () => {
    const p = computeCumulativePath(STATIC_WORLD, 'critical');
    expect(p.roots).toEqual(['z1', 'z-tatooine']);
    const ids = p.nodes.map((n) => n.zoneId);
    for (const id of KOTOR) expect(ids, id).toContain(id);
    expect(p.nodes.find((n) => n.zoneId === 'z-malachor')!.cumulativeSec).toBeCloseTo(1929.2, 6);
    expect(p.totalSec).toBeCloseTo(2863.4, 6);
  });

  it('terminates on a cyclic graph and counts each zone once', () => {
    const world: WorldModel = {
      zones: [
        { id: 'A', name: 'A', type: 'hub', levelMin: 1, levelMax: 1 },
        { id: 'B', name: 'B', type: 'combat', levelMin: 1, levelMax: 2 },
        { id: 'C', name: 'C', type: 'combat', levelMin: 2, levelMax: 3 },
      ],
      edges: [
        { fromId: 'A', toId: 'B', transitionSec: 0, criticalPath: true },
        { fromId: 'B', toId: 'A', transitionSec: 0, criticalPath: true },
        { fromId: 'B', toId: 'C', transitionSec: 0, criticalPath: true },
      ],
      enemiesByZoneId: {},
      bossPhasesByZoneId: {},
      explorationSecByZoneId: { A: 100, B: 100, C: 100 },
    };
    const p = computeCumulativePath(world, 'critical');
    expect(p.nodes.map((n) => n.zoneId)).toEqual(['A', 'B', 'C']);
    expect(p.nodes.find((n) => n.zoneId === 'C')!.cumulativeSec).toBe(300);
    expect(p.totalSec).toBe(300);
  });

  it('prices a generated candidate through worldFromZones', () => {
    const zones = generateZoneGraph({ zoneCount: 4, topology: 'linear', branchiness: 0, difficulty: 'linear', maxLevel: 30, seed: 1 });
    const world = worldFromZones(zones);
    const p = computeCumulativePath(world, 'critical');
    expect(p.nodes.map((n) => n.zoneId)).toEqual(['g0', 'g1', 'g2', 'g3']);
    expect(p.totalSec).toBe(900);
    expect(computeZonePlaytime(world).every((z) => z.combatMeasured === false)).toBe(true);
  });
});

describe('world-model — zone stats consumers', () => {
  it('[guard] getZoneStats / buildZoneComparisons read the same numbers as today', () => {
    const bandit = getZoneStats('Bandit Camp');
    expect(bandit.enemyCount).toBe(77);
    expect(bandit.bossPhases).toBe(3);
    expect(buildZoneComparisons('Sanctuary', 'Crystal Caves')).toEqual([
      { stat: 'Enemy Count', valueA: 1, valueB: 58, higherIsBetter: false },
      { stat: 'POI Count', valueA: 6, valueB: 8, higherIsBetter: true },
      { stat: 'Discovery', valueA: 100, valueB: 40, unit: '%', higherIsBetter: true },
      { stat: 'Danger Score', valueA: 0, valueB: 3.05, higherIsBetter: false },
      { stat: 'Level Min', valueA: 1, valueB: 2 },
      { stat: 'Level Max', valueA: 1, valueB: 4 },
      { stat: 'Boss Phases', valueA: 0, valueB: 2 },
      { stat: 'Hazard Count', valueA: 0, valueB: 2, higherIsBetter: false },
      { stat: 'Hazard DPS', valueA: 0, valueB: 40, unit: 'dps', higherIsBetter: false },
    ]);
  });
});
