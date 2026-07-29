import { getDb } from '@/lib/db';
import type { AcceptanceStatus, AcceptanceTier } from '@/lib/catalog/acceptance/types';
// Type-only import (erased at runtime), so the runner→db dependency stays one-way.
import type { DrainFilter } from '@/lib/test-gate-runner/drain';

export interface PipelineArtifact {
  catalogId: string;
  entityId: string;
  step: string;
  data: Record<string, unknown>;
  ueAssets: string[];
  status: AcceptanceStatus;
  tier?: AcceptanceTier;
  reason?: string;
  updatedAt?: string;
}

/**
 * How many superseded versions of one step are kept. Bounded on purpose: the history is a
 * safety net for "that re-produce made it worse", not an archive — and one row can hold a
 * produce body's full output, which is often 10-60× what any View renders.
 */
export const MAX_REVISIONS = 20;

// The DB connection is a process-level singleton (see getDb), so the DDL only
// needs to run once. This guard keeps it off the hot path of every query.
let tableEnsured = false;
function ensureTable() {
  if (tableEnsured) return;
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS pipeline_artifacts (
      catalog_id TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      step TEXT NOT NULL,
      data TEXT NOT NULL DEFAULT '{}',
      ue_assets TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'pending',
      tier TEXT,
      reason TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (catalog_id, entity_id, step)
    );

    -- Superseded versions of a step's artifact. The live table is keyed
    -- (catalog_id, entity_id, step) and upserted, so before this every re-produce
    -- DESTROYED what the step previously held: gallery steps kept their candidate
    -- batches inside data.genHistory, but a static step's prior output was gone.
    CREATE TABLE IF NOT EXISTS pipeline_artifact_revisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      catalog_id TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      step TEXT NOT NULL,
      data TEXT NOT NULL DEFAULT '{}',
      ue_assets TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'pending',
      tier TEXT,
      reason TEXT,
      -- When the archived version was WRITTEN (the live row's updated_at), not when it
      -- was archived — the operator is choosing between versions by when each was made.
      updated_at TEXT NOT NULL,
      archived_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_artifact_revisions_step
      ON pipeline_artifact_revisions (catalog_id, entity_id, step, id DESC);
  `);
  tableEnsured = true;
}

export interface ArtifactRevision extends PipelineArtifact {
  /** Monotonic row id — the handle a revert takes. */
  id: number;
  archivedAt: string;
}

export function rowToRevision(row: Record<string, unknown>): ArtifactRevision {
  return { ...rowToArtifact(row), id: row.id as number, archivedAt: row.archived_at as string };
}

/**
 * Does this write actually supersede DIFFERENT content?
 *
 * Only content changes are archived. A gate drain, a static-verify pass and a packaging
 * verify all re-upsert the same `data` with a new status/tier/reason — archiving those
 * would bury the handful of real produce versions under dozens of identical rows and make
 * the history useless for the thing it exists for.
 */
export function contentChanged(prev: PipelineArtifact, next: PipelineArtifact): boolean {
  return (
    JSON.stringify(prev.data ?? {}) !== JSON.stringify(next.data ?? {}) ||
    JSON.stringify(prev.ueAssets ?? []) !== JSON.stringify(next.ueAssets ?? [])
  );
}

/** Archive the current row for a step, then prune that step's history to {@link MAX_REVISIONS}. */
function archive(a: PipelineArtifact): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO pipeline_artifact_revisions
      (catalog_id, entity_id, step, data, ue_assets, status, tier, reason, updated_at)
    VALUES (@catalog_id, @entity_id, @step, @data, @ue_assets, @status, @tier, @reason, @updated_at)
  `).run({
    catalog_id: a.catalogId, entity_id: a.entityId, step: a.step,
    data: JSON.stringify(a.data), ue_assets: JSON.stringify(a.ueAssets),
    status: a.status, tier: a.tier ?? null, reason: a.reason ?? null,
    updated_at: a.updatedAt ?? new Date().toISOString(),
  });
  db.prepare(`
    DELETE FROM pipeline_artifact_revisions
    WHERE catalog_id = ? AND entity_id = ? AND step = ? AND id NOT IN (
      SELECT id FROM pipeline_artifact_revisions
      WHERE catalog_id = ? AND entity_id = ? AND step = ?
      ORDER BY id DESC LIMIT ?
    )
  `).run(a.catalogId, a.entityId, a.step, a.catalogId, a.entityId, a.step, MAX_REVISIONS);
}

/** Superseded versions of one step, newest first. */
export function listRevisions(catalogId: string, entityId: string, step: string): ArtifactRevision[] {
  ensureTable();
  const rows = getDb()
    .prepare(`SELECT * FROM pipeline_artifact_revisions
              WHERE catalog_id = ? AND entity_id = ? AND step = ? ORDER BY id DESC`)
    .all(catalogId, entityId, step) as Record<string, unknown>[];
  return rows.map(rowToRevision);
}

/** One archived version by id, or null. */
export function getRevision(id: number): ArtifactRevision | null {
  ensureTable();
  const row = getDb()
    .prepare('SELECT * FROM pipeline_artifact_revisions WHERE id = ?')
    .get(id) as Record<string, unknown> | undefined;
  return row ? rowToRevision(row) : null;
}

/** Column row → PipelineArtifact. Pure (exported for unit test). */
export function rowToArtifact(row: Record<string, unknown>): PipelineArtifact {
  return {
    catalogId: row.catalog_id as string,
    entityId: row.entity_id as string,
    step: row.step as string,
    data: JSON.parse((row.data as string) || '{}'),
    ueAssets: JSON.parse((row.ue_assets as string) || '[]'),
    status: row.status as AcceptanceStatus,
    ...(row.tier ? { tier: row.tier as AcceptanceTier } : {}),
    ...(row.reason ? { reason: row.reason as string } : {}),
    ...(row.updated_at ? { updatedAt: row.updated_at as string } : {}),
  };
}

export function listArtifacts(catalogId: string, entityId?: string): PipelineArtifact[] {
  ensureTable();
  const sql = entityId
    ? 'SELECT * FROM pipeline_artifacts WHERE catalog_id = ? AND entity_id = ?'
    : 'SELECT * FROM pipeline_artifacts WHERE catalog_id = ?';
  const args = entityId ? [catalogId, entityId] : [catalogId];
  return (getDb().prepare(sql).all(...args) as Record<string, unknown>[]).map(rowToArtifact);
}

/** Single artifact by its primary key, or null. */
export function getArtifact(catalogId: string, entityId: string, step: string): PipelineArtifact | null {
  ensureTable();
  const row = getDb()
    .prepare('SELECT * FROM pipeline_artifacts WHERE catalog_id = ? AND entity_id = ? AND step = ?')
    .get(catalogId, entityId, step) as Record<string, unknown> | undefined;
  return row ? rowToArtifact(row) : null;
}

/** All `deferred` artifacts (the runner's work queue), optionally narrowed. */
export function listDeferredArtifacts(filter?: DrainFilter): PipelineArtifact[] {
  ensureTable();
  const where = ["status = 'deferred'"];
  const args: string[] = [];
  if (filter?.tier) { where.push('tier = ?'); args.push(filter.tier); }
  if (filter?.catalogId) { where.push('catalog_id = ?'); args.push(filter.catalogId); }
  if (filter?.entityId) { where.push('entity_id = ?'); args.push(filter.entityId); }
  const sql = `SELECT * FROM pipeline_artifacts WHERE ${where.join(' AND ')} ORDER BY catalog_id, entity_id, step`;
  return (getDb().prepare(sql).all(...args) as Record<string, unknown>[]).map(rowToArtifact);
}

/** All artifacts (any status), optionally narrowed by catalog/entity — the L2
 *  static-verify pass's work set (every persisted step, not just deferred ones). */
export function listAllArtifacts(filter?: { catalogId?: string; entityId?: string }): PipelineArtifact[] {
  ensureTable();
  const where: string[] = [];
  const args: string[] = [];
  if (filter?.catalogId) { where.push('catalog_id = ?'); args.push(filter.catalogId); }
  if (filter?.entityId) { where.push('entity_id = ?'); args.push(filter.entityId); }
  const sql = `SELECT * FROM pipeline_artifacts${where.length ? ' WHERE ' + where.join(' AND ') : ''} ORDER BY catalog_id, entity_id, step`;
  return (getDb().prepare(sql).all(...args) as Record<string, unknown>[]).map(rowToArtifact);
}

/** Remove one artifact by its primary key (used to clean up synthetic/test rows). */
export function deleteArtifact(catalogId: string, entityId: string, step: string): void {
  ensureTable();
  getDb().prepare('DELETE FROM pipeline_artifacts WHERE catalog_id = ? AND entity_id = ? AND step = ?').run(catalogId, entityId, step);
}

export function upsertArtifact(a: PipelineArtifact): PipelineArtifact {
  ensureTable();
  // Archive what this write is about to overwrite — but only when the CONTENT differs.
  // Drains, static-verify and packaging-verify all re-upsert identical data with a new
  // verdict; archiving those would bury the few real produce versions under dozens of
  // duplicates and make the history useless for the one thing it is for.
  const prev = getArtifact(a.catalogId, a.entityId, a.step);
  if (prev && contentChanged(prev, a)) archive(prev);

  getDb().prepare(`
    INSERT INTO pipeline_artifacts (catalog_id, entity_id, step, data, ue_assets, status, tier, reason, updated_at)
    VALUES (@catalog_id, @entity_id, @step, @data, @ue_assets, @status, @tier, @reason, datetime('now'))
    ON CONFLICT(catalog_id, entity_id, step) DO UPDATE SET
      data=@data, ue_assets=@ue_assets, status=@status, tier=@tier, reason=@reason, updated_at=datetime('now')
  `).run({
    catalog_id: a.catalogId, entity_id: a.entityId, step: a.step,
    data: JSON.stringify(a.data), ue_assets: JSON.stringify(a.ueAssets),
    status: a.status, tier: a.tier ?? null, reason: a.reason ?? null,
  });
  // Return the PERSISTED row (not the input) so DB-defaulted columns round-trip — most
  // importantly `updated_at`, which callers surface as "last written". Falling back to the
  // input keeps the contract total even in the (unreachable) case the read misses.
  return getArtifact(a.catalogId, a.entityId, a.step) ?? a;
}
