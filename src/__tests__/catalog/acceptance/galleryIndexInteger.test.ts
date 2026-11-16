import { describe, it, expect } from 'vitest';
import { gallerySeed, gradeGallerySelection } from '@/lib/catalog/acceptance/galleryArtifact';

// A candidate index is a position: 1.5 or Infinity names no candidate, yet `idx >= 0` accepted both
// and graded on whatever candidate the history had selected.
describe('gradeGallerySelection requires an integer candidate index', () => {
  for (const idx of [0.5, 1.5, Infinity]) {
    it(`index ${idx} is no selection`, () => {
      const r = gradeGallerySelection({ ...gallerySeed('selected', 3), selected: idx }, 'selected', 'L');
      expect(r.status).toBe('pending');
    });
  }
  it('an integer index grades as before', () => {
    expect(gradeGallerySelection(gallerySeed('selected', 3), 'selected', 'L').status).toBe('deferred');
  });
});
