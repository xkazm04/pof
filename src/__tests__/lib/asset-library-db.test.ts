import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import {
  createAssetLibraryDb,
  recordAsset,
  listLibraryAssets,
  getLibraryAsset,
  deleteLibraryAsset,
  setAssetFavorite,
  createCollection,
  listCollections,
  renameCollection,
  deleteCollection,
  addAssetToCollection,
  removeAssetFromCollection,
} from '@/lib/visual-gen/asset-library-db';
import type { RecordAssetInput } from '@/lib/visual-gen/asset-library-db';

let db: Database.Database;
beforeEach(() => {
  db = new Database(':memory:');
  createAssetLibraryDb(db);
});

function sampleInput(overrides: Partial<RecordAssetInput> = {}): RecordAssetInput {
  return {
    assetId: 'wood_planks_01',
    name: 'Wood Planks',
    source: 'polyhaven',
    category: 'textures',
    license: 'CC0',
    thumbnailUrl: 'https://cdn/thumb.png',
    downloadUrl: 'https://cdn/dl',
    tags: ['wood', 'floor'],
    ...overrides,
  };
}

describe('asset-library-db', () => {
  it('records an asset with sane defaults and lists it', () => {
    const asset = recordAsset(db, sampleInput());
    expect(asset.id).toBeTruthy();
    expect(asset.favorite).toBe(false);
    expect(asset.collectionIds).toEqual([]);
    expect(asset.tags).toEqual(['wood', 'floor']);

    const all = listLibraryAssets(db);
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe('Wood Planks');
    expect(all[0].source).toBe('polyhaven');
  });

  it('re-recording the same (source, assetId) upserts instead of duplicating', () => {
    const first = recordAsset(db, sampleInput());
    const second = recordAsset(db, sampleInput({ name: 'Wood Planks v2', thumbnailUrl: 'https://cdn/new.png' }));
    expect(second.id).toBe(first.id);
    const all = listLibraryAssets(db);
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe('Wood Planks v2');
    expect(all[0].thumbnailUrl).toBe('https://cdn/new.png');
  });

  it('upsert preserves favorite + collection state across re-download', () => {
    const a = recordAsset(db, sampleInput());
    const c = createCollection(db, 'Faves');
    setAssetFavorite(db, a.id, true);
    addAssetToCollection(db, c.id, a.id);

    recordAsset(db, sampleInput({ name: 'renamed' }));
    const reloaded = getLibraryAsset(db, a.id)!;
    expect(reloaded.favorite).toBe(true);
    expect(reloaded.collectionIds).toEqual([c.id]);
    expect(reloaded.name).toBe('renamed');
  });

  it('toggles favorite, persists, and returns null for a missing asset', () => {
    const a = recordAsset(db, sampleInput());
    expect(setAssetFavorite(db, a.id, true)?.favorite).toBe(true);
    expect(getLibraryAsset(db, a.id)?.favorite).toBe(true);
    expect(setAssetFavorite(db, a.id, false)?.favorite).toBe(false);
    expect(setAssetFavorite(db, 'missing', true)).toBeNull();
  });

  it('deletes an asset and reports whether a row was removed', () => {
    const a = recordAsset(db, sampleInput());
    expect(deleteLibraryAsset(db, a.id)).toBe(true);
    expect(listLibraryAssets(db)).toHaveLength(0);
    expect(deleteLibraryAsset(db, a.id)).toBe(false);
  });

  it('filters by query across name and tags', () => {
    recordAsset(db, sampleInput({ assetId: 'a', name: 'Wood Planks', tags: ['wood'] }));
    recordAsset(db, sampleInput({ assetId: 'b', name: 'Brick Wall', tags: ['masonry', 'brick'] }));
    expect(listLibraryAssets(db, { query: 'wood' }).map((r) => r.assetId)).toEqual(['a']);
    expect(listLibraryAssets(db, { query: 'brick' }).map((r) => r.assetId)).toEqual(['b']);
    expect(listLibraryAssets(db, { query: 'planks' }).map((r) => r.assetId)).toEqual(['a']);
  });

  it('filters by source, category, and favorites', () => {
    const a = recordAsset(db, sampleInput({ assetId: 'a', source: 'polyhaven', category: 'textures' }));
    recordAsset(db, sampleInput({ assetId: 'b', source: 'ambientcg', category: 'materials' }));
    setAssetFavorite(db, a.id, true);

    expect(listLibraryAssets(db, { source: 'ambientcg' }).map((r) => r.assetId)).toEqual(['b']);
    expect(listLibraryAssets(db, { category: 'materials' }).map((r) => r.assetId)).toEqual(['b']);
    expect(listLibraryAssets(db, { favoritesOnly: true }).map((r) => r.assetId)).toEqual(['a']);
    expect(listLibraryAssets(db, { source: 'all', category: 'all' })).toHaveLength(2);
  });

  it('creates, lists (with counts), renames, and deletes collections', () => {
    const c = createCollection(db, 'Stone');
    expect(c.name).toBe('Stone');
    expect(c.assetCount).toBe(0);

    const a = recordAsset(db, sampleInput());
    addAssetToCollection(db, c.id, a.id);
    expect(listCollections(db)[0].assetCount).toBe(1);

    expect(renameCollection(db, c.id, 'Stone & Brick')?.name).toBe('Stone & Brick');
    expect(renameCollection(db, 'missing', 'x')).toBeNull();

    expect(deleteCollection(db, c.id)).toBe(true);
    expect(listCollections(db)).toHaveLength(0);
    expect(deleteCollection(db, c.id)).toBe(false);
  });

  it('adds/removes collection membership and filters by collection', () => {
    const a = recordAsset(db, sampleInput({ assetId: 'a' }));
    const b = recordAsset(db, sampleInput({ assetId: 'b' }));
    const c = createCollection(db, 'Picks');

    addAssetToCollection(db, c.id, a.id);
    expect(getLibraryAsset(db, a.id)?.collectionIds).toEqual([c.id]);
    expect(listLibraryAssets(db, { collectionId: c.id }).map((r) => r.assetId)).toEqual(['a']);

    // idempotent add
    addAssetToCollection(db, c.id, a.id);
    expect(listLibraryAssets(db, { collectionId: c.id })).toHaveLength(1);

    addAssetToCollection(db, c.id, b.id);
    expect(listLibraryAssets(db, { collectionId: c.id })).toHaveLength(2);

    removeAssetFromCollection(db, c.id, a.id);
    expect(listLibraryAssets(db, { collectionId: c.id }).map((r) => r.assetId)).toEqual(['b']);
  });

  it('deleting an asset clears its collection memberships', () => {
    const a = recordAsset(db, sampleInput());
    const c = createCollection(db, 'X');
    addAssetToCollection(db, c.id, a.id);
    deleteLibraryAsset(db, a.id);
    expect(listCollections(db)[0].assetCount).toBe(0);
  });

  it('deleting a collection clears its memberships but keeps the assets', () => {
    const a = recordAsset(db, sampleInput());
    const c = createCollection(db, 'X');
    addAssetToCollection(db, c.id, a.id);
    deleteCollection(db, c.id);
    expect(getLibraryAsset(db, a.id)?.collectionIds).toEqual([]);
    expect(listLibraryAssets(db)).toHaveLength(1);
  });
});
