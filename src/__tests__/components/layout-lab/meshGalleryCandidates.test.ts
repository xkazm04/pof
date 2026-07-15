import { describe, it, expect } from 'vitest';
import { meshGalleryCandidates } from '@/components/layout-lab/steps/shared/meshGalleryCandidates';
import type { GenAssetRef } from '@/lib/catalog/stepSpec';

const assets: GenAssetRef[] = [
  { name: 'swordA', url: '/api/visual-gen/asset/swordA.glb' },
  { name: 'swordB', url: '/api/visual-gen/asset/swordB.glb' },
];

describe('meshGalleryCandidates', () => {
  it('carries each real .glb url as payload.glbUrl, rotating by seq, with the selection index', () => {
    const c = meshGalleryCandidates('candidates', 3, assets, 'hero mesh', 0);
    expect(c).toHaveLength(3);
    expect(c[0].payload.glbUrl).toBe('/api/visual-gen/asset/swordA.glb');
    expect(c[1].payload.glbUrl).toBe('/api/visual-gen/asset/swordB.glb');
    expect(c[2].payload.glbUrl).toBe('/api/visual-gen/asset/swordA.glb'); // wraps
    expect(c[0].payload.candidates).toBe(0);
    expect(c[2].payload.candidates).toBe(2);
    // the swatch is an honest 2D placeholder — there is no fake imageUrl for a mesh
    expect(c[0].imageUrl).toBeUndefined();
    expect(c[0].swatch).toContain('linear-gradient');
    // seq rotates the window so a re-roll surfaces a different first mesh
    expect(meshGalleryCandidates('candidates', 3, assets, 'hero mesh', 1)[0].payload.glbUrl)
      .toBe('/api/visual-gen/asset/swordB.glb');
  });

  it('falls back honestly to deterministic swatches (no glbUrl) when no meshes exist', () => {
    const c = meshGalleryCandidates('candidates', 3, [], 'hero mesh', 0);
    expect(c).toHaveLength(3);
    expect(c.every((x) => x.payload.glbUrl === undefined)).toBe(true);
    expect(c.every((x) => x.imageUrl === undefined)).toBe(true);
    expect(c[0].swatch).toContain('linear-gradient');
    expect(c[0].payload.candidates).toBe(0);
  });
});
