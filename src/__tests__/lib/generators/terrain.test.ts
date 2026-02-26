import { describe, it, expect } from 'vitest';
import {
  generateDiamondSquare,
  heightmapToUint16,
  DEFAULT_TERRAIN_CONFIG,
} from '@/lib/visual-gen/generators/terrain';

describe('generateDiamondSquare', () => {
  it('returns correct dimensions', () => {
    const heightmap = generateDiamondSquare({ ...DEFAULT_TERRAIN_CONFIG, size: 65 });
    expect(heightmap).toHaveLength(65);
    expect(heightmap[0]).toHaveLength(65);
  });

  it('returns values within [minHeight, maxHeight]', () => {
    const heightmap = generateDiamondSquare({
      ...DEFAULT_TERRAIN_CONFIG,
      size: 65,
      minHeight: 0,
      maxHeight: 1,
    });

    for (const row of heightmap) {
      for (const val of row) {
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThanOrEqual(1);
      }
    }
  });

  it('respects custom min/max height range', () => {
    const heightmap = generateDiamondSquare({
      ...DEFAULT_TERRAIN_CONFIG,
      size: 65,
      minHeight: 100,
      maxHeight: 200,
    });

    let foundMin = Infinity;
    let foundMax = -Infinity;
    for (const row of heightmap) {
      for (const val of row) {
        foundMin = Math.min(foundMin, val);
        foundMax = Math.max(foundMax, val);
      }
    }
    expect(foundMin).toBeGreaterThanOrEqual(100);
    expect(foundMax).toBeLessThanOrEqual(200);
    // Normalized range should touch the bounds
    expect(foundMin).toBeCloseTo(100, 0);
    expect(foundMax).toBeCloseTo(200, 0);
  });

  it('is deterministic for the same seed', () => {
    const config = { ...DEFAULT_TERRAIN_CONFIG, size: 65, seed: 123 };
    const a = generateDiamondSquare(config);
    const b = generateDiamondSquare(config);

    expect(a).toEqual(b);
  });

  it('produces different results for different seeds', () => {
    const a = generateDiamondSquare({ ...DEFAULT_TERRAIN_CONFIG, size: 65, seed: 1 });
    const b = generateDiamondSquare({ ...DEFAULT_TERRAIN_CONFIG, size: 65, seed: 2 });

    // At least some values should differ
    let differs = false;
    for (let y = 0; y < a.length && !differs; y++) {
      for (let x = 0; x < a[0].length && !differs; x++) {
        if (a[y][x] !== b[y][x]) differs = true;
      }
    }
    expect(differs).toBe(true);
  });

  it('produces varied terrain (not all same value)', () => {
    const heightmap = generateDiamondSquare({ ...DEFAULT_TERRAIN_CONFIG, size: 65 });
    const uniqueValues = new Set<number>();
    for (const row of heightmap) {
      for (const val of row) {
        uniqueValues.add(val);
      }
    }
    expect(uniqueValues.size).toBeGreaterThan(100);
  });
});

describe('heightmapToUint16', () => {
  it('converts heightmap to flat Uint16Array', () => {
    const heightmap = [[0, 0.5], [1, 0.25]];
    const data = heightmapToUint16(heightmap);

    expect(data).toBeInstanceOf(Uint16Array);
    expect(data).toHaveLength(4);
    expect(data[0]).toBe(0);         // 0 * 65535
    expect(data[1]).toBe(32768);     // Math.round(0.5 * 65535)
    expect(data[2]).toBe(65535);     // 1 * 65535
    expect(data[3]).toBe(16384);     // Math.round(0.25 * 65535)
  });
});
