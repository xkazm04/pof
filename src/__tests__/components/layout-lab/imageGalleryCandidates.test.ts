import { describe, it, expect } from 'vitest';
import { imageGalleryCandidates } from '@/components/layout-lab/steps/shared/imageGalleryCandidates';
import type { GenAssetRef } from '@/lib/catalog/stepSpec';

const assets: GenAssetRef[] = [
  { name: 'iconA', url: '/api/visual-gen/asset/iconA.png' },
  { name: 'iconB', url: '/api/visual-gen/asset/iconB.png' },
];

describe('imageGalleryCandidates', () => {
  it('surfaces real asset URLs as imageUrl, rotating by seq, with the selection payload', () => {
    const c = imageGalleryCandidates('selected', 4, assets, 'crisp', 0);
    expect(c).toHaveLength(4);
    expect(c[0].imageUrl).toBe('/api/visual-gen/asset/iconA.png');
    expect(c[1].imageUrl).toBe('/api/visual-gen/asset/iconB.png');
    expect(c[2].imageUrl).toBe('/api/visual-gen/asset/iconA.png'); // wraps
    expect(c[0].payload).toEqual({ selected: 0 });
    expect(c[3].payload).toEqual({ selected: 3 });
    // seq offsets the window so a re-roll surfaces a different first asset.
    expect(imageGalleryCandidates('selected', 4, assets, 'crisp', 1)[0].imageUrl).toBe('/api/visual-gen/asset/iconB.png');
  });

  it('falls back honestly to deterministic swatches when no assets exist (no fake preview)', () => {
    const c = imageGalleryCandidates('selected', 4, [], 'crisp', 0);
    expect(c).toHaveLength(4);
    expect(c.every((x) => x.imageUrl === undefined)).toBe(true);
    expect(c[0].swatch).toContain('linear-gradient');
    expect(c[0].payload).toEqual({ selected: 0 });
  });
});
