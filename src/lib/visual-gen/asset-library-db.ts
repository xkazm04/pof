/**
 * Local Asset Library — SQLite persistence.
 *
 * Records every asset downloaded through the Free Asset Browser so it can be
 * searched, favorited, and organised into collections, mirroring managed asset
 * libraries like Quixel Bridge and Eagle. Pure functions take an explicit
 * `Database` so they're trivially unit-testable against an in-memory DB; the
 * API routes pass the shared `getDb()` connection.
 */

import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import type {
  AssetSource,
  AssetCategory,
  LibraryAsset,
  Collection,
  LibraryFilter,
} from '@/types/asset-library';

export type { LibraryAsset, Collection, LibraryFilter };

/** Fields supplied when recording a download (matches `AssetSearchResult`). */
export interface RecordAssetInput {
  assetId: string;
  name: string;
  source: AssetSource;
  category: AssetCategory;
  license: string;
  thumbnailUrl: string;
  downloadUrl: string;
  tags?: string[];
}

export function createAssetLibraryDb(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS asset_library (
      id TEXT PRIMARY KEY,
      assetId TEXT NOT NULL,
      name TEXT NOT NULL,
      source TEXT NOT NULL,
      category TEXT NOT NULL,
      license TEXT NOT NULL DEFAULT '',
      thumbnailUrl TEXT NOT NULL DEFAULT '',
      downloadUrl TEXT NOT NULL DEFAULT '',
      tags TEXT NOT NULL DEFAULT '[]',
      favorite INTEGER NOT NULL DEFAULT 0,
      createdAt INTEGER NOT NULL,
      UNIQUE(source, assetId)
    );
    CREATE INDEX IF NOT EXISTS idx_asset_library_createdAt ON asset_library(createdAt);

    CREATE TABLE IF NOT EXISTS asset_collections (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      createdAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS asset_collection_items (
      collectionId TEXT NOT NULL,
      assetId TEXT NOT NULL,
      PRIMARY KEY (collectionId, assetId),
      FOREIGN KEY (collectionId) REFERENCES asset_collections(id) ON DELETE CASCADE,
      FOREIGN KEY (assetId) REFERENCES asset_library(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_asset_collection_items_asset ON asset_collection_items(assetId);
  `);

  db.pragma('foreign_keys = ON');
}

// ── Assets ───────────────────────────────────────────────────────────────────

/**
 * Insert or update a downloaded asset, keyed on (source, assetId). A repeat
 * download updates the mutable metadata (name/thumbnail/tags/…) but preserves
 * the internal id, favorite flag, createdAt, and collection memberships.
 */
export function recordAsset(db: Database.Database, input: RecordAssetInput): LibraryAsset {
  const existing = db
    .prepare('SELECT id FROM asset_library WHERE source = ? AND assetId = ?')
    .get(input.source, input.assetId) as { id: string } | undefined;

  const id = existing?.id ?? randomUUID();
  const tags = JSON.stringify(input.tags ?? []);

  if (existing) {
    db.prepare(`
      UPDATE asset_library
      SET name = ?, category = ?, license = ?, thumbnailUrl = ?, downloadUrl = ?, tags = ?
      WHERE id = ?
    `).run(input.name, input.category, input.license, input.thumbnailUrl, input.downloadUrl, tags, id);
  } else {
    db.prepare(`
      INSERT INTO asset_library
        (id, assetId, name, source, category, license, thumbnailUrl, downloadUrl, tags, favorite, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
    `).run(
      id, input.assetId, input.name, input.source, input.category, input.license,
      input.thumbnailUrl, input.downloadUrl, tags, Date.now(),
    );
  }

  return getLibraryAsset(db, id)!;
}

export function listLibraryAssets(db: Database.Database, filter: LibraryFilter = {}): LibraryAsset[] {
  const where: string[] = [];
  const params: unknown[] = [];

  if (filter.source && filter.source !== 'all') {
    where.push('source = ?');
    params.push(filter.source);
  }
  if (filter.category && filter.category !== 'all') {
    where.push('category = ?');
    params.push(filter.category);
  }
  if (filter.favoritesOnly) {
    where.push('favorite = 1');
  }
  if (filter.collectionId) {
    where.push('id IN (SELECT assetId FROM asset_collection_items WHERE collectionId = ?)');
    params.push(filter.collectionId);
  }
  if (filter.query?.trim()) {
    // Match name or any tag (tags are stored as a JSON array string).
    where.push('(LOWER(name) LIKE ? OR LOWER(tags) LIKE ?)');
    const like = `%${filter.query.trim().toLowerCase()}%`;
    params.push(like, like);
  }

  const sql = `SELECT * FROM asset_library${where.length ? ' WHERE ' + where.join(' AND ') : ''} ORDER BY createdAt DESC, rowid DESC`;
  const rows = db.prepare(sql).all(...params) as Array<Record<string, unknown>>;
  const memberships = loadMemberships(db);
  return rows.map((r) => rowToAsset(r, memberships));
}

export function getLibraryAsset(db: Database.Database, id: string): LibraryAsset | null {
  const row = db.prepare('SELECT * FROM asset_library WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  return rowToAsset(row, loadMemberships(db, id));
}

export function deleteLibraryAsset(db: Database.Database, id: string): boolean {
  const info = db.prepare('DELETE FROM asset_library WHERE id = ?').run(id);
  return info.changes > 0;
}

/** Star/unstar an asset. Returns the updated asset, or null if it's gone. */
export function setAssetFavorite(db: Database.Database, id: string, favorite: boolean): LibraryAsset | null {
  const info = db.prepare('UPDATE asset_library SET favorite = ? WHERE id = ?').run(favorite ? 1 : 0, id);
  if (info.changes === 0) return null;
  return getLibraryAsset(db, id);
}

// ── Collections ────────────────────────────────────────────────────────────

export function createCollection(db: Database.Database, name: string): Collection {
  const id = randomUUID();
  const createdAt = Date.now();
  db.prepare('INSERT INTO asset_collections (id, name, createdAt) VALUES (?, ?, ?)').run(id, name, createdAt);
  return { id, name, assetCount: 0, createdAt };
}

export function listCollections(db: Database.Database): Collection[] {
  const rows = db.prepare(`
    SELECT c.id, c.name, c.createdAt, COUNT(i.assetId) AS assetCount
    FROM asset_collections c
    LEFT JOIN asset_collection_items i ON i.collectionId = c.id
    GROUP BY c.id
    ORDER BY c.createdAt DESC
  `).all() as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    id: String(r.id),
    name: String(r.name),
    assetCount: Number(r.assetCount),
    createdAt: Number(r.createdAt),
  }));
}

export function renameCollection(db: Database.Database, id: string, name: string): Collection | null {
  const info = db.prepare('UPDATE asset_collections SET name = ? WHERE id = ?').run(name, id);
  if (info.changes === 0) return null;
  return listCollections(db).find((c) => c.id === id) ?? null;
}

export function deleteCollection(db: Database.Database, id: string): boolean {
  const info = db.prepare('DELETE FROM asset_collections WHERE id = ?').run(id);
  return info.changes > 0;
}

/** Add an asset to a collection. Idempotent — a repeat add is a no-op. */
export function addAssetToCollection(db: Database.Database, collectionId: string, assetId: string): boolean {
  const info = db
    .prepare('INSERT OR IGNORE INTO asset_collection_items (collectionId, assetId) VALUES (?, ?)')
    .run(collectionId, assetId);
  return info.changes > 0;
}

export function removeAssetFromCollection(db: Database.Database, collectionId: string, assetId: string): boolean {
  const info = db
    .prepare('DELETE FROM asset_collection_items WHERE collectionId = ? AND assetId = ?')
    .run(collectionId, assetId);
  return info.changes > 0;
}

// ── helpers ──────────────────────────────────────────────────────────────────

/** Map of library-asset id → collection ids. Optionally scoped to one asset. */
function loadMemberships(db: Database.Database, assetId?: string): Map<string, string[]> {
  const rows = assetId
    ? db.prepare('SELECT assetId, collectionId FROM asset_collection_items WHERE assetId = ?').all(assetId)
    : db.prepare('SELECT assetId, collectionId FROM asset_collection_items').all();
  const map = new Map<string, string[]>();
  for (const r of rows as Array<{ assetId: string; collectionId: string }>) {
    const list = map.get(r.assetId) ?? [];
    list.push(r.collectionId);
    map.set(r.assetId, list);
  }
  return map;
}

function rowToAsset(r: Record<string, unknown>, memberships: Map<string, string[]>): LibraryAsset {
  const id = String(r.id);
  let tags: string[] = [];
  try {
    const parsed = JSON.parse(String(r.tags ?? '[]'));
    if (Array.isArray(parsed)) tags = parsed.map(String);
  } catch {
    tags = [];
  }
  return {
    id,
    assetId: String(r.assetId),
    name: String(r.name),
    source: r.source as AssetSource,
    category: r.category as AssetCategory,
    license: String(r.license ?? ''),
    thumbnailUrl: String(r.thumbnailUrl ?? ''),
    downloadUrl: String(r.downloadUrl ?? ''),
    tags,
    favorite: Number(r.favorite) === 1,
    collectionIds: memberships.get(id) ?? [],
    createdAt: Number(r.createdAt),
  };
}
