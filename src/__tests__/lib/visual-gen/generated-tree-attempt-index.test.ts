import { describe, it, expect } from 'vitest';
import { attemptIndex, categorize } from '@/lib/visual-gen/generated-tree';

describe('attemptIndex reads only what the job store writes', () => {
  it('is a retry for a mesh or its preview', () => {
    expect(attemptIndex('hero_a2.glb')).toBe(2);
    expect(attemptIndex('hero_a2.GLTF')).toBe(2);
    expect(attemptIndex('hero_a3.preview.png')).toBe(3);
  });

  it('is not a retry for any other file that happens to end in _aN', () => {
    expect(attemptIndex('wood_a2.png')).toBeUndefined();
    expect(attemptIndex('notes_a2.json')).toBeUndefined();
    expect(categorize({ path: 'anim/x.fbm/wood_a2.png', sizeBytes: 1, mtimeMs: 1 }).bucket).toBe('image');
  });
});
