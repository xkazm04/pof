import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { createAssetLibraryDb, listLibraryAssets, recordAsset } from '@/lib/visual-gen/asset-library-db';
import { filterLibraryAssets } from '@/lib/visual-gen/library-filter';

let db: Database.Database;
beforeEach(() => {
  db = new Database(':memory:');
  createAssetLibraryDb(db);
  const add = (assetId: string, name: string, tags: string[]) =>
    recordAsset(db, { assetId, name, source: 'polyhaven', category: 'models', license: 'CC0', thumbnailUrl: '', downloadUrl: '', tags });
  add('a', 'École Wall', ['Pierre']);
  add('b', 'Plain', ['ÉTÉ']);
  add('c', 'Lamp', []);
  db.prepare("UPDATE asset_library SET tags = '{broken' WHERE assetId = 'c'").run();
});

const sql = (query: string) => listLibraryAssets(db, { query }).map((a) => a.assetId).sort();
const memory = (query: string) => filterLibraryAssets(listLibraryAssets(db), { query }).map((a) => a.assetId).sort();

describe('library search folds case beyond ASCII on both paths', () => {
  it.each(['école', 'ÉCOLE', 'été', 'lamp', '{broken'])('%s agrees', (q) => {
    expect(sql(q)).toEqual(memory(q));
  });

  it('finds a non-ASCII name typed in the other case', () => {
    expect(sql('école')).toEqual(['a']);
  });
});
