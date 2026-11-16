/** The unresolved-selection reason counts its candidates and batches in real words, not "(s)"/"(es)". */
import { describe, it, expect } from 'vitest';
import { gallerySeed, gradeGallerySelection } from '@/lib/catalog/acceptance/galleryArtifact';

function unresolved(candidates: number): Record<string, unknown> {
  const seeded = gallerySeed('selected', candidates);
  const history = seeded.genHistory as Record<string, unknown>;
  return { ...seeded, selected: 0, genHistory: { ...history, selectedId: 'gone' } };
}

describe('gradeGallerySelection unresolved-selection copy', () => {
  it('says "1 candidate in the 1 kept batch"', () => {
    const res = gradeGallerySelection(unresolved(1), 'selected', 'Pick');
    expect(res.status).toBe('fail');
    expect(res.reason).toContain('among the 1 candidate in the 1 kept batch');
    expect(res.reason).not.toMatch(/\(s\)|\(es\)/);
  });

  it('says "4 candidates" for more than one', () => {
    const res = gradeGallerySelection(unresolved(4), 'selected', 'Pick');
    expect(res.reason).toContain('among the 4 candidates in the 1 kept batch');
  });
});
