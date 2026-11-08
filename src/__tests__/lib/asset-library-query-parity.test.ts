import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { createAssetLibraryDb, recordAsset, listLibraryAssets } from '@/lib/visual-gen/asset-library-db';
import { filterLibraryAssets } from '@/lib/visual-gen/library-filter';

/**
 * Two implementations of ONE search rule: the SQL filter (GET /api/visual-gen/library, used by
 * the pipeline StepLibraryPicker) and the in-memory filter (the Asset Library panel). The
 * in-memory one says it "mirrors" the SQL one; this test is what holds them to it.
 */
let db: Database.Database;
beforeEach(() => {
  db = new Database(':memory:');
  createAssetLibraryDb(db);
  const add = (assetId: string, name: string, tags: string[]) =>
    recordAsset(db, { assetId, name, source: 'polyhaven', category: 'models', license: 'CC0', thumbnailUrl: '', downloadUrl: '', tags });
  add('rock_moss_01', 'rock_moss_01', ['rock']);
  add('rockymoss', 'rockymoss', ['rock']);
  add('crate', 'Wooden Crate', ['wood', 'prop']);
  add('barrel', '100% Oak Barrel', ['wood']);
  add('lamp', 'Lamp', []);
});

const viaSql = (query: string) => listLibraryAssets(db, { query }).map((a) => a.assetId).sort();
const viaMemory = (query: string) => filterLibraryAssets(listLibraryAssets(db), { query }).map((a) => a.assetId).sort();

describe('asset library search — SQL and in-memory filters agree', () => {
  // `_` and `%` are LIKE wildcards; `"` and `,` are the JSON punctuation of the stored tag array.
  const QUERIES = ['rock_m', '_', '%', '100%', '"', '","', 'wood', 'WOOD', 'crate', 'zzz'];

  for (const q of QUERIES) {
    it(`query ${JSON.stringify(q)} returns the same assets on both paths`, () => {
      expect(viaSql(q)).toEqual(viaMemory(q));
    });
  }

  it('a literal underscore matches only names that contain one', () => {
    expect(viaSql('rock_m')).toEqual(['rock_moss_01']);
  });
});
