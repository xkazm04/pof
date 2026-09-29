import { describe, it, expect } from 'vitest';
import { slotRealAssets } from '@/components/layout-lab/steps/shared/realAssetSlots';
import { imageGalleryCandidates } from '@/components/layout-lab/steps/shared/imageGalleryCandidates';
import { withGeneratedImages } from '@/components/layout-lab/steps/shared/assetHonesty';
import { iconCandidates } from '@/components/layout-lab/steps/shared/itemGenCandidates';
import { meshSlug, meshMatches } from '@/lib/visual-gen/generated-assets';
import { iconSlug } from '@/lib/visual-gen/generated-icons';
import type { GenAssetRef } from '@/lib/catalog/stepSpec';

/**
 * ONE rule decides which real asset may fill a gallery slot: at most `min(count, assets)`
 * slots carry a real file, rotated by `seq`, and every other slot is the caller's honest
 * fill. The 2D generator, the bespoke 2D overlay and the 3D generator all route through it.
 */

const ICON: GenAssetRef = { name: 'items_icon_2d', url: '/api/visual-gen/icon/items_icon_2d.png' };

describe('slotRealAssets', () => {
  it('fills at most min(count, assets) slots with real assets, rotated by seq; the rest from fill', () => {
    const out = slotRealAssets(4, ['A', 'B'], 1, (a, i) => `${a}${i}`, (i) => `s${i}`);
    expect(out).toEqual(['B0', 'A1', 's2', 's3']);
  });

  it('never repeats an asset to fill the grid, and an empty manifest is all fill', () => {
    expect(slotRealAssets(3, ['A'], 0, (a) => a, (i) => `s${i}`)).toEqual(['A', 's1', 's2']);
    expect(slotRealAssets(2, [], 5, (a: string) => a, (i) => `s${i}`)).toEqual(['s0', 's1']);
    expect(slotRealAssets(0, ['A'], 0, (a) => a, (i) => `s${i}`)).toEqual([]);
  });
});

describe('[guard] the 2D paths are behaviour-identical through the shared rule', () => {
  it('imageGalleryCandidates: one icon → exactly 1 imageUrl slot + 3 swatches, payload indices 0..3', () => {
    const c = imageGalleryCandidates('selected', 4, [ICON], 'd', 0);
    expect(c).toHaveLength(4);
    expect(c.filter((x) => x.imageUrl !== undefined)).toHaveLength(1);
    expect(c[0].imageUrl).toBe(ICON.url);
    expect(c.map((x) => x.payload)).toEqual([{ selected: 0 }, { selected: 1 }, { selected: 2 }, { selected: 3 }]);
  });

  it('withGeneratedImages: one icon → exactly 1 imageUrl slot, every payload byte-identical to the input batch', () => {
    const batch = iconCandidates('d', 0);
    const before = JSON.stringify(batch.map((c) => c.payload));
    const out = withGeneratedImages(batch, [ICON], 0);
    expect(out).toHaveLength(batch.length);
    expect(out.filter((x) => x.imageUrl !== undefined)).toHaveLength(1);
    expect(out[0].imageUrl).toBe(ICON.url);
    expect(JSON.stringify(out.map((c) => c.payload))).toBe(before);
    // untouched slots are the very same candidate objects
    for (let i = 1; i < batch.length; i++) expect(out[i]).toBe(batch[i]);
  });
});

describe('[guard] one identity rule for 2D and 3D', () => {
  it('meshSlug re-encodes a mesh file exactly as iconSlug encodes (catalog, step)', () => {
    expect(meshSlug('character_3d_generation.glb')).toBe(iconSlug('character', '3D Generation'));
    expect(meshSlug('character_pipeline_3d_generation.glb')).toBe(iconSlug('character-pipeline', '3D Generation'));
  });

  it('meshSlug strips the job store _aN retry suffix; meshMatches compares against iconSlug', () => {
    expect(meshSlug('character_3d_generation_a2.glb')).toBe('character_3d_generation');
    expect(meshMatches(meshSlug('character_3d_generation_a2.glb'), 'character', '3D Generation')).toBe(true);
    expect(meshMatches(meshSlug('chair_1759000000.glb'), 'character', '3D Generation')).toBe(false);
    expect(meshMatches(meshSlug('character__aria__3d_generation.glb'), 'character', '3D Generation')).toBe(false);
  });
});
