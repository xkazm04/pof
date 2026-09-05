import { getDb } from '@/lib/db';
import { logger } from '@/lib/logger';
import type { LifecycleRecord, LifecycleState, StoredCatalogEntity, TestResult } from '@/lib/catalog/types';

// The DB connection is a process-level singleton (see getDb), so the DDL only
// needs to run once. This guard keeps it off the hot path of every query.
let tableEnsured = false;
function ensureTable() {
  if (tableEnsured) return;
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS catalog_lifecycle (
      catalog_id TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      lifecycle TEXT NOT NULL DEFAULT 'planned',
      ue_assets TEXT NOT NULL DEFAULT '[]',
      last_test_result TEXT,
      last_verified_at TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (catalog_id, entity_id)
    )
  `);
  tableEnsured = true;
}

/** Column row → LifecycleRecord. Pure (exported for unit test). */
export function rowToLifecycle(row: Record<string, unknown>): LifecycleRecord {
  return {
    catalogId: row.catalog_id as string,
    entityId: row.entity_id as string,
    lifecycle: row.lifecycle as LifecycleState,
    ueAssets: JSON.parse((row.ue_assets as string) || '[]'),
    lastTestResult: (row.last_test_result as TestResult | null) ?? undefined,
    lastVerifiedAt: (row.last_verified_at as string | null) ?? undefined,
  };
}

export function listLifecycle(catalogId: string): LifecycleRecord[] {
  ensureTable();
  const rows = getDb()
    .prepare('SELECT * FROM catalog_lifecycle WHERE catalog_id = ?')
    .all(catalogId) as Record<string, unknown>[];
  return rows.map(rowToLifecycle);
}

export function getLifecycle(catalogId: string, entityId: string): LifecycleRecord | null {
  ensureTable();
  const row = getDb()
    .prepare('SELECT * FROM catalog_lifecycle WHERE catalog_id = ? AND entity_id = ?')
    .get(catalogId, entityId) as Record<string, unknown> | undefined;
  return row ? rowToLifecycle(row) : null;
}

export function upsertLifecycle(rec: LifecycleRecord): LifecycleRecord {
  ensureTable();
  getDb().prepare(`
    INSERT INTO catalog_lifecycle
      (catalog_id, entity_id, lifecycle, ue_assets, last_test_result, last_verified_at, updated_at)
    VALUES (@catalog_id, @entity_id, @lifecycle, @ue_assets, @last_test_result, @last_verified_at, datetime('now'))
    ON CONFLICT(catalog_id, entity_id) DO UPDATE SET
      lifecycle=@lifecycle, ue_assets=@ue_assets, last_test_result=@last_test_result,
      last_verified_at=@last_verified_at, updated_at=datetime('now')
  `).run({
    catalog_id: rec.catalogId,
    entity_id: rec.entityId,
    lifecycle: rec.lifecycle,
    ue_assets: JSON.stringify(rec.ueAssets),
    last_test_result: rec.lastTestResult ?? null,
    last_verified_at: rec.lastVerifiedAt ?? null,
  });
  return getLifecycle(rec.catalogId, rec.entityId)!;
}

// ── Durable catalog entities ────────────────────────────────────────────────
//
// A user-created entity used to live ONLY in the browser (`catalogStore.addDraft`,
// persisted to `localStorage`) while its pipeline artifacts were written to SQLite.
// The server could therefore never resolve it again: `seededEntities` missed it, so
// `listEntitySummaries` omitted it, the server `CheckerContext.has()` said false, and
// the static-verify resolver returned `null` — an L2 static gate could never run for
// user-created content. Absence read as exemption. This table is the server-side
// record that closes that: `seededEntities` returns code seeds UNION these rows.
//
// The design payload is stored whole as JSON (`data`) rather than exploded into
// columns, because a catalog entity's `data` is a different typed shape per catalog
// (`StoredCatalogEntity`); the columns carry only what the server keys and audits on.

let entityTableEnsured = false;
function ensureEntityTable() {
  if (entityTableEnsured) return;
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS catalog_entities (
      catalog_id TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      data TEXT NOT NULL DEFAULT '{}',
      source TEXT NOT NULL DEFAULT 'user',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (catalog_id, entity_id)
    )
  `);
  entityTableEnsured = true;
}

/** Who created the entity. `'one-shot'` = the autonomous flow; `'user'` = a direct create. */
export type CatalogEntitySource = 'user' | 'one-shot';

/** A catalog entity persisted server-side — the durable counterpart of a browser draft. */
export interface PersistedCatalogEntity {
  catalogId: string;
  entityId: string;
  source: CatalogEntitySource;
  /** The whole `StoredCatalogEntity` (name, tags, lifecycle, typed `data`). */
  entity: StoredCatalogEntity;
  createdAt: string;
  updatedAt: string;
}

/** Explicit column list (never `SELECT *`) so a later ALTER cannot silently change the shape. */
const ENTITY_COLUMNS = 'catalog_id, entity_id, data, source, created_at, updated_at';

/** Column row → PersistedCatalogEntity. Pure (exported for unit test). */
export function rowToEntity(row: Record<string, unknown>): PersistedCatalogEntity {
  const catalogId = row.catalog_id as string;
  const entityId = row.entity_id as string;
  let entity: StoredCatalogEntity;
  try {
    entity = JSON.parse((row.data as string) || '{}') as StoredCatalogEntity;
  } catch {
    // A corrupt payload must not read as "no entity" — that is the exemption hole again.
    // Surface a minimal, obviously-degraded record instead of dropping the row.
    logger.error(`catalog_entities: unparseable data for ${catalogId}/${entityId}`);
    entity = { id: entityId, catalogId, name: entityId, categoryPath: [], tags: [], lifecycle: 'planned' };
  }
  return {
    catalogId,
    entityId,
    source: (row.source as CatalogEntitySource) ?? 'user',
    entity: { ...entity, id: entityId, catalogId },
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function listEntities(catalogId: string): PersistedCatalogEntity[] {
  ensureEntityTable();
  const rows = getDb()
    .prepare(`SELECT ${ENTITY_COLUMNS} FROM catalog_entities WHERE catalog_id = ? ORDER BY created_at, entity_id`)
    .all(catalogId) as Record<string, unknown>[];
  return rows.map(rowToEntity);
}

export function getEntity(catalogId: string, entityId: string): PersistedCatalogEntity | null {
  ensureEntityTable();
  const row = getDb()
    .prepare(`SELECT ${ENTITY_COLUMNS} FROM catalog_entities WHERE catalog_id = ? AND entity_id = ?`)
    .get(catalogId, entityId) as Record<string, unknown> | undefined;
  return row ? rowToEntity(row) : null;
}

/**
 * Insert or replace one entity. `created_at` is preserved across an update (COALESCE on the
 * existing row), so the provenance of when a user first created the entity survives an edit.
 */
export function upsertEntity(rec: {
  catalogId: string;
  entityId: string;
  source: CatalogEntitySource;
  entity: StoredCatalogEntity;
}): PersistedCatalogEntity {
  ensureEntityTable();
  getDb().prepare(`
    INSERT INTO catalog_entities (catalog_id, entity_id, data, source, created_at, updated_at)
    VALUES (@catalog_id, @entity_id, @data, @source, datetime('now'), datetime('now'))
    ON CONFLICT(catalog_id, entity_id) DO UPDATE SET
      data=@data, source=@source, updated_at=datetime('now')
  `).run({
    catalog_id: rec.catalogId,
    entity_id: rec.entityId,
    data: JSON.stringify({ ...rec.entity, id: rec.entityId, catalogId: rec.catalogId }),
    source: rec.source,
  });
  return getEntity(rec.catalogId, rec.entityId)!;
}

/**
 * Remove one entity row. Returns the REAL `changes()` count — a second delete is `0`, so a
 * caller reporting "removed" can never be reporting rows it merely attempted.
 * Artifacts live in `pipeline_artifacts` and are purged through
 * `DELETE /api/pipeline-artifacts`; this deliberately does not reach into that table.
 */
export function deleteEntity(catalogId: string, entityId: string): number {
  ensureEntityTable();
  return getDb()
    .prepare('DELETE FROM catalog_entities WHERE catalog_id = ? AND entity_id = ?')
    .run(catalogId, entityId).changes;
}
