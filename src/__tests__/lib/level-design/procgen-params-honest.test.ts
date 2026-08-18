/**
 * A procgen parameter either does something, or says why it doesn't.
 *
 * `cellularGrid` and `perlinGrid` discarded `AlgoParams` outright, `wfcGrid`
 * never dereferenced it, and `roomCountMin` was read by nothing at all — so
 * three of the four algorithms let you drag "Min Rooms", "Max Rooms" and
 * "Corridor Width" with no effect and no hint.
 *
 * This suite is the enforcement: it walks `ALGO_PARAM_SUPPORT` (the table the
 * sliders read) against the REAL generators, so a claim of support must be
 * backed by an actual change in the seeded grid, and a claim that a parameter is
 * inert must be backed by a byte-identical grid. The table cannot drift from the
 * code in either direction.
 */
import { describe, it, expect } from 'vitest';
import { generatePreview, type PreviewConfig } from '@/lib/level-design/procgen-preview';
import {
  ALGO_PARAM_SUPPORT,
  paramDisabledReason,
  normalizeRoomBand,
  roomBandError,
  type AlgoParamKey,
  type PreviewAlgorithm,
} from '@/lib/level-design/algo-params';

const ALGORITHMS = Object.keys(ALGO_PARAM_SUPPORT) as PreviewAlgorithm[];
const PARAM_KEYS: AlgoParamKey[] = ['roomCountMin', 'roomCountMax', 'corridorWidth'];

function base(overrides: Partial<PreviewConfig> = {}): PreviewConfig {
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

/** A value for `key` that is far enough from the default to move any consumer. */
const BUMPED: Record<AlgoParamKey, number> = {
  roomCountMin: 32,
  roomCountMax: 60,
  corridorWidth: 7,
};

function gridFor(algorithm: PreviewAlgorithm, key?: AlgoParamKey): string {
  const config = base({ algorithm, ...(key ? { [key]: BUMPED[key] } : {}) });
  return JSON.stringify(generatePreview(config).grid);
}

describe('the support table is backed by the generators', () => {
  for (const algorithm of ALGORITHMS) {
    for (const key of PARAM_KEYS) {
      const reason = paramDisabledReason(algorithm, key);
      const verb = reason ? 'is inert for' : 'provably changes';
      it(`${key} ${verb} ${algorithm}`, () => {
        const before = gridFor(algorithm);
        const after = gridFor(algorithm, key);
        // Seeded generators, so the grids are exact and comparable byte-for-byte.
        if (reason) expect(after).toBe(before);
        else expect(after).not.toBe(before);
      });
    }
  }

  it('every disabled parameter carries a reason worth reading', () => {
    for (const algorithm of ALGORITHMS) {
      for (const key of PARAM_KEYS) {
        const reason = paramDisabledReason(algorithm, key);
        if (reason === null) continue;
        expect(reason.length).toBeGreaterThan(40);
        expect(reason).toMatch(/room|corridor/i);
      }
    }
  });
});

describe('roomCountMin finally has a consumer', () => {
  it('raising Min Rooms subdivides a BSP layout further', () => {
    const low = generatePreview(base({ algorithm: 'bsp', roomCountMin: 2, roomCountMax: 4 }));
    const high = generatePreview(base({ algorithm: 'bsp', roomCountMin: 32, roomCountMax: 4 }));
    expect(high.rooms.length).toBeGreaterThan(low.rooms.length);
  });

  it('shifts the WFC room band, so a bigger band fills more tiles', () => {
    const tight = generatePreview(base({ algorithm: 'wfc', roomCountMin: 1, roomCountMax: 2 }));
    const wide = generatePreview(base({ algorithm: 'wfc', roomCountMin: 40, roomCountMax: 60 }));
    expect(wide.rooms.length).toBeGreaterThan(tight.rooms.length);
  });

  it('widens WFC doors with the corridor width', () => {
    const narrow = generatePreview(base({ algorithm: 'wfc', corridorWidth: 1 }));
    const wide = generatePreview(base({ algorithm: 'wfc', corridorWidth: 7 }));
    const corridors = (r: { grid: string[][] }) => r.grid.flat().filter((c) => c === 'corridor').length;
    expect(corridors(wide)).toBeGreaterThan(corridors(narrow));
  });
});

describe('an inverted room band is flagged, not silently obeyed', () => {
  it('roomBandError names both values', () => {
    expect(roomBandError(4, 9)).toBeNull();
    expect(roomBandError(9, 4)).toMatch(/Min Rooms \(9\).*Max Rooms \(4\)/);
  });

  it('normalizeRoomBand reads the pair swapped rather than producing nothing', () => {
    expect(normalizeRoomBand(20, 5)).toEqual({ min: 5, max: 20 });
    expect(normalizeRoomBand(5, 20)).toEqual({ min: 5, max: 20 });
    // Garbage input degrades to a usable band instead of NaN-ing the generator.
    expect(normalizeRoomBand(Number.NaN, -4)).toEqual({ min: 1, max: 1 });
  });

  it('an inverted band previews the same layout as the swapped one', () => {
    const inverted = generatePreview(base({ roomCountMin: 15, roomCountMax: 8 }));
    const swapped = generatePreview(base({ roomCountMin: 8, roomCountMax: 15 }));
    expect(inverted.grid).toEqual(swapped.grid);
  });
});

describe('determinism survives the wiring', () => {
  it.each(ALGORITHMS)('%s is still identical for the same seed + params', (algorithm) => {
    expect(generatePreview(base({ algorithm })).grid).toEqual(generatePreview(base({ algorithm })).grid);
  });
});
