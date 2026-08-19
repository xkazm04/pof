import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { logger } from '@/lib/logger';
import { normalizeProjectId } from '@/lib/project-id';

// POF_DB_PATH overrides the SQLite location — used by the pof-mcp integration suite to
// run against a throwaway DB instead of the user's real ~/.pof/pof.db. Falls back to the
// default so normal runs are unchanged.
const DB_PATH = process.env.POF_DB_PATH || path.join(os.homedir(), '.pof', 'pof.db');
const DB_DIR = path.dirname(DB_PATH);

// Bump when adding a NEW one-off migration probe below. `CREATE TABLE/INDEX IF NOT
// EXISTS` stays unconditional (self-healing for fresh DBs); only the expensive
// introspection/rebuild probes (PRAGMA table_info, sqlite_master SELECTs, table
// rebuilds) are gated behind this so they run once per DB instead of on every
// cold start. A fresh DB (user_version 0) runs them once against freshly-created
// tables (all guards no-op) then stamps the version.
const SCHEMA_VERSION = 3;

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  // Bootstrap into a LOCAL handle and publish the singleton only after EVERY
  // statement has succeeded. The connection used to be assigned first, so a throw
  // anywhere below cached a half-built connection: every later getDb() handed it
  // back and the app returned 500s ("no such table: X") at unrelated query sites for the
  // rest of the process. Nothing "retried next time" — the cache short-circuited
  // the retry. A failed bootstrap now closes the handle and leaves the singleton
  // null, so the next call re-attempts against the real state of the file.
  const conn = new Database(DB_PATH);
  try {
    bootstrap(conn);
  } catch (err) {
    try {
      conn.close();
    } catch {
      /* the handle is already unusable; the bootstrap error is the one that matters */
    }
    throw err;
  }

  db = conn;
  return db;
}

/**
 * Every statement the connection needs before it may be published as the shared
 * singleton. Takes the handle explicitly: it must NOT be reachable through the
 * module-level `db` until it has returned cleanly.
 */
function bootstrap(conn: Database.Database): void {
  conn.pragma('journal_mode = WAL');
  // Enforce foreign keys for the whole shared connection (SQLite defaults them OFF, per
  // connection). Without this, declared `REFERENCES ... ON DELETE CASCADE` clauses are
  // decorative — deletes leak orphan child rows and inserts can reference nonexistent
  // parents — and whether they fire becomes non-deterministic based on which feature's
  // init happened to toggle the pragma first.
  conn.pragma('foreign_keys = ON');

  // Skip the one-off introspection/rebuild probes once a DB has been stamped at the
  // current schema version — they are idempotent guards whose only job is the initial
  // upgrade, so re-running the PRAGMA table_info / sqlite_master scans on every cold
  // start is pure waste.
  const schemaVersion = conn.pragma('user_version', { simple: true }) as number;
  const needsMigrations = schemaVersion < SCHEMA_VERSION;

  conn.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  conn.exec(`
    CREATE TABLE IF NOT EXISTS feature_matrix (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      module_id TEXT NOT NULL,
      feature_name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'general',
      status TEXT NOT NULL DEFAULT 'unknown'
        CHECK(status IN ('implemented', 'improved', 'partial', 'missing', 'unknown')),
      description TEXT NOT NULL DEFAULT '',
      file_paths TEXT NOT NULL DEFAULT '[]',
      review_notes TEXT NOT NULL DEFAULT '',
      quality_score INTEGER,
      next_steps TEXT NOT NULL DEFAULT '',
      last_reviewed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      -- Which project owns the row. Existed only as an ALTER migration below, so a
      -- fresh DB created after a SCHEMA_VERSION bump (which skips the migration
      -- probes) would have been missing the column every scoped query now reads.
      -- Declared here in the same position the migration produces, since the
      -- 'improved' rebuild above copies columns positionally (SELECT *).
      project_id TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT 'unknown',
      -- The project is PART OF THE KEY. It used to be UNIQUE(module_id, feature_name),
      -- which made a feature physically ONE row across every project: a full upsert
      -- under project B REASSIGNED project A's row. Phase 1 made that visible
      -- (an upsert takenOver count, a 409 naming the owner); this makes it
      -- impossible. Two projects can now hold the same (module_id, feature_name)
      -- simultaneously without either overwriting the other. Existing DBs are
      -- rebuilt into this shape by the migration below, which preserves every row.
      UNIQUE(project_id, module_id, feature_name)
    )
  `);

  // Migrate: add columns if missing (table may already exist from earlier schema)
  if (needsMigrations) {
  const cols = conn.prepare("PRAGMA table_info(feature_matrix)").all() as { name: string }[];
  const colNames = new Set(cols.map((c) => c.name));
  if (!colNames.has('quality_score')) {
    conn.exec('ALTER TABLE feature_matrix ADD COLUMN quality_score INTEGER');
  }
  if (!colNames.has('next_steps')) {
    conn.exec("ALTER TABLE feature_matrix ADD COLUMN next_steps TEXT NOT NULL DEFAULT ''");
  }

  // Migrate: the pre-'improved' CHECK constraint. SQLite cannot ALTER a
  // constraint, so the table is REBUILT — see the function for the explicit
  // column copy, the count check and the transaction the old inline version had none of.
  migrateFeatureMatrixImprovedStatus(conn);
  }

  // Review snapshots — captures module state at each review for trend tracking
  conn.exec(`
    CREATE TABLE IF NOT EXISTS review_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      module_id TEXT NOT NULL,
      reviewed_at TEXT NOT NULL,
      total INTEGER NOT NULL DEFAULT 0,
      implemented INTEGER NOT NULL DEFAULT 0,
      -- improved existed only as an ALTER migration below, so a fresh DB created
      -- after a SCHEMA_VERSION bump (which skips the migration probes) would have
      -- been missing the column captureReviewSnapshot inserts into.
      improved INTEGER NOT NULL DEFAULT 0,
      partial INTEGER NOT NULL DEFAULT 0,
      missing INTEGER NOT NULL DEFAULT 0,
      unknown INTEGER NOT NULL DEFAULT 0,
      avg_quality REAL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      -- Same reasoning as feature_matrix.project_id: migration-added, so a fresh DB
      -- that skips the probes must still get it — captureReviewSnapshot inserts it.
      project_id TEXT NOT NULL DEFAULT ''
    )
  `);

  // Index for fast per-module history lookups
  conn.exec(`
    CREATE INDEX IF NOT EXISTS idx_review_snapshots_module
    ON review_snapshots(module_id, reviewed_at)
  `);

  // Deep evaluation findings — stores results from multi-pass deep eval scans
  conn.exec(`
    CREATE TABLE IF NOT EXISTS eval_findings (
      id TEXT PRIMARY KEY,
      scan_id TEXT NOT NULL,
      module_id TEXT NOT NULL,
      pass TEXT NOT NULL CHECK(pass IN ('structure', 'quality', 'performance')),
      category TEXT NOT NULL DEFAULT 'General',
      severity TEXT NOT NULL DEFAULT 'medium'
        CHECK(severity IN ('critical', 'high', 'medium', 'low')),
      file TEXT,
      line INTEGER,
      description TEXT NOT NULL DEFAULT '',
      suggested_fix TEXT NOT NULL DEFAULT '',
      effort TEXT NOT NULL DEFAULT 'medium'
        CHECK(effort IN ('trivial', 'small', 'medium', 'large')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  conn.exec(`
    CREATE INDEX IF NOT EXISTS idx_eval_findings_scan
    ON eval_findings(scan_id, module_id)
  `);

  conn.exec(`
    CREATE INDEX IF NOT EXISTS idx_eval_findings_severity
    ON eval_findings(severity, module_id)
  `);

  // Build history — records every package/build operation for trending & comparison
  conn.exec(`
    CREATE TABLE IF NOT EXISTS build_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform TEXT NOT NULL,
      config TEXT NOT NULL DEFAULT 'Development',
      status TEXT NOT NULL CHECK(status IN ('success', 'failed', 'cancelled')),
      size_bytes INTEGER,
      duration_ms INTEGER,
      version TEXT,
      output_path TEXT,
      error_summary TEXT,
      cook_time_ms INTEGER,
      warning_count INTEGER DEFAULT 0,
      error_count INTEGER DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  conn.exec(`
    CREATE INDEX IF NOT EXISTS idx_build_history_platform
    ON build_history(platform, created_at)
  `);

  // Recent projects — tracks all opened projects for the switcher
  conn.exec(`
    CREATE TABLE IF NOT EXISTS recent_projects (
      id TEXT PRIMARY KEY,
      project_name TEXT NOT NULL,
      project_path TEXT NOT NULL UNIQUE,
      ue_version TEXT NOT NULL DEFAULT '5.5',
      checklist_json TEXT NOT NULL DEFAULT '{}',
      last_opened_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  conn.exec(`
    CREATE INDEX IF NOT EXISTS idx_recent_projects_opened
    ON recent_projects(last_opened_at DESC)
  `);

  // Migrate: add project_id column to scoped tables
  if (needsMigrations) {
  const fmCols = conn.prepare("PRAGMA table_info(feature_matrix)").all() as { name: string }[];
  const fmColNames = new Set(fmCols.map((c) => c.name));
  if (!fmColNames.has('project_id')) {
    conn.exec("ALTER TABLE feature_matrix ADD COLUMN project_id TEXT NOT NULL DEFAULT ''");
  }
  // Provenance: which write path (review / verify / fix / seed) last set the row's
  // status. Rows written before this column existed default to 'unknown' — the
  // honest reading, since nothing recorded how they were set.
  if (!fmColNames.has('source')) {
    conn.exec("ALTER TABLE feature_matrix ADD COLUMN source TEXT NOT NULL DEFAULT 'unknown'");
  }

  const rsCols = conn.prepare("PRAGMA table_info(review_snapshots)").all() as { name: string }[];
  const rsColNames = new Set(rsCols.map((c) => c.name));
  if (!rsColNames.has('project_id')) {
    conn.exec("ALTER TABLE review_snapshots ADD COLUMN project_id TEXT NOT NULL DEFAULT ''");
  }
  if (!rsColNames.has('improved')) {
    conn.exec("ALTER TABLE review_snapshots ADD COLUMN improved INTEGER NOT NULL DEFAULT 0");
  }

  const bhCols = conn.prepare("PRAGMA table_info(build_history)").all() as { name: string }[];
  if (!new Set(bhCols.map((c) => c.name)).has('project_id')) {
    conn.exec("ALTER TABLE build_history ADD COLUMN project_id TEXT NOT NULL DEFAULT ''");
  }

  // Widen the feature_matrix UNIQUE key to include the project, and backfill the
  // unattributed rows. A table rebuild (SQLite cannot ALTER a constraint) that
  // preserves EVERY row — see the function for the count checks that abort it.
  migrateFeatureMatrixProjectKey(conn);
  }

  // Every feature-matrix read is now scoped by project (see `feature-matrix-db.ts`),
  // so `project_id` leads both indexes. Created after the migration block because the
  // 'improved' rebuild above drops and renames the table, which would take an index
  // built before it with it.
  conn.exec(`
    CREATE INDEX IF NOT EXISTS idx_feature_matrix_project
    ON feature_matrix(project_id, module_id)
  `);

  conn.exec(`
    CREATE INDEX IF NOT EXISTS idx_review_snapshots_project
    ON review_snapshots(project_id, module_id, reviewed_at)
  `);

  // Checklist metadata — stores priority and notes per checklist item
  conn.exec(`
    CREATE TABLE IF NOT EXISTS checklist_metadata (
      module_id TEXT NOT NULL,
      item_id TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'none'
        CHECK(priority IN ('none', 'critical', 'important', 'nice-to-have')),
      notes TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (module_id, item_id)
    )
  `);

  // Milestone deadlines — user-set target dates for milestone deliverables
  conn.exec(`
    CREATE TABLE IF NOT EXISTS milestone_deadlines (
      milestone_id TEXT PRIMARY KEY,
      target_date TEXT NOT NULL,
      label TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Project progress — stores full module state (checklist, health, verification, history) per project
  conn.exec(`
    CREATE TABLE IF NOT EXISTS project_progress (
      project_id TEXT PRIMARY KEY,
      checklist_json TEXT NOT NULL DEFAULT '{}',
      health_json TEXT NOT NULL DEFAULT '{}',
      verification_json TEXT NOT NULL DEFAULT '{}',
      history_json TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Session log — unified audit trail linking CLI sessions to modules and projects
  conn.exec(`
    CREATE TABLE IF NOT EXISTS session_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tab_id TEXT NOT NULL,
      session_key TEXT NOT NULL,
      module_id TEXT NOT NULL,
      project_path TEXT NOT NULL DEFAULT '',
      event TEXT NOT NULL CHECK(event IN ('started', 'completed', 'cancelled')),
      success INTEGER,
      prompt_preview TEXT NOT NULL DEFAULT '',
      duration_ms INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  conn.exec(`
    CREATE INDEX IF NOT EXISTS idx_session_log_project
    ON session_log(project_path, created_at)
  `);

  conn.exec(`
    CREATE INDEX IF NOT EXISTS idx_session_log_module
    ON session_log(module_id, created_at)
  `);

  // Request log — idempotency key replay detection for import/mutation routes
  conn.exec(`
    CREATE TABLE IF NOT EXISTS request_log (
      idempotency_key TEXT PRIMARY KEY,
      route TEXT NOT NULL,
      status_code INTEGER NOT NULL,
      response_body TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  conn.exec(`
    CREATE INDEX IF NOT EXISTS idx_request_log_created
    ON request_log(created_at)
  `);

  // Session analytics — per-CLI-session prompt/outcome telemetry powering the
  // analytics dashboard, insights, and prompt suggestions. Read/written via
  // src/lib/session-analytics-db.ts (plus weekly-digest / project-wrapped /
  // pattern-extractor, which query the table directly).
  conn.exec(`
    CREATE TABLE IF NOT EXISTS session_analytics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      module_id TEXT NOT NULL,
      session_key TEXT NOT NULL,
      prompt TEXT NOT NULL,
      prompt_preview TEXT NOT NULL,
      had_project_context INTEGER NOT NULL DEFAULT 0,
      prompt_length INTEGER NOT NULL DEFAULT 0,
      success INTEGER NOT NULL DEFAULT 0,
      duration_ms INTEGER NOT NULL DEFAULT 0,
      -- ISO-8601 with milliseconds + Z, matching new Date().toISOString() (the app writer).
      -- The old datetime('now') produced a SPACE-separated value that sorts BELOW 'T', so a
      -- default-inserted row would silently fall outside the lexicographic week-range filter
      -- (WHERE completed_at >= weekStartISO) and vanish from digests.
      started_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      completed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    )
  `);

  // Migrate: the ISO defaults above reach FRESH databases only — CREATE TABLE
  // IF NOT EXISTS never updates an existing table's schema, so installs created
  // before the default change still carry datetime('now') (space-separated, sorts
  // below 'T' and falls out of the lexicographic week-range filters). Rebuilt by
  // the function below, transactionally and by explicit column list.
  if (needsMigrations) migrateSessionAnalyticsIsoDefaults(conn);

  conn.exec(`
    CREATE INDEX IF NOT EXISTS idx_session_analytics_module
    ON session_analytics(module_id)
  `);

  // Telemetry snapshots + genre suggestions — drive the genre-evolution engine
  // (TelemetryEvolution module). Read/written via src/lib/telemetry-db.ts.
  conn.exec(`
    CREATE TABLE IF NOT EXISTS telemetry_snapshots (
      id TEXT PRIMARY KEY,
      scanned_at TEXT NOT NULL DEFAULT (datetime('now')),
      project_path TEXT NOT NULL,
      signals TEXT NOT NULL DEFAULT '{}',
      detected_patterns TEXT NOT NULL DEFAULT '[]'
    )
  `);

  conn.exec(`
    CREATE INDEX IF NOT EXISTS idx_telemetry_snapshots_time
    ON telemetry_snapshots(scanned_at DESC)
  `);

  conn.exec(`
    CREATE TABLE IF NOT EXISTS genre_suggestions (
      id TEXT PRIMARY KEY,
      sub_genre TEXT NOT NULL,
      label TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      confidence INTEGER NOT NULL DEFAULT 0,
      patterns TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK(status IN ('pending','accepted','dismissed')),
      proposed_changes TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      resolved_at TEXT
    )
  `);

  conn.exec(`
    CREATE INDEX IF NOT EXISTS idx_genre_suggestions_status
    ON genre_suggestions(status, created_at DESC)
  `);

  // GDD compliance gap triage. Read/written only by src/lib/gdd-compliance.ts.
  // Gap ids are deterministic across audits, so a resolution is durable: it is
  // re-applied to every subsequent report instead of dying with the browser tab.
  // Scoped by project — gap ids are only unique within one project. An audit that
  // carries no project scope (e.g. the pof_gdd_compliance MCP tool) uses the empty
  // string, so it sees only unscoped resolutions rather than another project's.
  conn.exec(`
    CREATE TABLE IF NOT EXISTS gdd_gap_resolutions (
      project_path TEXT NOT NULL DEFAULT '',
      gap_id TEXT NOT NULL,
      module_id TEXT NOT NULL DEFAULT '',
      resolved_at TEXT NOT NULL DEFAULT (datetime('now')),
      note TEXT NOT NULL DEFAULT '',
      PRIMARY KEY (project_path, gap_id)
    )
  `);

  // NOTE: the `headless_builds` table is owned and created by
  // `ensureHeadlessBuildsTable()` in src/lib/ue5-bridge/build-pipeline.ts — the
  // sole reader/writer. A duplicate definition previously lived here with a
  // mismatched schema (id/output_log vs build_id/output/diagnostics_json) that
  // silently broke build persistence; it has been removed to keep one source of
  // truth.

  // Stamp the schema version so the one-off probes above are skipped on the next
  // cold start. Only advances after a clean bootstrap — a throw earlier leaves the
  // version untouched AND (since `getDb()` publishes the singleton only when this
  // function returns) the next call really does re-attempt, which is what the old
  // "migrations retry next time" comment claimed while the cached handle prevented it.
  if (needsMigrations) conn.pragma(`user_version = ${SCHEMA_VERSION}`);
}

// ─── Migration: project in the feature_matrix UNIQUE key ─────────────────────
//
// The key was `UNIQUE(module_id, feature_name)`, so a feature was physically ONE
// row across every project: a full upsert under project B REASSIGNED project A's
// row. Phase 1 (1f27793f) made that visible rather than silent; this makes it
// impossible. SQLite cannot ALTER a constraint, so the table is REBUILT — copy,
// verify counts, swap — and never touched with a destructive ALTER.
//
// BACKFILL: every row carried the unattributed `project_id = ''` (165 feature rows
// and 10 review snapshots when this shipped). Leaving them there would strand them
// under `''` forever; guessing an owner is the mis-attribution the whole scoping
// effort exists to end. The OPERATOR STATED THE RULE on 2026-08-19: attribute all
// existing unattributed rows to the **PoF** project. `resolveBackfillProjectId`
// derives that id from `recent_projects` through the SAME `normalizeProjectId` the
// application writes with — nothing here hardcodes a path. If no such project row
// exists the backfill is SKIPPED and said so loudly: the rows stay `''`, stay
// visible to every project under phase 1's legacy rule, and nothing is invented.

/** Columns copied by the rebuild, in the order the new table declares them. Named
 *  EXPLICITLY — a `SELECT *` positional copy silently shifts every value one column
 *  left the moment the source and target column orders differ. */
const FEATURE_MATRIX_COLUMN_LIST = [
  'id', 'module_id', 'feature_name', 'category', 'status', 'description',
  'file_paths', 'review_notes', 'quality_score', 'next_steps', 'last_reviewed_at',
  'created_at', 'updated_at', 'project_id', 'source',
];
const FEATURE_MATRIX_COLUMNS = FEATURE_MATRIX_COLUMN_LIST.join(', ');

/** The marker that says the widened key is already in place. */
const PROJECT_KEY_MARKER = 'UNIQUE(project_id, module_id, feature_name)';

/**
 * The project the operator's backfill rule names, derived (never hardcoded) from
 * `recent_projects` — the table that records the projects actually opened. Returns
 * `''` when no PoF project has ever been opened in this DB, which the caller treats
 * as "do not backfill" rather than "backfill to nothing".
 */
function resolveBackfillProjectId(database: Database.Database): string {
  const rows = database
    .prepare('SELECT project_path FROM recent_projects ORDER BY last_opened_at DESC')
    .all() as { project_path: string }[];
  for (const r of rows) {
    const id = normalizeProjectId(r.project_path);
    if (id.split('/').pop() === 'pof') return id;
  }
  return '';
}

function countRows(database: Database.Database, table: string): number {
  return (database.prepare(`SELECT COUNT(*) as c FROM ${table}`).get() as { c: number }).c;
}

function migrateFeatureMatrixProjectKey(database: Database.Database): void {
  const sqlRow = database
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='feature_matrix'")
    .get() as { sql: string } | undefined;
  // Already widened (or a fresh DB created straight into the new shape).
  if (!sqlRow?.sql || sqlRow.sql.includes(PROJECT_KEY_MARKER)) return;

  const featuresBefore = countRows(database, 'feature_matrix');
  const snapshotsBefore = countRows(database, 'review_snapshots');
  const target = resolveBackfillProjectId(database);
  const unattributedFeatures = (
    database.prepare("SELECT COUNT(*) as c FROM feature_matrix WHERE project_id = ''").get() as { c: number }
  ).c;
  const unattributedSnapshots = (
    database.prepare("SELECT COUNT(*) as c FROM review_snapshots WHERE project_id = ''").get() as { c: number }
  ).c;

  if (!target && (unattributedFeatures > 0 || unattributedSnapshots > 0)) {
    logger.warn(
      `[db] feature_matrix key migration: NO backfill. ${unattributedFeatures} feature row(s) and ` +
        `${unattributedSnapshots} snapshot(s) carry project_id = '' and recent_projects holds no PoF ` +
        `project to attribute them to. They are preserved as-is and stay visible to every project ` +
        `(the legacy rule) — no owner was guessed.`,
    );
  }

  const rebuild = database.transaction(() => {
    if (target) {
      database.prepare("UPDATE feature_matrix SET project_id = ? WHERE project_id = ''").run(target);
      database.prepare("UPDATE review_snapshots SET project_id = ? WHERE project_id = ''").run(target);
    }

    // The backfill cannot collide: the OLD key already made (module_id, feature_name)
    // globally unique, so no two rows can normalize onto the same widened key.
    database.exec(`
      CREATE TABLE feature_matrix_projectkey (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        module_id TEXT NOT NULL,
        feature_name TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'general',
        status TEXT NOT NULL DEFAULT 'unknown'
          CHECK(status IN ('implemented', 'improved', 'partial', 'missing', 'unknown')),
        description TEXT NOT NULL DEFAULT '',
        file_paths TEXT NOT NULL DEFAULT '[]',
        review_notes TEXT NOT NULL DEFAULT '',
        quality_score INTEGER,
        next_steps TEXT NOT NULL DEFAULT '',
        last_reviewed_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        project_id TEXT NOT NULL DEFAULT '',
        source TEXT NOT NULL DEFAULT 'unknown',
        ${PROJECT_KEY_MARKER}
      )
    `);
    database.exec(
      `INSERT INTO feature_matrix_projectkey (${FEATURE_MATRIX_COLUMNS})
       SELECT ${FEATURE_MATRIX_COLUMNS} FROM feature_matrix`,
    );

    // A lost row is a failed migration: verify the copy BEFORE anything is dropped,
    // and throw to roll the whole transaction back rather than swap in a short table.
    const copied = countRows(database, 'feature_matrix_projectkey');
    if (copied !== featuresBefore) {
      throw new Error(
        `[db] feature_matrix key migration ABORTED: copied ${copied} of ${featuresBefore} rows. ` +
          `Nothing was dropped; the original table is intact.`,
      );
    }

    database.exec('DROP TABLE feature_matrix');
    database.exec('ALTER TABLE feature_matrix_projectkey RENAME TO feature_matrix');
  });

  rebuild();

  const featuresAfter = countRows(database, 'feature_matrix');
  const snapshotsAfter = countRows(database, 'review_snapshots');
  if (featuresAfter !== featuresBefore || snapshotsAfter !== snapshotsBefore) {
    throw new Error(
      `[db] feature_matrix key migration LOST ROWS: feature_matrix ${featuresBefore} -> ${featuresAfter}, ` +
        `review_snapshots ${snapshotsBefore} -> ${snapshotsAfter}.`,
    );
  }

  logger.info(
    `[db] feature_matrix UNIQUE key widened to (project_id, module_id, feature_name). ` +
      `Rows preserved: feature_matrix ${featuresBefore} -> ${featuresAfter}, ` +
      `review_snapshots ${snapshotsBefore} -> ${snapshotsAfter}. ` +
      (target
        ? `Backfilled ${unattributedFeatures} feature row(s) and ${unattributedSnapshots} snapshot(s) ` +
          `from project_id = '' to "${target}" (operator rule, 2026-08-19).`
        : `No backfill was applied.`),
  );
}

// ─── Migration: the pre-'improved' feature_matrix CHECK constraint ───────────
//
// SQLite cannot ALTER a CHECK constraint, so a database predating the `improved`
// status must be REBUILT. The original did it inline with
//   INSERT INTO feature_matrix_new SELECT * FROM feature_matrix;
// in a bare `db.exec` — a POSITIONAL copy, no count check, no transaction. Run
// against the exact shape it targets (the 13-column pre-`project_id` table, see
// commits a733da4b / bc20b505) it THREW:
//
//   table feature_matrix_new has 14 columns but 13 values were supplied
//
// and, because nothing was transactional, left a stray empty `feature_matrix_new`
// behind — after which EVERY later boot died on `CREATE TABLE feature_matrix_new`.
// The block also declared the table WITHOUT `source` and with the pre-wave-16
// `UNIQUE(module_id, feature_name)` key, so had it ever succeeded it would have
// undone both waves.
//
// This rebuild copies by EXPLICIT column list (intersected with what the source
// actually holds), verifies the copied row count and throws INSIDE the transaction
// before anything is dropped — the recorded convention, and the shape
// `migrateFeatureMatrixProjectKey` above already follows.

/** Temp table name for this rebuild. Deliberately NOT `feature_matrix_new`: a DB
 *  bitten by the old block still carries one, and a collision there is what made
 *  it unbootable. */
const IMPROVED_REBUILD_TABLE = 'feature_matrix_improved_rebuild';

function migrateFeatureMatrixImprovedStatus(database: Database.Database): void {
  const sqlRow = database
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='feature_matrix'")
    .get() as { sql: string } | undefined;
  if (!sqlRow?.sql || sqlRow.sql.includes("'improved'")) return;

  // Clear the wreckage of the old broken rebuild, but only when it is provably
  // empty (which is what a CREATE-then-failed-INSERT leaves). Anything else is
  // reported and left alone — this migration does not delete rows it cannot account for.
  const stray = database
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='feature_matrix_new'")
    .get() as { name: string } | undefined;
  if (stray) {
    const strayRows = countRows(database, 'feature_matrix_new');
    if (strayRows === 0) {
      database.exec('DROP TABLE feature_matrix_new');
      logger.warn(
        `[db] dropped a stray EMPTY feature_matrix_new — the residue of the old positional ` +
          `rebuild, which failed and then blocked every subsequent boot.`,
      );
    } else {
      logger.warn(
        `[db] a stray feature_matrix_new holding ${strayRows} row(s) was found and LEFT IN PLACE. ` +
          `The rebuild below uses its own table name, so it does not collide — inspect it by hand.`,
      );
    }
  }

  const present = new Set(
    (database.prepare('PRAGMA table_info(feature_matrix)').all() as { name: string }[]).map((c) => c.name),
  );
  // Only what the SOURCE actually holds is copied; the rest take the new table's
  // declared defaults (project_id '' / source 'unknown' — the honest reading for a
  // row written before either column existed).
  const copyList = FEATURE_MATRIX_COLUMN_LIST.filter((c) => present.has(c)).join(', ');
  const rowsBefore = countRows(database, 'feature_matrix');

  const rebuild = database.transaction(() => {
    database.exec(`
      CREATE TABLE ${IMPROVED_REBUILD_TABLE} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        module_id TEXT NOT NULL,
        feature_name TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'general',
        status TEXT NOT NULL DEFAULT 'unknown'
          CHECK(status IN ('implemented', 'improved', 'partial', 'missing', 'unknown')),
        description TEXT NOT NULL DEFAULT '',
        file_paths TEXT NOT NULL DEFAULT '[]',
        review_notes TEXT NOT NULL DEFAULT '',
        quality_score INTEGER,
        next_steps TEXT NOT NULL DEFAULT '',
        last_reviewed_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        project_id TEXT NOT NULL DEFAULT '',
        source TEXT NOT NULL DEFAULT 'unknown',
        UNIQUE(module_id, feature_name)
      )
    `);
    database.exec(
      `INSERT INTO ${IMPROVED_REBUILD_TABLE} (${copyList}) SELECT ${copyList} FROM feature_matrix`,
    );

    const copied = countRows(database, IMPROVED_REBUILD_TABLE);
    if (copied !== rowsBefore) {
      throw new Error(
        `[db] feature_matrix 'improved' rebuild ABORTED: copied ${copied} of ${rowsBefore} rows. ` +
          `Nothing was dropped; the original table is intact.`,
      );
    }

    database.exec('DROP TABLE feature_matrix');
    database.exec(`ALTER TABLE ${IMPROVED_REBUILD_TABLE} RENAME TO feature_matrix`);
  });

  rebuild();

  logger.info(
    `[db] feature_matrix rebuilt for the 'improved' status: ${rowsBefore} row(s) copied by name ` +
      `(${copyList}). The project key is widened by the migration that follows.`,
  );
}

// ─── Migration: session_analytics ISO timestamp defaults ─────────────────────
//
// `CREATE TABLE IF NOT EXISTS` never updates an existing table's schema, so
// installs created before the ISO default change still carry `datetime('now')` —
// space-separated, which sorts BELOW 'T' and drops the row out of every
// lexicographic week-range filter. SQLite cannot alter a column default in place,
// so this is a rebuild too, and it carried the same `SELECT *` / no-transaction /
// no-count-check pattern as the one above.

const SESSION_ANALYTICS_COLUMN_LIST = [
  'id', 'module_id', 'session_key', 'prompt', 'prompt_preview', 'had_project_context',
  'prompt_length', 'success', 'duration_ms', 'started_at', 'completed_at',
];
const SESSION_ANALYTICS_REBUILD_TABLE = 'session_analytics_iso_rebuild';

function migrateSessionAnalyticsIsoDefaults(database: Database.Database): void {
  const saSql = database
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='session_analytics'")
    .get() as { sql: string } | undefined;
  if (!saSql?.sql || !saSql.sql.includes("datetime('now')")) return;

  const present = new Set(
    (database.prepare('PRAGMA table_info(session_analytics)').all() as { name: string }[]).map((c) => c.name),
  );
  const copyList = SESSION_ANALYTICS_COLUMN_LIST.filter((c) => present.has(c)).join(', ');
  const rowsBefore = countRows(database, 'session_analytics');

  const rebuild = database.transaction(() => {
    database.exec(`
      CREATE TABLE ${SESSION_ANALYTICS_REBUILD_TABLE} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        module_id TEXT NOT NULL,
        session_key TEXT NOT NULL,
        prompt TEXT NOT NULL,
        prompt_preview TEXT NOT NULL,
        had_project_context INTEGER NOT NULL DEFAULT 0,
        prompt_length INTEGER NOT NULL DEFAULT 0,
        success INTEGER NOT NULL DEFAULT 0,
        duration_ms INTEGER NOT NULL DEFAULT 0,
        started_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        completed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      )
    `);
    database.exec(
      `INSERT INTO ${SESSION_ANALYTICS_REBUILD_TABLE} (${copyList}) SELECT ${copyList} FROM session_analytics`,
    );

    const copied = countRows(database, SESSION_ANALYTICS_REBUILD_TABLE);
    if (copied !== rowsBefore) {
      throw new Error(
        `[db] session_analytics ISO rebuild ABORTED: copied ${copied} of ${rowsBefore} rows. ` +
          `Nothing was dropped; the original table is intact.`,
      );
    }

    database.exec('DROP TABLE session_analytics');
    database.exec(`ALTER TABLE ${SESSION_ANALYTICS_REBUILD_TABLE} RENAME TO session_analytics`);
    // Rows written under the old default keep their space-separated stamp until
    // they are normalized — same transaction, so a failure leaves neither half.
    database.exec(
      "UPDATE session_analytics SET started_at = replace(started_at, ' ', 'T') || 'Z' WHERE started_at LIKE '% %'",
    );
    database.exec(
      "UPDATE session_analytics SET completed_at = replace(completed_at, ' ', 'T') || 'Z' WHERE completed_at LIKE '% %'",
    );
  });

  rebuild();

  logger.info(
    `[db] session_analytics rebuilt onto the ISO timestamp defaults: ${rowsBefore} row(s) copied by name.`,
  );
}

// ─── Prepared-statement cache ────────────────────────────────────────────────
// better-sqlite3 recompiles the SQL on EVERY prepare() call — it has no internal
// statement cache. Hot paths that re-prepare the same static SQL per invocation
// (settings, single-row lookups) pay that compile cost each time on the shared
// synchronous connection. Memoize the compiled statement per connection; keyed on
// the live Database instance so a swapped connection (e.g. a test DB) invalidates
// the cache instead of handing back a statement bound to a stale handle.
let stmtCacheDb: Database.Database | null = null;
let stmtCache = new Map<string, Database.Statement>();

export function prepareCached(sql: string): Database.Statement {
  const database = getDb();
  if (stmtCacheDb !== database) {
    stmtCacheDb = database;
    stmtCache = new Map();
  }
  let stmt = stmtCache.get(sql);
  if (!stmt) {
    stmt = database.prepare(sql);
    stmtCache.set(sql, stmt);
  }
  return stmt;
}

export function getSetting(key: string): string | null {
  const row = prepareCached('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  prepareCached('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
}

