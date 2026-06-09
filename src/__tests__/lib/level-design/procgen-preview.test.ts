import { describe, it, expect } from 'vitest';
import {
  generatePreview,
  DEFAULT_MAX_PREVIEW_SIZE,
  type PreviewAlgorithm,
  type PreviewConfig,
} from '@/lib/level-design/procgen-preview';
import { FRandomStream, hashSeed, DEFAULT_PREVIEW_SEED } from '@/lib/level-design/frandom-stream';
import type { CellType } from '@/lib/blender-mcp/scripts/dungeon-to-geometry';

const VALID_CELLS: CellType[] = ['empty', 'floor', 'wall', 'door', 'corridor'];
const ALGORITHMS: PreviewAlgorithm[] = ['bsp', 'wfc', 'cellular', 'perlin'];

function baseConfig(overrides: Partial<PreviewConfig> = {}): PreviewConfig {
  return {
    algorithm: 'bsp',
    gridWidth: 64,
    gridHeight: 64,
    roomCountMin: 8,
    roomCountMax: 15,
    corridorWidth: 3,
    seed: '1337',
    ...overrides,
  };
}

describe('FRandomStream', () => {
  it('matches UE\'s LCG mutate formula exactly (faithful port)', () => {
    const seed = 1337;
    const expected = (((Math.imul(seed, 196314165) + 907633515) | 0) >>> 9) / 8388608;
    expect(new FRandomStream(seed).getFraction()).toBe(expected);
  });

  it('produces a deterministic stream for the same seed', () => {
    const a = new FRandomStream(42);
    const b = new FRandomStream(42);
    const seqA = Array.from({ length: 8 }, () => a.getFraction());
    const seqB = Array.from({ length: 8 }, () => b.getFraction());
    expect(seqA).toEqual(seqB);
  });

  it('diverges for different seeds', () => {
    const a = Array.from({ length: 8 }, ((s) => () => s.getFraction())(new FRandomStream(1)));
    const b = Array.from({ length: 8 }, ((s) => () => s.getFraction())(new FRandomStream(2)));
    expect(a).not.toEqual(b);
  });

  it('keeps getFraction in [0, 1) and randRange within inclusive bounds', () => {
    const rng = new FRandomStream(99);
    for (let i = 0; i < 200; i++) {
      const f = rng.getFraction();
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
      const r = rng.randRange(3, 7);
      expect(r).toBeGreaterThanOrEqual(3);
      expect(r).toBeLessThanOrEqual(7);
    }
  });
});

describe('hashSeed', () => {
  it('parses plain and hex integers directly', () => {
    expect(hashSeed('42')).toBe(42);
    expect(hashSeed('0xFF')).toBe(255);
  });

  it('falls back to a fixed seed for empty input (never wall-clock random)', () => {
    expect(hashSeed('')).toBe(DEFAULT_PREVIEW_SEED);
    expect(hashSeed('   ')).toBe(DEFAULT_PREVIEW_SEED);
  });

  it('hashes arbitrary labels stably', () => {
    expect(hashSeed('dark-keep')).toBe(hashSeed('dark-keep'));
    expect(hashSeed('dark-keep')).not.toBe(hashSeed('ash-vault'));
  });
});

describe('generatePreview', () => {
  it.each(ALGORITHMS)('produces a valid, non-empty grid for %s', (algorithm) => {
    const result = generatePreview(baseConfig({ algorithm }));
    expect(result.grid).toHaveLength(result.height);
    expect(result.grid[0]).toHaveLength(result.width);
    const flat = result.grid.flat();
    for (const cell of flat) expect(VALID_CELLS).toContain(cell);
    // Every algorithm carves some passable space.
    expect(result.stats.floorCells).toBeGreaterThan(0);
  });

  it.each(ALGORITHMS)('is deterministic for the same seed (%s)', (algorithm) => {
    const a = generatePreview(baseConfig({ algorithm }));
    const b = generatePreview(baseConfig({ algorithm }));
    expect(a.grid).toEqual(b.grid);
    expect(a.stats).toEqual(b.stats);
  });

  it('produces different layouts for different seeds', () => {
    const a = generatePreview(baseConfig({ seed: '1' }));
    const b = generatePreview(baseConfig({ seed: '2' }));
    expect(a.grid).not.toEqual(b.grid);
  });

  it('caps the longest side to the preview budget, preserving aspect ratio', () => {
    const result = generatePreview(baseConfig({ gridWidth: 512, gridHeight: 256 }));
    expect(Math.max(result.width, result.height)).toBeLessThanOrEqual(DEFAULT_MAX_PREVIEW_SIZE);
    // 512:256 == 2:1 aspect preserved.
    expect(result.width / result.height).toBeCloseTo(2, 1);
    expect(result.scale).toBeLessThan(1);
  });

  it('keeps small grids at native resolution (scale 1)', () => {
    const result = generatePreview(baseConfig({ gridWidth: 48, gridHeight: 48 }));
    expect(result.width).toBe(48);
    expect(result.height).toBe(48);
    expect(result.scale).toBe(1);
  });

  it('reports connectivity and floorRatio in [0, 1]', () => {
    for (const algorithm of ALGORITHMS) {
      const { stats } = generatePreview(baseConfig({ algorithm }));
      expect(stats.connectivity).toBeGreaterThanOrEqual(0);
      expect(stats.connectivity).toBeLessThanOrEqual(1);
      expect(stats.floorRatio).toBeGreaterThanOrEqual(0);
      expect(stats.floorRatio).toBeLessThanOrEqual(1);
    }
  });

  it('places connected rooms for BSP (high connectivity, room count > 0)', () => {
    const { stats, rooms } = generatePreview(baseConfig({ algorithm: 'bsp' }));
    expect(rooms.length).toBeGreaterThan(0);
    expect(stats.roomCount).toBe(rooms.length);
    // BSP connects every room via a corridor spanning tree.
    expect(stats.connectivity).toBeGreaterThan(0.9);
  });

  it('exposes the resolved seed value used by FRandomStream', () => {
    expect(generatePreview(baseConfig({ seed: '7' })).seedValue).toBe(7);
    expect(generatePreview(baseConfig({ seed: '' })).seedValue).toBe(DEFAULT_PREVIEW_SEED);
  });
});
