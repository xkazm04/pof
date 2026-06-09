import { describe, it, expect } from 'vitest';
import { filterLibraryAssets } from '@/lib/visual-gen/library-filter';
import type { LibraryAsset } from '@/types/asset-library';

function asset(over: Partial<LibraryAsset> = {}): LibraryAsset {
  return {
    id: over.id ?? 'id1',
    assetId: 'a1',
    name: 'Wood Planks',
    source: 'polyhaven',
    category: 'textures',
    license: 'CC0',
    thumbnailUrl: '',
    downloadUrl: '',
    tags: ['wood'],
    favorite: false,
    collectionIds: [],
    createdAt: 0,
    ...over,
  };
}

describe('filterLibraryAssets', () => {
  const items: LibraryAsset[] = [
    asset({ id: '1', name: 'Wood Planks', source: 'polyhaven', category: 'textures', tags: ['wood'], favorite: true, collectionIds: ['c1'] }),
    asset({ id: '2', name: 'Brick Wall', source: 'ambientcg', category: 'materials', tags: ['brick', 'masonry'], collectionIds: ['c2'] }),
    asset({ id: '3', name: 'Oak Tree', source: 'sketchfab', category: 'models', tags: ['nature'], favorite: true }),
  ];

  it('returns everything when no filter is set', () => {
    expect(filterLibraryAssets(items, {})).toHaveLength(3);
  });

  it('matches query against name and tags, case-insensitively', () => {
    expect(filterLibraryAssets(items, { query: 'WOOD' }).map((a) => a.id)).toEqual(['1']);
    expect(filterLibraryAssets(items, { query: 'masonry' }).map((a) => a.id)).toEqual(['2']);
    expect(filterLibraryAssets(items, { query: 'tree' }).map((a) => a.id)).toEqual(['3']);
  });

  it('filters by source and category, treating "all" as no filter', () => {
    expect(filterLibraryAssets(items, { source: 'ambientcg' }).map((a) => a.id)).toEqual(['2']);
    expect(filterLibraryAssets(items, { category: 'models' }).map((a) => a.id)).toEqual(['3']);
    expect(filterLibraryAssets(items, { source: 'all', category: 'all' })).toHaveLength(3);
  });

  it('filters by favorites and by collection membership', () => {
    expect(filterLibraryAssets(items, { favoritesOnly: true }).map((a) => a.id)).toEqual(['1', '3']);
    expect(filterLibraryAssets(items, { collectionId: 'c2' }).map((a) => a.id)).toEqual(['2']);
  });

  it('combines filters (AND)', () => {
    expect(filterLibraryAssets(items, { favoritesOnly: true, source: 'sketchfab' }).map((a) => a.id)).toEqual(['3']);
    expect(filterLibraryAssets(items, { query: 'wood', favoritesOnly: true })).toHaveLength(1);
    expect(filterLibraryAssets(items, { query: 'wood', favoritesOnly: false, category: 'models' })).toHaveLength(0);
  });
});
