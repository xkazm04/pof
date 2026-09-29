import { getDb } from '@/lib/db';
import { CONTENT_HASH_SCHEME, isComparableHash, stepContentHash } from '@/lib/judge/contentHash';
import type { AcceptanceStatus, AcceptanceTier } from '@/lib/catalog/acceptance/types';
// Type-only import (erased at runtime), so the runner→db dependency stays one-way.
import type { DrainFilter } from '@/lib/test-gate-runner/drain';

/**
 * The VERDICT-shaped view of a persisted artifact row: everything a grader reads EXCEPT the
 * produced blob, plus the row's own content binding.
 *
 * /status grades ~817 rows across 32 pipelines and reads five fields from each, yet it had to
 * fetch every produce body (7,828,924 B measured) for ONE reason: the model bound each judge
 * verdict to the content it judged by RE-hashing `data`. A row that already carries
 * `contentHash` — the blob-free summary projection (`toStepSummary`) stamps it server-side
 * with the SAME `stepContentHash` — needs no blob at all.
 *
 * {@link PipelineArtifact} extends this (its `data` is required), so a parameter widened to
 * this type still accepts every full row: nothing narrows, and no caller changes.
 */
export interface ArtifactVerdictRow {
  catalogId: string;
  entityId: string;
  step: string;
  status: AcceptanceStatus;
  tier?: AcceptanceTier;
  reason?: string;
  updatedAt?: string;
  /**
   * `stepContentHash(data)` for the content this row holds, when the reader has it WITHOUT the
   * blob. Absent does not mean "no content": it means this reader cannot prove a binding, and a
   * grader must then degrade to NOT-proven rather than invent one — never hash a missing `data`,
   * which would fingerprint `{}` and fabricate a binding for a blob nobody read. See
   * `statusModel.judgedContentOfRow`.
   */
  contentHash?: string;
  /** The produced blob, when the row was read in FULL. Absent on the summary projection. */
  data?: Record<string, unknown>;
}

export interface PipelineArtifact extends ArtifactVerdictRow {
  data: Record<string, unknown>;
  ueAssets: string[];
}

/** A {@link listArtifactVerdicts} row: the verdict, the stored content binding and the (small) UE asset list — never `data`. */
export interface ArtifactVerdictRead extends ArtifactVerdictRow {
  ueAssets: string[];
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
      -- stepContentHash(data), stamped by upsertArtifact (see ensureContentHash). Last, where
      -- the ALTER on an existing DB puts it.
      content_hash TEXT,
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

    -- The runner's work queue (listDeferredArtifacts / deferredQuery) is the hottest read
    -- in the subsystem: EVERY worker tick and every drain GET/POST runs it. Its predicate
    -- always pins status, and the PRIMARY KEY autoindex leads with catalog_id — useless for
    -- a global or tier-only sweep, which therefore scanned the WHOLE table.
    --
    -- Column order is measured, not guessed: status first (the one always-present equality),
    -- then catalog_id, entity_id, step in EXACTLY the ORDER BY order, so the sort is free and
    -- the scoped drains (catalog / catalog+entity) also seek through this index. A
    -- (status, tier, …) variant was measured slower on the hottest query — the interposed
    -- tier breaks the ordering and forces a TEMP B-TREE FOR ORDER BY; tier is instead a
    -- cheap residual filter over the already-narrowed deferred set.
    --
    -- Measured on a copy of the real ~/.pof/pof.db, before/after in ONE process (300 runs each).
    --   today (817 artifacts / 66 deferred):  global tick 0.376 -> 0.191 ms, L3 sweep 0.279 -> 0.106 ms
    --   same DB grown 20x (17,157 / 1,386):   global tick 116.6 -> 5.1 ms,   L3 sweep 161.5 -> 3.0 ms
    -- The plan flips SCAN(whole table) -> SEARCH(status=?), which is why the gap widens with
    -- every produce. No query regressed; the scoped drains got faster too. Additive +
    -- idempotent: building an index never rewrites rows (1.3 ms on the real DB, integrity ok).
    CREATE INDEX IF NOT EXISTS idx_artifacts_deferred_queue
      ON pipeline_artifacts (status, catalog_id, entity_id, step);
  `);
  ensureContentHash();
  tableEnsured = true;
}

/**
 * `content_hash` — a stored READ MODEL of `data`, so verdict-only readers never fetch a blob.
 *
 * Measured on a copy of the real DB (1,679 rows, 5.18 MB of `data`): the whole-project summary
 * fan-out re-read and re-hashed every blob on every call (187 ms); with the stored column it is
 * a lean SELECT (~15 ms). A stored derived value is only safe with all three of:
 *  - recomputation: `stepContentHash(data)`, re-run below for every row whose hash is NULL or was
 *    computed under another `CONTENT_HASH_SCHEME` (the prefix classifies it), in ONE transaction —
 *    so an old-DDL DB and a scheme bump both converge on their own;
 *  - propagation: synchronous, in the door's own upsert ({@link upsertArtifact});
 *  - a bypass guard: a writer that changes `data` WITHOUT restamping (an older checkout on the
 *    shared DB) fires `artifacts_content_hash_invalidate`, which NULLs the hash, and the reader
 *    re-derives just those rows. It compares VALUES (`NEW.data IS NOT OLD.data`): SQLite fires an
 *    `UPDATE OF data` trigger whenever `data` is in the SET list, and every drain / verify pass
 *    re-upserts identical data — a trigger that NULLed on those would quietly bring back the blob read.
 * Additive and reversible: the column is nullable, no existing column is rewritten, and old code
 * ignores both (rollback: `DROP TRIGGER IF EXISTS artifacts_content_hash_invalidate`).
 */
function ensureContentHash(): void {
  const db = getDb();
  const cols = db.prepare('PRAGMA table_info(pipeline_artifacts)').all() as { name: string }[];
  if (!cols.some((c) => c.name === 'content_hash')) db.exec('ALTER TABLE pipeline_artifacts ADD COLUMN content_hash TEXT');
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS artifacts_content_hash_invalidate
    AFTER UPDATE OF data ON pipeline_artifacts
    FOR EACH ROW WHEN NEW.data IS NOT OLD.data AND NEW.content_hash IS OLD.content_hash
    BEGIN
      UPDATE pipeline_artifacts SET content_hash = NULL
      WHERE catalog_id = NEW.catalog_id AND entity_id = NEW.entity_id AND step = NEW.step;
    END;
  `);
  const stale = db.prepare(`SELECT catalog_id, entity_id, step, data FROM pipeline_artifacts
    WHERE content_hash IS NULL OR substr(content_hash, 1, ?) <> ?`)
    .all(CONTENT_HASH_SCHEME.length + 1, `${CONTENT_HASH_SCHEME}-`) as Record<string, string>[];
  if (stale.length === 0) return;
  const stamp = db.prepare(`UPDATE pipeline_artifacts SET content_hash = ?
    WHERE catalog_id = ? AND entity_id = ? AND step = ?`);
  db.transaction(() => {
    for (const r of stale) {
      const hash = hashOfBlob(r.data);
      if (hash) stamp.run(hash, r.catalog_id, r.entity_id, r.step);
    }
  })();
}

/** `stepContentHash` of a stored `data` text, or undefined when the text is not JSON (never a hash of `{}`). */
function hashOfBlob(text: string | null | undefined): string | undefined {
  try {
    return stepContentHash(JSON.parse(text || '{}'));
  } catch {
    return undefined;
  }
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

/**
 * The same rows as {@link listArtifacts}, verdict-shaped: NO `data` is selected or parsed. The
 * content binding comes from the stored `content_hash`; only a row whose hash is missing or of
 * another scheme (a bypass write, a scheme bump) has its blob fetched and hashed, and a blob that
 * is not JSON yields a row WITHOUT `contentHash` — "cannot prove a binding", never a fabricated one.
 * One read transaction, so a row's hash and verdict come from the same snapshot.
 */
export function listArtifactVerdicts(catalogId: string, entityId?: string): ArtifactVerdictRead[] {
  ensureTable();
  const db = getDb();
  const where = entityId ? 'catalog_id = ? AND entity_id = ?' : 'catalog_id = ?';
  const args = entityId ? [catalogId, entityId] : [catalogId];
  const lean = db.prepare(`SELECT catalog_id, entity_id, step, ue_assets, status, tier, reason, updated_at, content_hash
    FROM pipeline_artifacts WHERE ${where}`);
  const blob = db.prepare('SELECT data FROM pipeline_artifacts WHERE catalog_id = ? AND entity_id = ? AND step = ?').pluck();
  return db.transaction(() => (lean.all(...args) as Record<string, unknown>[]).map((row) => {
    const stored = row.content_hash as string | null;
    const hash = isComparableHash(stored ?? undefined)
      ? (stored as string)
      : hashOfBlob(blob.get(row.catalog_id, row.entity_id, row.step) as string | undefined);
    return {
      catalogId: row.catalog_id as string,
      entityId: row.entity_id as string,
      step: row.step as string,
      ueAssets: JSON.parse((row.ue_assets as string) || '[]'),
      status: row.status as AcceptanceStatus,
      ...(row.tier ? { tier: row.tier as AcceptanceTier } : {}),
      ...(row.reason ? { reason: row.reason as string } : {}),
      ...(row.updated_at ? { updatedAt: row.updated_at as string } : {}),
      ...(hash ? { contentHash: hash } : {}),
    };
  }))();
}

/** Single artifact by its primary key, or null. */
export function getArtifact(catalogId: string, entityId: string, step: string): PipelineArtifact | null {
  ensureTable();
  const row = getDb()
    .prepare('SELECT * FROM pipeline_artifacts WHERE catalog_id = ? AND entity_id = ? AND step = ?')
    .get(catalogId, entityId, step) as Record<string, unknown> | undefined;
  return row ? rowToArtifact(row) : null;
}

/**
 * The deferred-queue statement — the SQL + args, built in ONE place so the query that
 * actually runs and the index that must cover it (`idx_artifacts_deferred_queue`, see the
 * DDL above) can never diverge: the index-coverage test EXPLAINs exactly this. Pure.
 */
export function deferredQuery(filter?: DrainFilter): { sql: string; args: string[] } {
  const where = ["status = 'deferred'"];
  const args: string[] = [];
  if (filter?.tier) { where.push('tier = ?'); args.push(filter.tier); }
  if (filter?.catalogId) { where.push('catalog_id = ?'); args.push(filter.catalogId); }
  if (filter?.entityId) { where.push('entity_id = ?'); args.push(filter.entityId); }
  return {
    sql: `SELECT * FROM pipeline_artifacts WHERE ${where.join(' AND ')} ORDER BY catalog_id, entity_id, step`,
    args,
  };
}

/** All `deferred` artifacts (the runner's work queue), optionally narrowed. */
export function listDeferredArtifacts(filter?: DrainFilter): PipelineArtifact[] {
  ensureTable();
  const { sql, args } = deferredQuery(filter);
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

  // The content hash is stamped HERE, in the same statement as the data it names (see
  // ensureContentHash). When the data text changed but its hash did not (a `_provenance`-only
  // rewrite), the invalidation trigger cannot tell the door from a bypass writer and NULLs it —
  // so the door restamps a NULLed hash inside the same transaction.
  const db = getDb();
  const params = {
    catalog_id: a.catalogId, entity_id: a.entityId, step: a.step,
    data: JSON.stringify(a.data), ue_assets: JSON.stringify(a.ueAssets),
    status: a.status, tier: a.tier ?? null, reason: a.reason ?? null,
    content_hash: stepContentHash(a.data),
  };
  db.transaction(() => {
    db.prepare(`
      INSERT INTO pipeline_artifacts (catalog_id, entity_id, step, data, ue_assets, status, tier, reason, updated_at, content_hash)
      VALUES (@catalog_id, @entity_id, @step, @data, @ue_assets, @status, @tier, @reason, datetime('now'), @content_hash)
      ON CONFLICT(catalog_id, entity_id, step) DO UPDATE SET
        data=@data, ue_assets=@ue_assets, status=@status, tier=@tier, reason=@reason, updated_at=datetime('now'),
        content_hash=@content_hash
    `).run(params);
    db.prepare(`UPDATE pipeline_artifacts SET content_hash = @content_hash
      WHERE catalog_id = @catalog_id AND entity_id = @entity_id AND step = @step AND content_hash IS NULL`)
      .run({ catalog_id: params.catalog_id, entity_id: params.entity_id, step: params.step, content_hash: params.content_hash });
  })();
  // Return the PERSISTED row (not the input) so DB-defaulted columns round-trip — most
  // importantly `updated_at`, which callers surface as "last written". Falling back to the
  // input keeps the contract total even in the (unreachable) case the read misses.
  return getArtifact(a.catalogId, a.entityId, a.step) ?? a;
}
