/**
 * The seed contact sheet and layout comparison are pure over `generatePreview`.
 */
import { describe, it, expect } from 'vitest';
import { scanSeeds, compareLayouts, THUMB_MAX_SIDE } from '@/lib/level-design/layout-gallery';
import { generatePreview, DEFAULT_MAX_PREVIEW_SIZE, type PreviewStats } from '@/lib/level-design/procgen-preview';
import { buildProcgenSpec, previewConfigFromSpec, specFieldsIgnoredBy, type ProcgenSpec } from '@/lib/level-design/procgen-spec';
import { initialProcgenSpecState } from '@/components/modules/content/level-design/ProceduralLevelWizard/specState';

const base = initialProcgenSpecState().spec;
const specOf = (over: Partial<ProcgenSpec> & { seed?: string }) =>
  buildProcgenSpec({ ...base, seed: base.seedLabel, ...over } as Parameters<typeof buildProcgenSpec>[0]);

const stats = (over: Partial<PreviewStats>): PreviewStats => ({
  roomCount: 10, floorCells: 100, floorRatio: 0.3, connectivity: 1, regions: 1, connectPass: null, ...over,
});

describe('scanSeeds', () => {
  it('returns 12 deterministic candidates for the next seeds, thumbnails <= 32 cells', () => {
    const spec = specOf({ seed: '2147483646' }); // label near int32 max: offsets must wrap
    const a = scanSeeds(spec, { count: 12 });
    expect(a).toHaveLength(12);
    expect(scanSeeds(spec, { count: 12 })).toEqual(a);
    expect(a.map((c) => c.offset).sort((x, y) => x - y)).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
    for (const c of a) {
      expect(c.seedLabel).toBe(String((spec.seedValue + c.offset) | 0));
      expect(Math.max(c.thumb.width, c.thumb.height)).toBeLessThanOrEqual(THUMB_MAX_SIDE);
      expect(c.thumb.grid).toHaveLength(c.thumb.height);
    }
  });

  it('ranks by distance from the band midpoint when the band is read, by offset otherwise', () => {
    const banded = specOf({ algorithm: 'bsp', roomCountMin: 8, roomCountMax: 12 });
    expect(specFieldsIgnoredBy('browser-preview', banded)).not.toContain('roomBand');
    const d = scanSeeds(banded).map((c) => Math.abs(c.stats.roomCount - 10));
    expect(d).toEqual([...d].sort((x, y) => x - y));

    const ignoring = (['cellular', 'wfc', 'perlin'] as const)
      .map((algorithm) => specOf({ algorithm }))
      .find((s) => specFieldsIgnoredBy('browser-preview', s).includes('roomBand'));
    expect(ignoring).toBeDefined();
    expect(scanSeeds(ignoring!).map((c) => c.offset)).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
  });

  it('generates at the preview cap even for a 512x512 spec', () => {
    const spec = specOf({ gridWidth: 512, gridHeight: 512 });
    const [c] = scanSeeds(spec, { count: 1 });
    const direct = generatePreview(previewConfigFromSpec({ ...spec, seedLabel: c.seedLabel }));
    expect(direct.width).toBeLessThanOrEqual(DEFAULT_MAX_PREVIEW_SIZE);
    expect(c.stats).toEqual(direct.stats);
  });
});

describe('compareLayouts', () => {
  it('reports signed deltas and a better side only for connectivity/regions', () => {
    const r = compareLayouts(
      stats({ regions: 3, connectivity: 0.7, roomCount: 6 }),
      stats({ regions: 1, connectivity: 1, roomCount: 9, floorRatio: 0.4 }),
    );
    expect(r.deltas.roomCount).toBe(3);
    expect(r.deltas.regions).toBe(-2);
    expect(r.deltas.connectivity).toBeCloseTo(0.3);
    expect(r.better).toBe('live');
    expect(compareLayouts(stats({ roomCount: 5 }), stats({ roomCount: 20 })).better).toBeNull();
    expect(compareLayouts(stats({}), stats({}))).toEqual({
      deltas: { roomCount: 0, connectivity: 0, floorRatio: 0, regions: 0 }, better: null,
    });
  });
});
