import { describe, it, expect } from 'vitest';
import {
  nearestFloorCell,
  planSpawns,
} from '@/components/modules/content/level-design/ProceduralLevelWizard/spawnPlacement';
import {
  buildExportPlan,
  countExportObjects,
  describeExportPlan,
  describeSpawnPlacement,
  scalePercent,
  MAX_EXPORT_SIZE,
} from '@/components/modules/content/level-design/ProceduralLevelWizard/exportPlan';
import {
  FLOOR_CELL_TYPES,
  type CellType,
} from '@/lib/blender-mcp/scripts/dungeon-to-geometry';
import { generatePreview } from '@/lib/level-design/procgen-preview';
import type { GameplayConstraints } from '@/components/modules/content/level-design/ProceduralLevelWizard/types';

const FLOOR = new Set<CellType>(FLOOR_CELL_TYPES);

const ALL_ON: GameplayConstraints = {
  spawnPoints: true,
  lootPlacement: true,
  bossRoom: true,
  secretRooms: false,
  safeZones: false,
};

/** Parse a compact ASCII grid: `#` wall, `.` floor, ` ` empty, `+` door, `-` corridor. */
function gridOf(...rows: string[]): CellType[][] {
  const map: Record<string, CellType> = {
    '#': 'wall',
    '.': 'floor',
    ' ': 'empty',
    '+': 'door',
    '-': 'corridor',
  };
  return rows.map((r) => Array.from(r).map((ch) => map[ch] ?? 'empty'));
}

/**
 * 5x5 with only the centre column walkable. The player (1,1) and boss (3,3)
 * anchors are solid rock; the loot anchor (2,2) is floor — so this separates a
 * genuine off-wall move from an unmoved marker.
 */
const WALL_ANCHORS_GRID = gridOf('#####', '##.##', '##.##', '##.##', '#####');

describe('nearestFloorCell finds the closest walkable cell', () => {
  it('returns the anchor itself when it is already walkable', () => {
    const grid = gridOf('...', '...', '...');
    expect(nearestFloorCell(grid, 1, 1)).toEqual({ col: 1, row: 1 });
  });

  it('steps off a wall onto the adjacent floor', () => {
    const grid = gridOf('###', '#.#', '###');
    expect(nearestFloorCell(grid, 0, 0)).toEqual({ col: 1, row: 1 });
  });

  it('accepts doors and corridors as walkable, matching the geometry script', () => {
    expect(nearestFloorCell(gridOf('###', '#+#', '###'), 0, 0)).toEqual({ col: 1, row: 1 });
    expect(nearestFloorCell(gridOf('###', '#-#', '###'), 0, 0)).toEqual({ col: 1, row: 1 });
  });

  it('never returns a cell farther than a closer walkable one', () => {
    // Floor at (1,4) is Chebyshev distance 3 from (4,4); floor at (4,0) is 4.
    const grid = gridOf('####.', '#####', '#####', '#####', '#.###');
    const found = nearestFloorCell(grid, 4, 4)!;
    expect(found).toEqual({ col: 1, row: 4 });
  });

  it('clamps an out-of-bounds anchor instead of failing', () => {
    const grid = gridOf('..', '..');
    expect(nearestFloorCell(grid, 99, -5)).toEqual({ col: 1, row: 0 });
  });

  it('skips occupied cells so two markers never stack', () => {
    const grid = gridOf('###', '#.#', '#.#');
    expect(nearestFloorCell(grid, 1, 1, new Set(['1,1']))).toEqual({ col: 1, row: 2 });
  });

  it('returns null when nothing in the grid is walkable', () => {
    expect(nearestFloorCell(gridOf('###', '###'), 1, 1)).toBeNull();
    expect(nearestFloorCell([], 0, 0)).toBeNull();
  });
});

describe('planSpawns puts every marker on a real floor cell', () => {
  it('keeps the intended anchor when it is already floor', () => {
    const grid = gridOf('....', '....', '....', '....');
    const { spawns } = planSpawns(grid, ALL_ON, 2);
    const player = spawns.find((s) => s.type === 'player')!;
    expect([player.col, player.row]).toEqual([1, 1]);
    expect(player.snapped).toBe(false);
    // World coordinates are the cell's own position under the geometry script's
    // `x = col * cell_size` / `y = row * cell_size`.
    expect([player.x, player.y]).toEqual([2, 2]);
  });

  it('moves a marker off a wall and reports that it moved', () => {
    // 5x5, only the centre column walkable. Anchors are player (1,1), boss
    // (3,3), loot (2,2) — the first two start in solid rock.
    const grid = WALL_ANCHORS_GRID;
    const { spawns } = planSpawns(grid, ALL_ON, 2);
    for (const s of spawns) {
      expect(FLOOR.has(grid[s.row][s.col])).toBe(true);
    }
    expect(spawns.some((s) => s.moveReason === 'off-wall' && s.movedBy > 0)).toBe(true);
  });

  it('distinguishes "moved off a wall" from "moved out of another marker\'s way"', () => {
    // All floor, so nothing was ever on rock — but boss (w-2,h-2) and loot
    // (centre) both want (2,2) on a 4x4, so one of them is bumped. Reporting
    // that as a wall would invent terrain the layout does not have.
    const grid = gridOf('....', '....', '....', '....');
    const { spawns } = planSpawns(grid, ALL_ON, 2);
    expect(spawns.some((s) => s.moveReason === 'occupied')).toBe(true);
    expect(spawns.every((s) => s.moveReason !== 'off-wall')).toBe(true);
  });

  it('never stacks two markers on the same cell', () => {
    const grid = gridOf('###', '#.#', '#.#');
    const { spawns } = planSpawns(grid, ALL_ON, 2);
    const keys = spawns.map((s) => `${s.col},${s.row}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('reports what it could not place instead of dropping it silently', () => {
    const { spawns, unplaced } = planSpawns(gridOf('###', '###'), ALL_ON, 2);
    expect(spawns).toHaveLength(0);
    expect(unplaced.map((u) => u.type).sort()).toEqual(['boss', 'loot', 'player']);
    for (const u of unplaced) expect(u.reason).toMatch(/walkable/);
  });

  it('places only the markers whose constraint is enabled', () => {
    const grid = gridOf('....', '....', '....', '....');
    const { spawns } = planSpawns(
      grid,
      { ...ALL_ON, bossRoom: false, lootPlacement: false },
      2,
    );
    expect(spawns.map((s) => s.type)).toEqual(['player']);
  });

  it('lands on floor for every algorithm across many seeds (property walk)', () => {
    // The real defect: anchors were corner/corner/centre with no floor check,
    // and every generator here carves rooms out of solid rock — so a corner is a
    // wall far more often than not. This walks real generated layouts.
    let everSnapped = false;
    for (const algorithm of ['bsp', 'cellular', 'wfc', 'perlin'] as const) {
      for (let s = 0; s < 12; s++) {
        const { grid } = generatePreview({
          algorithm,
          gridWidth: 64,
          gridHeight: 64,
          roomCountMin: 6,
          roomCountMax: 12,
          corridorWidth: 3,
          seed: `seed-${s}`,
        });
        const { spawns, unplaced } = planSpawns(grid, ALL_ON, 2);
        expect(unplaced).toHaveLength(0);
        expect(spawns).toHaveLength(3);
        for (const sp of spawns) {
          expect(
            FLOOR.has(grid[sp.row][sp.col]),
            `${algorithm} seed-${s}: ${sp.type} landed on ${grid[sp.row][sp.col]}`,
          ).toBe(true);
        }
        if (spawns.some((sp) => sp.snapped)) everSnapped = true;
      }
    }
    // …and the guard is not vacuous: the old fixed anchors really were off-floor
    // in at least some of these layouts.
    expect(everSnapped).toBe(true);
  });
});

describe('buildExportPlan states what will actually ship', () => {
  const grid = gridOf('##.', '.#.', '...');

  it('counts one Blender object per floor and per wall cell, none for empty', () => {
    expect(countExportObjects(gridOf('#. ', ' .#'))).toBe(4);
    expect(countExportObjects(gridOf('   ', '   '))).toBe(0);
  });

  it('reports full size when the exported grid matches the request', () => {
    const plan = buildExportPlan({
      algorithm: 'bsp',
      requestedWidth: 3,
      requestedHeight: 3,
      grid,
      scale: 1,
      seedLabel: 'x',
      seedValue: 7,
    });
    expect(plan.isFullSize).toBe(true);
    expect([plan.width, plan.height]).toEqual([3, 3]);
    expect(describeExportPlan(plan)).toMatch(/full requested size/);
  });

  it('names the requested size AND the scale when it downscaled', () => {
    const plan = buildExportPlan({
      algorithm: 'perlin',
      requestedWidth: 512,
      requestedHeight: 512,
      grid,
      scale: 3 / 512,
      seedLabel: '',
      seedValue: 1,
    });
    expect(plan.isFullSize).toBe(false);
    const text = describeExportPlan(plan);
    expect(text).toMatch(/3x3/);
    expect(text).toMatch(/DOWNSCALED/);
    expect(text).toMatch(/512x512/);
    expect(text).toMatch(new RegExp(`${MAX_EXPORT_SIZE}`));
    expect(scalePercent(plan)).toBe('1%');
  });

  it('flags a heavy export by object count', () => {
    const big = Array.from({ length: 200 }, () => new Array<CellType>(200).fill('floor'));
    const plan = buildExportPlan({
      algorithm: 'bsp',
      requestedWidth: 200,
      requestedHeight: 200,
      grid: big,
      scale: 1,
      seedLabel: '',
      seedValue: 1,
    });
    expect(plan.objectCount).toBe(40_000);
    expect(plan.isHeavy).toBe(true);
  });
});

describe('describeSpawnPlacement says where the markers went', () => {
  it('states a clean placement with no invented wall', () => {
    // 8x8 all floor: every anchor is distinct and walkable.
    const grid = gridOf(...Array.from({ length: 8 }, () => '........'));
    const text = describeSpawnPlacement(planSpawns(grid, ALL_ON, 2));
    expect(text).toBe('3 spawn markers on floor cells.');
  });

  it('names the markers it had to move off a wall', () => {
    const text = describeSpawnPlacement(planSpawns(WALL_ANCHORS_GRID, ALL_ON, 2));
    expect(text).toMatch(/Moved off a wall: player \+1, boss \+1\./);
  });

  it('reports an occupancy nudge as such, not as a wall', () => {
    const grid = gridOf('....', '....', '....', '....');
    const text = describeSpawnPlacement(planSpawns(grid, ALL_ON, 2));
    expect(text).toMatch(/Moved to avoid another marker/);
    expect(text).not.toMatch(/wall/);
  });

  it('names what it could not place at all', () => {
    const text = describeSpawnPlacement(planSpawns(gridOf('###', '###'), ALL_ON, 2));
    expect(text).toMatch(/No player marker/);
    expect(text).toMatch(/No boss marker/);
  });
});
