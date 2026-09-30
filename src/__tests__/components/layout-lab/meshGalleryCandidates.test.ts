import { describe, it, expect } from 'vitest';
import { meshGalleryCandidates } from '@/components/layout-lab/steps/shared/meshGalleryCandidates';
import type { GenAssetRef } from '@/lib/catalog/stepSpec';

/**
 * A 3D gallery slot may only carry a mesh generated FOR its (catalog, step) — the same
 * re-encoded identity the 2D icon library uses — and only one slot per real mesh. Before,
 * every `.glb` on disk was offered to every 3D step and repeated to fill all slots, so a
 * /3d-studio chair auto-selected into a character's 3D Generation and graded `pass`.
 */

const SCOPE = { catalogId: 'character', step: '3D Generation' };

const own: GenAssetRef = {
  name: 'character_3d_generation · tripo3d',
  url: '/api/visual-gen/asset/character_3d_generation.glb?dir=tripo3d',
  slug: 'character_3d_generation',
};
const own2: GenAssetRef = {
  name: 'character_3d_generation_a2 · tripo3d',
  url: '/api/visual-gen/asset/character_3d_generation_a2.glb?dir=tripo3d',
  slug: 'character_3d_generation',
};
const chair: GenAssetRef = {
  name: 'chair_1759000000 · tripo3d',
  url: '/api/visual-gen/asset/chair_1759000000.glb?dir=tripo3d',
  slug: 'chair_1759000000',
};
const entityMesh: GenAssetRef = {
  name: 'character__aria__3d_generation · tripo3d',
  url: '/api/visual-gen/asset/character__aria__3d_generation.glb?dir=tripo3d',
  slug: 'character_aria_3d_generation',
};

const glbSlots = (c: ReturnType<typeof meshGalleryCandidates>) => c.filter((x) => x.payload.glbUrl !== undefined);

describe('meshGalleryCandidates', () => {
  it('one step-scoped mesh fills exactly ONE slot; the other slots are honest swatches', () => {
    const c = meshGalleryCandidates('selected', 3, [own], 'hero', 0, SCOPE);
    expect(c).toHaveLength(3);
    expect(glbSlots(c)).toHaveLength(1);
    expect(c[0].payload.glbUrl).toBe(own.url);
    expect(c[0].caption).toBe(own.name);
    expect(c[0].imageUrl).toBeUndefined();
    expect(c[1].payload.glbUrl).toBeUndefined();
    expect(c[2].payload.glbUrl).toBeUndefined();
    expect(c.map((x) => x.payload.selected)).toEqual([0, 1, 2]);
  });

  it('an unrelated mesh never fills a slot (3 honest swatches)', () => {
    const c = meshGalleryCandidates('selected', 3, [chair], 'hero', 0, SCOPE);
    expect(c).toHaveLength(3);
    expect(glbSlots(c)).toHaveLength(0);
    expect(c.map((x) => x.payload.selected)).toEqual([0, 1, 2]);
    expect(c[0].swatch).toContain('linear-gradient');
  });

  it("one entity's mesh never answers for the whole step", () => {
    const c = meshGalleryCandidates('selected', 3, [entityMesh], 'hero', 0, SCOPE);
    expect(glbSlots(c)).toHaveLength(0);
  });

  it('a ref with no identity (no slug) never fills a slot', () => {
    const c = meshGalleryCandidates('selected', 3, [{ name: 'a.glb', url: '/api/visual-gen/asset/a.glb' }], 'hero', 0, SCOPE);
    expect(glbSlots(c)).toHaveLength(0);
  });

  it('keeps only the scoped meshes out of a mixed manifest, rotating them by seq', () => {
    const mixed = [chair, own, entityMesh, own2];
    const c0 = meshGalleryCandidates('selected', 3, mixed, 'hero', 0, SCOPE);
    expect(glbSlots(c0).map((x) => x.payload.glbUrl)).toEqual([own.url, own2.url]);
    expect(c0[2].payload.glbUrl).toBeUndefined();
    const c1 = meshGalleryCandidates('selected', 3, mixed, 'hero', 1, SCOPE);
    expect(c1[0].payload.glbUrl).toBe(own2.url);
  });

  it('falls back honestly to deterministic swatches (no glbUrl) when no meshes exist', () => {
    const c = meshGalleryCandidates('candidates', 3, [], 'hero mesh', 0, SCOPE);
    expect(c).toHaveLength(3);
    expect(c.every((x) => x.payload.glbUrl === undefined)).toBe(true);
    expect(c.every((x) => x.imageUrl === undefined)).toBe(true);
    expect(c[0].swatch).toContain('linear-gradient');
    expect(c[0].payload.candidates).toBe(0);
  });
});
