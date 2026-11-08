/**
 * TerrainConfig.size must be 2^n + 1. generateDiamondSquare walks `step = size - 1` and
 * halves it, so any other size either indexes past the grid (130, 100, 66, 200 throw) or
 * silently mis-walks it (64). The contract is enforced where the config is resolved.
 */
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_TERRAIN_CONFIG,
  resolveTerrainBasis,
} from '@/lib/visual-gen/generators/terrain';

describe('terrain size contract', () => {
  it('refuses 130 and other non 2^n+1 sizes, naming the size', () => {
    for (const size of [130, 100, 64, 1, 0, -5, 65.5, Number.NaN]) {
      const r = resolveTerrainBasis({ ...DEFAULT_TERRAIN_CONFIG, size });
      expect(r.ok, `size ${size}`).toBe(false);
      if (!r.ok) expect(r.error).toContain('2^n + 1');
    }
  });

  it('accepts every size the view offers', () => {
    for (const size of [2, 3, 5, 65, 129, 257, 513]) {
      expect(resolveTerrainBasis({ ...DEFAULT_TERRAIN_CONFIG, size }).ok, `size ${size}`).toBe(true);
    }
  });
});
