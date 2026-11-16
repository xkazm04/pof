import { describe, it, expect } from 'vitest';
import { gallerySeed, gradeGallerySelection } from '@/lib/catalog/acceptance/galleryArtifact';
import { gradeGeneratedAsset } from '@/lib/catalog/acceptance/itemsBespokeCheckers';

// gradeGeneratedAsset copied gradeGallerySelection's selected-candidate branches. The two
// entry points differ only in the leading index check, so the shared tail must say the same
// thing through either door: one rule, one wording.
const gallery = (data: Record<string, unknown>) => gradeGallerySelection({ ...data, selected: 0 }, 'selected', 'Pick');
const bespoke = (data: Record<string, unknown>) => gradeGeneratedAsset(data, 'Pick');
const strip = (s: string | undefined) => (s ?? '').replace(/candidate 0 · /, '');

function withAsset(): Record<string, unknown> {
  const seed = gallerySeed('selected', 2);
  const h = seed.genHistory as { batches: { candidates: Record<string, unknown>[] }[] };
  h.batches[0].candidates[0].imageUrl = '/api/visual-gen/icon/x.jpg';
  return seed;
}
function unresolved(n: number): Record<string, unknown> {
  const seed = gallerySeed('selected', n);
  return { ...seed, genHistory: { ...(seed.genHistory as object), selectedId: 'gone' } };
}

describe('one selected-candidate rule behind both grading entry points', () => {
  it.each([
    ['real asset', withAsset],
    ['swatch placeholder', () => gallerySeed('selected', 2)],
    ['unresolved selection (1 candidate)', () => unresolved(1)],
    ['unresolved selection (4 candidates)', () => unresolved(4)],
  ])('%s: same status, tier, detail and reason', (_n, make) => {
    const g = gallery(make());
    const b = bespoke(make());
    expect([b.status, b.tier]).toEqual([g.status, g.tier]);
    expect(strip(b.detail)).toBe(strip(g.detail));
    expect(b.reason).toBe(g.reason);
  });

  it('no generation history defers at L4 through both doors', () => {
    const g = gradeGallerySelection({ selected: 0 }, 'selected', 'Pick');
    const b = gradeGeneratedAsset({}, 'Pick');
    expect([g.status, g.tier, b.status, b.tier]).toEqual(['deferred', 'L4', 'deferred', 'L4']);
  });
});
