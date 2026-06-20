import { describe, it, expect } from 'vitest';
import { safeAssetName, buildAssetList } from '@/lib/visual-gen/generated-assets';

describe('safeAssetName', () => {
  it('accepts plain glb/gltf/png basenames', () => {
    expect(safeAssetName('chair.glb')).toBe('chair.glb');
    expect(safeAssetName('bestof_fg070.preview.png')).toBe('bestof_fg070.preview.png');
    expect(safeAssetName('a.gltf')).toBe('a.gltf');
  });
  it('rejects traversal, separators, and other extensions', () => {
    expect(safeAssetName('../secret.glb')).toBeNull();
    expect(safeAssetName('a/b.glb')).toBeNull();
    expect(safeAssetName('a\\b.glb')).toBeNull();
    expect(safeAssetName('chair.exe')).toBeNull();
    expect(safeAssetName('')).toBeNull();
  });
});

describe('buildAssetList', () => {
  it('maps glb files to urls + matches sibling previews, newest first', () => {
    const list = buildAssetList(
      [
        { name: 'chair.glb', sizeBytes: 100, mtimeMs: 1 },
        { name: 'bestof.glb', sizeBytes: 200, mtimeMs: 5 },
      ],
      new Set(['bestof.preview.png']),
    );
    expect(list.map((a) => a.name)).toEqual(['bestof.glb', 'chair.glb']); // newest first
    expect(list[0].url).toBe('/api/visual-gen/asset/bestof.glb');
    expect(list[0].previewUrl).toBe('/api/visual-gen/asset/bestof.preview.png');
    expect(list[1].previewUrl).toBeNull(); // no chair.preview.png
  });
});
