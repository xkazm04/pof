import { describe, it, expect } from 'vitest';
import { iconCandidates, meshCandidates, materialCandidates } from '@/components/layout-lab/steps/shared/itemGenCandidates';

describe('item generative-step candidate generators', () => {
  it('iconCandidates yields 4 candidates each carrying a numeric `selected` payload (icon Acceptance)', () => {
    const cs = iconCandidates('weathered steel', 0);
    expect(cs).toHaveLength(4);
    cs.forEach((c, i) => {
      expect(c.payload.selected).toBe(i);
      expect(typeof c.swatch).toBe('string');
    });
  });

  it('meshCandidates yields 3 LOD0-budget variants under the 6000 tri cap (mesh Acceptance)', () => {
    const cs = meshCandidates('clean retopo', 0);
    expect(cs.map((c) => c.payload.tris)).toEqual([4200, 5200, 5900]);
    cs.forEach((c) => {
      expect(Number(c.payload.tris)).toBeLessThanOrEqual(Number(c.payload.cap));
      expect(c.caption).toMatch(/tris$/);
    });
  });

  it('materialCandidates yields 3 looks each carrying the required PBR maps (material Acceptance)', () => {
    const cs = materialCandidates('worn surface', 0);
    expect(cs).toHaveLength(3);
    cs.forEach((c) => {
      const maps = c.payload.maps as string[];
      for (const required of ['Albedo', 'Normal', 'ORM']) expect(maps).toContain(required);
    });
  });

  it('re-rolls (different seq) produce visibly different swatches but a stable shape', () => {
    const a = iconCandidates('same direction', 0);
    const b = iconCandidates('same direction', 1);
    expect(b).toHaveLength(a.length);
    // at least one swatch differs between re-rolls, so the gallery shows variety
    expect(a.map((c) => c.swatch)).not.toEqual(b.map((c) => c.swatch));
  });
});
