/**
 * The connectivity repair pass: does it actually connect, does it stay
 * deterministic, and does it stay OFF by default?
 *
 * Registry standard: `game-production/procedural-level-planning` —
 * "one control surface, several backends, one honest matrix"
 * (algorithm-parameter-support-matrix, declare-what-each-engine-ignores) and
 * "the plan is a graph, and a graph can be linted" (pacing-linter-rules: an
 * unreachable room is a correctness bug, and the lint must say what it changed).
 */
import { describe, it, expect } from 'vitest';
import { generatePreview, type PreviewConfig } from '@/lib/level-design/procgen-preview';
import {
  labelRegions, ensureConnectedPass, describeConnectPass, MIN_REGION_CELLS,
} from '@/lib/level-design/procgen-connect';
import { FRandomStream, hashSeed } from '@/lib/level-design/frandom-stream';
import { ensureConnectedSupport } from '@/lib/level-design/algo-params';
import type { CellType } from '@/lib/blender-mcp/scripts/dungeon-to-geometry';

/**
 * A cellular seed that comes out in THREE pieces at 32x32: one main cave, one
 * substantial 37-cell region (which must be tunneled to) and one 2-cell pocket
 * (which must be culled). Found by scanning seeds 1-400 across six grid sizes —
 * it is the one fixture that exercises both halves of the pass.
 */
const FRAGMENTED: PreviewConfig = {
  algorithm: 'cellular',
  gridWidth: 32,
  gridHeight: 32,
  roomCountMin: 8,
  roomCountMax: 15,
  corridorWidth: 3,
  seed: '149',
};

const cfg = (over: Partial<PreviewConfig> = {}): PreviewConfig => ({ ...FRAGMENTED, ...over });

function gridKey(grid: CellType[][]): string {
  return grid.map((row) => row.join('')).join('\n');
}

describe('the fixture really is broken today (the RED half)', () => {
  it('cellular seed 149 at 32x32 leaves unreachable floor when the pass is off', () => {
    const p = generatePreview(cfg());
    expect(p.stats.regions).toBeGreaterThan(1);
    expect(p.stats.connectivity).toBeLessThan(1);
    // …and the stats say nothing about a pass, because none was asked for.
    expect(p.stats.connectPass).toBeNull();
  });

  it('has both a cull-sized pocket and a tunnel-sized region, so both halves run', () => {
    const p = generatePreview(cfg());
    const sizes = labelRegions(p.grid, p.width, p.height).sizes.slice().sort((a, b) => b - a);
    expect(sizes.length).toBe(3);
    expect(sizes[1]).toBeGreaterThanOrEqual(MIN_REGION_CELLS); // tunneled
    expect(sizes[2]).toBeLessThan(MIN_REGION_CELLS); // culled
  });
});

describe('ensureConnected repairs the layout', () => {
  it('turns the same seed into ONE reachable region', () => {
    const p = generatePreview(cfg({ ensureConnected: true }));
    expect(p.stats.regions).toBe(1);
    expect(p.stats.connectivity).toBe(1);
  });

  it('never reports connectivity 1 without saying how it got there', () => {
    const { stats } = generatePreview(cfg({ ensureConnected: true }));
    const pass = stats.connectPass;
    expect(pass).not.toBeNull();
    expect(pass!.applied).toBe(true);
    expect(pass!.regionsBefore).toBe(3);
    expect(pass!.regionsAfter).toBe(1);
    expect(pass!.regionsCulled).toBe(1);
    expect(pass!.cellsCulled).toBeGreaterThan(0);
    expect(pass!.tunnelsCarved).toBe(1);
    expect(pass!.cellsCarved).toBeGreaterThan(0);
    expect(pass!.cellsChanged).toBe(pass!.cellsCulled + pass!.cellsCarved);
    const line = describeConnectPass(pass!);
    expect(line).toMatch(/3 regions → 1/);
    expect(line).toMatch(/culled 1 pocket/);
    expect(line).toMatch(/carved 1 tunnel/);
  });

  it('adds passable cells rather than deleting the disconnected ones wholesale', () => {
    const before = generatePreview(cfg());
    const after = generatePreview(cfg({ ensureConnected: true }));
    // The 37-cell region survives (tunneled); only the sub-threshold pocket goes.
    expect(after.stats.floorCells).toBeGreaterThan(before.stats.floorCells - MIN_REGION_CELLS);
  });
});

describe('determinism — the seed contract, RNG draw order included', () => {
  it('same seed + same spec => byte-identical repaired grid, every run', () => {
    const runs = Array.from({ length: 5 }, () => generatePreview(cfg({ ensureConnected: true })));
    const keys = new Set(runs.map((r) => gridKey(r.grid)));
    expect(keys.size).toBe(1);
    expect(new Set(runs.map((r) => r.stats.connectPass!.rngDraws)).size).toBe(1);
  });

  it('draws EXACTLY one FRandomStream value per tunnel carved, and none for a cull', () => {
    const { stats } = generatePreview(cfg({ ensureConnected: true }));
    expect(stats.connectPass!.rngDraws).toBe(stats.connectPass!.tunnelsCarved);
  });

  it('draws nothing at all when the grid is already one region', () => {
    // Seed 1337 at 64x64 is fully connected before the pass — the pass runs,
    // finds one region and must consume no randomness.
    const plain = generatePreview({ ...cfg({ gridWidth: 64, gridHeight: 64, seed: '1337' }) });
    expect(plain.stats.regions).toBe(1);
    const repaired = generatePreview(cfg({ gridWidth: 64, gridHeight: 64, seed: '1337', ensureConnected: true }));
    expect(repaired.stats.connectPass!.rngDraws).toBe(0);
    expect(gridKey(repaired.grid)).toBe(gridKey(plain.grid));
  });

  it('appends its draws AFTER the generator, so the pre-pass grid is untouched', () => {
    // The pass continues the generator's own stream rather than restarting or
    // interleaving one, so the ONLY cells that differ between the plain and the
    // repaired grid are the ones the pass itself reports changing.
    const plain = generatePreview(cfg());
    const repaired = generatePreview(cfg({ ensureConnected: true }));
    expect(repaired.seedValue).toBe(hashSeed(FRAGMENTED.seed));
    let widened = 0;
    for (let y = 0; y < plain.height; y++) {
      for (let x = 0; x < plain.width; x++) {
        if (plain.grid[y][x] !== repaired.grid[y][x]) widened++;
      }
    }
    expect(widened).toBe(repaired.stats.connectPass!.cellsChanged);
  });
});

describe('opt-in: a spec without the toggle is byte-identical to today', () => {
  it('omitting ensureConnected and setting it false give the same grid', () => {
    const omitted = generatePreview(cfg());
    const explicitOff = generatePreview(cfg({ ensureConnected: false }));
    expect(gridKey(explicitOff.grid)).toBe(gridKey(omitted.grid));
    expect(explicitOff.stats.connectPass).toBeNull();
  });
});

describe('the toggle is honest about the algorithms it does not implement', () => {
  it('cellular is supported; bsp / wfc / perlin declare a reason instead', () => {
    expect(ensureConnectedSupport('cellular')).toBeNull();
    for (const algo of ['bsp', 'wfc', 'perlin'] as const) {
      expect(ensureConnectedSupport(algo)).toMatch(/cellular caves only/);
    }
  });

  it('requesting it on an unsupported algorithm reports a SKIP, never a silent no-op', () => {
    const { stats } = generatePreview(cfg({ algorithm: 'bsp', ensureConnected: true }));
    expect(stats.connectPass).not.toBeNull();
    expect(stats.connectPass!.applied).toBe(false);
    expect(stats.connectPass!.skippedReason).toMatch(/cellular caves only/);
    expect(stats.connectPass!.cellsChanged).toBe(0);
    expect(describeConnectPass(stats.connectPass!)).toBe(stats.connectPass!.skippedReason);
  });

  it('a skipped pass leaves the grid exactly as the generator made it', () => {
    const plain = generatePreview(cfg({ algorithm: 'bsp' }));
    const skipped = generatePreview(cfg({ algorithm: 'bsp', ensureConnected: true }));
    expect(gridKey(skipped.grid)).toBe(gridKey(plain.grid));
  });
});

describe('ensureConnectedPass in isolation', () => {
  const W = 9, H = 5;
  /** Two 2x3 rooms with a wall column between them, plus a 1-cell pocket. */
  function twoRooms(): CellType[][] {
    const g: CellType[][] = Array.from({ length: H }, () => new Array<CellType>(W).fill('wall'));
    for (let y = 1; y <= 3; y++) for (let x = 1; x <= 2; x++) g[y][x] = 'floor';
    for (let y = 1; y <= 3; y++) for (let x = 6; x <= 7; x++) g[y][x] = 'floor';
    return g;
  }

  it('joins two rooms with one tunnel and reports it', () => {
    const grid = twoRooms();
    const report = ensureConnectedPass(grid, W, H, new FRandomStream(5));
    expect(report.applied).toBe(true);
    expect(report.regionsBefore).toBe(2);
    expect(report.regionsAfter).toBe(1);
    expect(report.tunnelsCarved).toBe(1);
    expect(report.cellsCarved).toBe(3); // x = 3,4,5 on one row
    expect(report.rngDraws).toBe(1);
    expect(labelRegions(grid, W, H).sizes.length).toBe(1);
  });

  it('culls a sub-threshold pocket instead of tunneling to it', () => {
    const grid = twoRooms();
    grid[0][0] = 'floor'; // a 1-cell island, below MIN_REGION_CELLS
    const report = ensureConnectedPass(grid, W, H, new FRandomStream(5));
    expect(report.regionsCulled).toBe(1);
    expect(report.cellsCulled).toBe(1);
    expect(grid[0][0]).toBe('wall');
    expect(labelRegions(grid, W, H).sizes.length).toBe(1);
  });

  it('is a no-op on an already-connected grid, drawing nothing', () => {
    const grid = twoRooms();
    for (let x = 3; x <= 5; x++) grid[2][x] = 'corridor';
    const report = ensureConnectedPass(grid, W, H, new FRandomStream(5));
    expect(report.regionsBefore).toBe(1);
    expect(report.cellsChanged).toBe(0);
    expect(report.rngDraws).toBe(0);
  });
});
