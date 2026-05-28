import { describe, it, expect } from 'vitest';
import { genericGalleryCandidates } from '@/components/layout-lab/steps/shared/genericGalleryCandidates';

describe('genericGalleryCandidates', () => {
  it('returns exactly `count` candidates', () => {
    expect(genericGalleryCandidates('selected', 4, 'ornate', 0)).toHaveLength(4);
    expect(genericGalleryCandidates('mesh', 3, 'rugged', 1)).toHaveLength(3);
    expect(genericGalleryCandidates('selected', 0, 'x', 0)).toHaveLength(0);
  });

  it('projects { [field]: index } as each payload (keeps `selected(field)` acceptance)', () => {
    const cands = genericGalleryCandidates('mesh3dSelected', 3, 'rugged', 0);
    expect(cands.map((c) => c.payload)).toEqual([
      { mesh3dSelected: 0 }, { mesh3dSelected: 1 }, { mesh3dSelected: 2 },
    ]);
  });

  it('is deterministic — same inputs produce identical swatches + captions', () => {
    const a = genericGalleryCandidates('selected', 4, 'weathered steel', 2);
    const b = genericGalleryCandidates('selected', 4, 'weathered steel', 2);
    expect(a).toEqual(b);
  });

  it('varies the swatch when direction or batch changes', () => {
    const base = genericGalleryCandidates('selected', 4, 'A', 0)[0].swatch;
    expect(genericGalleryCandidates('selected', 4, 'B', 0)[0].swatch).not.toBe(base);
    expect(genericGalleryCandidates('selected', 4, 'A', 1)[0].swatch).not.toBe(base);
  });

  it('emits computed hsl() swatches (no hardcoded hex)', () => {
    for (const c of genericGalleryCandidates('selected', 4, 'A', 0)) {
      expect(c.swatch).toContain('hsl(');
      expect(c.swatch).not.toMatch(/#[0-9a-fA-F]{6}/);
    }
  });
});
