import { describe, it, expect } from 'vitest';
import {
  ASSET_DIRS,
  DEFAULT_ASSET_DIR,
  safeAssetDir,
  assetUrl,
  attemptOf,
  buildAssetList,
  buildMultiDirAssetList,
} from '@/lib/visual-gen/generated-assets';

const file = (name: string, mtimeMs: number) => ({ name, sizeBytes: 10, mtimeMs });

describe('safeAssetDir — an allow-list, not a sanitiser', () => {
  it('resolves each whitelisted dir', () => {
    for (const d of ASSET_DIRS) expect(safeAssetDir(d.dir)?.dir).toBe(d.dir);
  });
  it('defaults to triposr for an absent dir, keeping every legacy URL valid', () => {
    expect(safeAssetDir(null)?.dir).toBe(DEFAULT_ASSET_DIR);
    expect(safeAssetDir(undefined)?.dir).toBe(DEFAULT_ASSET_DIR);
    expect(safeAssetDir('')?.dir).toBe(DEFAULT_ASSET_DIR);
  });
  it('refuses anything not named in the list, traversal included', () => {
    for (const bad of ['..', '../..', 'triposr/..', 'icons', 'anim', 'C:/Windows', '/etc', 'TRIPOSR']) {
      expect(safeAssetDir(bad)).toBeNull();
    }
  });
});

describe('assetUrl', () => {
  it('leaves the default dir byte-identical to the legacy URL', () => {
    expect(assetUrl('a.glb')).toBe('/api/visual-gen/asset/a.glb');
    expect(assetUrl('a.glb', DEFAULT_ASSET_DIR)).toBe('/api/visual-gen/asset/a.glb');
  });
  it('names any other dir explicitly', () => {
    expect(assetUrl('a.glb', 'tripo3d')).toBe('/api/visual-gen/asset/a.glb?dir=tripo3d');
    expect(assetUrl('a.glb', 'mesh-finish')).toBe('/api/visual-gen/asset/a.glb?dir=mesh-finish');
  });
});

describe('attemptOf — a retry file is tagged, never called "rejected"', () => {
  it('reads the job store’s _aN suffix', () => {
    expect(attemptOf('1234_a2.glb')).toBe(2);
    expect(attemptOf('1234_a3.gltf')).toBe(3);
  });
  it('is undefined for a first attempt or an unrelated name', () => {
    expect(attemptOf('1234.glb')).toBeUndefined();
    expect(attemptOf('hero_arm_a.glb')).toBeUndefined();
    expect(attemptOf('1234_a1.glb')).toBeUndefined(); // attempt 1 is the base path
  });
});

describe('buildMultiDirAssetList', () => {
  it('tags every entry with its provider and sorts newest-first across dirs', () => {
    const list = buildMultiDirAssetList([
      { dir: 'triposr', glb: [file('old.glb', 1)], previewNames: new Set(['old.preview.png']) },
      { dir: 'tripo3d', glb: [file('new.glb', 9), file('mid_a2.glb', 5)], previewNames: new Set() },
    ]);
    expect(list.map((a) => a.name)).toEqual(['new.glb', 'mid_a2.glb', 'old.glb']);
    expect(list.map((a) => a.provider)).toEqual(['tripo3d', 'tripo3d', 'triposr']);
    expect(list[0].url).toBe('/api/visual-gen/asset/new.glb?dir=tripo3d');
    expect(list[1].attempt).toBe(2); // listed AS an attempt, not hidden
    expect(list[2].previewUrl).toBe('/api/visual-gen/asset/old.preview.png');
    expect(list[2].attempt).toBeUndefined();
  });

  it('keeps same-named files from two dirs as two distinct assets', () => {
    const list = buildMultiDirAssetList([
      { dir: 'triposr', glb: [file('1700000000000.glb', 2)], previewNames: new Set() },
      { dir: 'tripo3d', glb: [file('1700000000000.glb', 1)], previewNames: new Set() },
    ]);
    expect(list).toHaveLength(2);
    expect(new Set(list.map((a) => a.url)).size).toBe(2); // the URL, not the name, is identity
  });

  it('labels an unknown dir with the dir itself rather than inventing a provider', () => {
    const [a] = buildMultiDirAssetList([{ dir: 'somewhere-new', glb: [file('x.glb', 1)], previewNames: new Set() }]);
    expect(a.providerLabel).toBe('somewhere-new');
  });
});

describe('buildAssetList (single dir) still carries provenance', () => {
  it('defaults to the legacy dir', () => {
    const [a] = buildAssetList([file('c.glb', 1)], new Set());
    expect(a.provider).toBe(DEFAULT_ASSET_DIR);
    expect(a.url).toBe('/api/visual-gen/asset/c.glb');
  });
});
