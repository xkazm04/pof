import { getDb } from '@/lib/db';
import type { LifecycleRecord, LifecycleState, TestResult } from '@/lib/catalog/types';

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
