/**
 * Persistence for reference wrappers and the ingest-run history.
 *
 * Lives in the local PoF database (`~/.pof/pof.db`), never in the repo: the raw records are
 * another studio's design data. Every function takes the `db` handle so tests run on
 * `:memory:`; production callers pass `getDb()`.
 *
 * The upsert REPORTS what each row did — created, raw changed (the upstream file moved),
 * reprojected (only the mapping moved), unchanged. That split is the instrument for the
 * replication loop: a mapping adjustment should show up as `reprojected` and nothing else,
 * and a `rawChanged` nobody expected means the source moved under you.
 */
import type Database from 'better-sqlite3';
import type { IngestedEntity } from '@/lib/catalog/ingest/run';
import { projectionHash, type ReferenceWrapper } from './wrapper';

export function createReferenceDb(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS reference_wrappers (
      wrapper_id TEXT PRIMARY KEY,
      source_id TEXT NOT NULL,
      file TEXT NOT NULL,
      technique TEXT NOT NULL,
      source_key TEXT NOT NULL,
      key_kind TEXT NOT NULL,
      raw TEXT NOT NULL,
      raw_hash TEXT NOT NULL,
      catalog_id TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      projection TEXT NOT NULL,
      projection_hash TEXT NOT NULL,
      mapping_version TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_reference_wrappers_source ON reference_wrappers(source_id, catalog_id);
    CREATE TABLE IF NOT EXISTS reference_ingest_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_id TEXT NOT NULL,
      at TEXT NOT NULL DEFAULT (datetime('now')),
      summary TEXT NOT NULL
    );
  `);
}

export interface StoreReport {
  created: number;
  rawChanged: number;
  reprojected: number;
  unchanged: number;
}

export function upsertWrappers(db: Database.Database, wrappers: ReferenceWrapper[]): StoreReport {
  createReferenceDb(db);
  const report: StoreReport = { created: 0, rawChanged: 0, reprojected: 0, unchanged: 0 };
  const get = db.prepare('SELECT raw_hash, projection_hash FROM reference_wrappers WHERE wrapper_id = ?');
  const put = db.prepare(`
    INSERT INTO reference_wrappers (wrapper_id, source_id, file, technique, source_key, key_kind, raw, raw_hash,
      catalog_id, entity_id, projection, projection_hash, mapping_version)
    VALUES (@wrapper_id, @source_id, @file, @technique, @source_key, @key_kind, @raw, @raw_hash,
      @catalog_id, @entity_id, @projection, @projection_hash, @mapping_version)
    ON CONFLICT(wrapper_id) DO UPDATE SET
      technique=@technique, raw=@raw, raw_hash=@raw_hash, catalog_id=@catalog_id, entity_id=@entity_id,
      projection=@projection, projection_hash=@projection_hash, mapping_version=@mapping_version,
      updated_at=datetime('now')
  `);
  db.transaction(() => {
    for (const w of wrappers) {
      const pHash = projectionHash(w.entity);
      const prev = get.get(w.wrapperId) as { raw_hash: string; projection_hash: string } | undefined;
      if (!prev) report.created++;
      else if (prev.raw_hash !== w.rawHash) report.rawChanged++;
      else if (prev.projection_hash !== pHash) report.reprojected++;
      else { report.unchanged++; continue; }
      put.run({
        wrapper_id: w.wrapperId, source_id: w.sourceId, file: w.file, technique: w.technique,
        source_key: w.key, key_kind: w.keyKind, raw: JSON.stringify(w.raw), raw_hash: w.rawHash,
        catalog_id: w.catalogId, entity_id: w.entity.id, projection: JSON.stringify(w.entity),
        projection_hash: pHash, mapping_version: w.mappingVersion,
      });
    }
  })();
  return report;
}

export function rowToWrapper(row: Record<string, unknown>): ReferenceWrapper {
  return {
    wrapperId: row.wrapper_id as string,
    sourceId: row.source_id as string,
    file: row.file as string,
    technique: row.technique as string,
    key: row.source_key as string,
    keyKind: row.key_kind as ReferenceWrapper['keyKind'],
    raw: JSON.parse(row.raw as string) as Record<string, string>,
    rawHash: row.raw_hash as string,
    catalogId: row.catalog_id as string,
    entity: JSON.parse(row.projection as string) as IngestedEntity,
    mappingVersion: row.mapping_version as string,
  };
}

export function listWrappers(db: Database.Database, filter: { sourceId: string; catalogId?: string }): ReferenceWrapper[] {
  createReferenceDb(db);
  const rows = filter.catalogId
    ? db.prepare('SELECT * FROM reference_wrappers WHERE source_id = ? AND catalog_id = ? ORDER BY wrapper_id').all(filter.sourceId, filter.catalogId)
    : db.prepare('SELECT * FROM reference_wrappers WHERE source_id = ? ORDER BY wrapper_id').all(filter.sourceId);
  return (rows as Record<string, unknown>[]).map(rowToWrapper);
}

export interface WrapperSummaryRow {
  catalogId: string;
  file: string;
  wrappers: number;
  positional: number;
  mappingVersions: number;
}

export function summarizeWrappers(db: Database.Database, sourceId: string): WrapperSummaryRow[] {
  createReferenceDb(db);
  return db.prepare(`
    SELECT catalog_id AS catalogId, file, COUNT(*) AS wrappers,
      SUM(CASE WHEN key_kind = 'positional' THEN 1 ELSE 0 END) AS positional,
      COUNT(DISTINCT mapping_version) AS mappingVersions
    FROM reference_wrappers WHERE source_id = ? GROUP BY catalog_id, file ORDER BY catalog_id, file
  `).all(sourceId) as WrapperSummaryRow[];
}

export function recordRun(db: Database.Database, sourceId: string, summary: unknown): number {
  createReferenceDb(db);
  return Number(db.prepare('INSERT INTO reference_ingest_runs (source_id, summary) VALUES (?, ?)')
    .run(sourceId, JSON.stringify(summary)).lastInsertRowid);
}

export function listRuns(db: Database.Database, sourceId: string, limit = 20): { id: number; at: string; summary: unknown }[] {
  createReferenceDb(db);
  return (db.prepare('SELECT id, at, summary FROM reference_ingest_runs WHERE source_id = ? ORDER BY id DESC LIMIT ?')
    .all(sourceId, limit) as { id: number; at: string; summary: string }[])
    .map((r) => ({ id: r.id, at: r.at, summary: JSON.parse(r.summary) }));
}
