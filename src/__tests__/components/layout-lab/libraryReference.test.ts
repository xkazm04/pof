import { describe, it, expect } from 'vitest';
import {
  libraryBlock, libraryAttachmentLines, addReference, removeReference,
} from '@/components/layout-lab/steps/shared/libraryReference';
import type { LibraryAsset } from '@/types/asset-library';

const asset = (over: Partial<LibraryAsset> = {}): LibraryAsset => ({
  id: 'a1', assetId: 'rocky_terrain', name: 'Rocky Terrain', source: 'polyhaven',
  category: 'textures', license: 'CC0', thumbnailUrl: 'https://x/t.jpg',
  downloadUrl: 'https://x/d.zip', tags: ['rock'], favorite: false, collectionIds: [],
  createdAt: 0, ...over,
});

describe('libraryBlock', () => {
  it('is empty when nothing is referenced — no dead prompt section', () => {
    expect(libraryBlock([])).toBe('');
  });

  it('names each asset with its source and download url', () => {
    const block = libraryBlock([asset()]);
    expect(block).toContain('Rocky Terrain');
    expect(block).toContain('polyhaven');
    expect(block).toContain('https://x/d.zip');
  });

  it('always carries the license — an asset going into a game without one is a liability', () => {
    expect(libraryBlock([asset({ license: 'CC-BY-4.0' })])).toContain('CC-BY-4.0');
  });

  it('flags an asset whose license the library never recorded, rather than omitting it', () => {
    const block = libraryBlock([asset({ license: '' })]);
    expect(block).toMatch(/license not recorded/i);
    // and it must not silently read as unrestricted
    expect(block).not.toMatch(/\bCC0\b/);
  });

  it('says these are already downloaded, so the session does not go looking for them', () => {
    expect(libraryBlock([asset()])).toMatch(/already in the project'?s? asset library|already downloaded/i);
  });

  it('lists every referenced asset', () => {
    const block = libraryBlock([asset({ id: 'a1', name: 'One' }), asset({ id: 'a2', name: 'Two' })]);
    expect(block).toContain('One');
    expect(block).toContain('Two');
  });
});

describe('libraryAttachmentLines', () => {
  it('renders one compact line per asset, carrying the license', () => {
    const lines = libraryAttachmentLines([asset({ name: 'Rocky Terrain', license: 'CC0' })]);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('Rocky Terrain');
    expect(lines[0]).toContain('CC0');
  });

  it('is empty for no references', () => {
    expect(libraryAttachmentLines([])).toEqual([]);
  });
});

describe('addReference / removeReference', () => {
  it('adds an asset', () => {
    expect(addReference([], asset()).map((a) => a.id)).toEqual(['a1']);
  });

  it('never adds the same asset twice', () => {
    const once = addReference([], asset());
    expect(addReference(once, asset()).map((a) => a.id)).toEqual(['a1']);
  });

  it('keeps insertion order so the prompt reads in the order they were picked', () => {
    const list = addReference(addReference([], asset({ id: 'a1' })), asset({ id: 'a2' }));
    expect(list.map((a) => a.id)).toEqual(['a1', 'a2']);
  });

  it('removes by id and leaves the rest alone', () => {
    const list = addReference(addReference([], asset({ id: 'a1' })), asset({ id: 'a2' }));
    expect(removeReference(list, 'a1').map((a) => a.id)).toEqual(['a2']);
  });

  it('is a no-op removing something absent', () => {
    const list = addReference([], asset());
    expect(removeReference(list, 'nope')).toEqual(list);
  });
});
