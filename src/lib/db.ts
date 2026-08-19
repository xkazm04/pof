import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';
import fs from 'fs';

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
const SCHEMA_VERSION = 2;

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  // Enforce foreign keys for the whole shared connection (SQLite defaults them OFF, per
  // connection). Without this, declared `REFERENCES ... ON DELETE CASCADE` clauses are
  // decorative — deletes leak orphan child rows and inserts can reference nonexistent
  // parents — and whether they fire becomes non-deterministic based on which feature's
  // init happened to toggle the pragma first.
  db.pragma('foreign_keys = ON');

  // Skip the one-off introspection/rebuild probes once a DB has been stamped at the
  // current schema version — they are idempotent guards whose only job is the initial
  // upgrade, so re-running the PRAGMA table_info / sqlite_master scans on every cold
  // start is pure waste.
  const schemaVersion = db.pragma('user_version', { simple: true }) as number;
  const needsMigrations = schemaVersion < SCHEMA_VERSION;

  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  db.exec(`
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
      source TEXT NOT NULL DEFAULT 'unknown',
      UNIQUE(module_id, feature_name)
    )
  `);

  // Migrate: add columns if missing (table may already exist from earlier schema)
  if (needsMigrations) {
  const cols = db.prepare("PRAGMA table_info(feature_matrix)").all() as { name: string }[];
  const colNames = new Set(cols.map((c) => c.name));
  if (!colNames.has('quality_score')) {
    db.exec('ALTER TABLE feature_matrix ADD COLUMN quality_score INTEGER');
  }
  if (!colNames.has('next_steps')) {
    db.exec("ALTER TABLE feature_matrix ADD COLUMN next_steps TEXT NOT NULL DEFAULT ''");
  }

  // Migrate: update CHECK constraint to allow 'improved' status
  // SQLite cannot ALTER constraints, so we recreate the table if the old constraint is present
  const sqlRow = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='feature_matrix'").get() as { sql: string } | undefined;
  if (sqlRow?.sql && !sqlRow.sql.includes("'improved'")) {
    db.exec(`
      CREATE TABLE feature_matrix_new (
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
        UNIQUE(module_id, feature_name)
      );
      INSERT INTO feature_matrix_new SELECT * FROM feature_matrix;
      DROP TABLE feature_matrix;
      ALTER TABLE feature_matrix_new RENAME TO feature_matrix;
    `);
  }
  }

  // Review snapshots — captures module state at each review for trend tracking
  db.exec(`
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
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Index for fast per-module history lookups
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_review_snapshots_module
    ON review_snapshots(module_id, reviewed_at)
  `);

  // Deep evaluation findings — stores results from multi-pass deep eval scans
  db.exec(`
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

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_eval_findings_scan
    ON eval_findings(scan_id, module_id)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_eval_findings_severity
    ON eval_findings(severity, module_id)
  `);

  // Build history — records every package/build operation for trending & comparison
  db.exec(`
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

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_build_history_platform
    ON build_history(platform, created_at)
  `);

  // Recent projects — tracks all opened projects for the switcher
  db.exec(`
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

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_recent_projects_opened
    ON recent_projects(last_opened_at DESC)
  `);

  // Migrate: add project_id column to scoped tables
  if (needsMigrations) {
  const fmCols = db.prepare("PRAGMA table_info(feature_matrix)").all() as { name: string }[];
  const fmColNames = new Set(fmCols.map((c) => c.name));
  if (!fmColNames.has('project_id')) {
    db.exec("ALTER TABLE feature_matrix ADD COLUMN project_id TEXT NOT NULL DEFAULT ''");
  }
  // Provenance: which write path (review / verify / fix / seed) last set the row's
  // status. Rows written before this column existed default to 'unknown' — the
  // honest reading, since nothing recorded how they were set.
  if (!fmColNames.has('source')) {
    db.exec("ALTER TABLE feature_matrix ADD COLUMN source TEXT NOT NULL DEFAULT 'unknown'");
  }

  const rsCols = db.prepare("PRAGMA table_info(review_snapshots)").all() as { name: string }[];
  const rsColNames = new Set(rsCols.map((c) => c.name));
  if (!rsColNames.has('project_id')) {
    db.exec("ALTER TABLE review_snapshots ADD COLUMN project_id TEXT NOT NULL DEFAULT ''");
  }
  if (!rsColNames.has('improved')) {
    db.exec("ALTER TABLE review_snapshots ADD COLUMN improved INTEGER NOT NULL DEFAULT 0");
  }

  const bhCols = db.prepare("PRAGMA table_info(build_history)").all() as { name: string }[];
  if (!new Set(bhCols.map((c) => c.name)).has('project_id')) {
    db.exec("ALTER TABLE build_history ADD COLUMN project_id TEXT NOT NULL DEFAULT ''");
  }
  }

  // Checklist metadata — stores priority and notes per checklist item
  db.exec(`
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
  db.exec(`
    CREATE TABLE IF NOT EXISTS milestone_deadlines (
      milestone_id TEXT PRIMARY KEY,
      target_date TEXT NOT NULL,
      label TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Project progress — stores full module state (checklist, health, verification, history) per project
  db.exec(`
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
  db.exec(`
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

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_session_log_project
    ON session_log(project_path, created_at)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_session_log_module
    ON session_log(module_id, created_at)
  `);

  // Request log — idempotency key replay detection for import/mutation routes
  db.exec(`
    CREATE TABLE IF NOT EXISTS request_log (
      idempotency_key TEXT PRIMARY KEY,
      route TEXT NOT NULL,
      status_code INTEGER NOT NULL,
      response_body TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_request_log_created
    ON request_log(created_at)
  `);

  // Session analytics — per-CLI-session prompt/outcome telemetry powering the
  // analytics dashboard, insights, and prompt suggestions. Read/written via
  // src/lib/session-analytics-db.ts (plus weekly-digest / project-wrapped /
  // pattern-extractor, which query the table directly).
  db.exec(`
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
  // before the default change still carry datetime('now') (space-separated,
  // sorts below 'T' and falls out of the lexicographic week-range filters).
  // SQLite can't alter a column default in place: rebuild via the
  // feature_matrix pattern and normalize any legacy space-format rows.
  if (needsMigrations) {
  const saSql = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='session_analytics'").get() as { sql: string } | undefined;
  if (saSql?.sql && saSql.sql.includes("datetime('now')")) {
    db.exec(`
      CREATE TABLE session_analytics_new (
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
      );
      INSERT INTO session_analytics_new SELECT * FROM session_analytics;
      DROP TABLE session_analytics;
      ALTER TABLE session_analytics_new RENAME TO session_analytics;
      UPDATE session_analytics SET started_at = replace(started_at, ' ', 'T') || 'Z' WHERE started_at LIKE '% %';
      UPDATE session_analytics SET completed_at = replace(completed_at, ' ', 'T') || 'Z' WHERE completed_at LIKE '% %';
    `);
  }
  }

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_session_analytics_module
    ON session_analytics(module_id)
  `);

  // Telemetry snapshots + genre suggestions — drive the genre-evolution engine
  // (TelemetryEvolution module). Read/written via src/lib/telemetry-db.ts.
  db.exec(`
    CREATE TABLE IF NOT EXISTS telemetry_snapshots (
      id TEXT PRIMARY KEY,
      scanned_at TEXT NOT NULL DEFAULT (datetime('now')),
      project_path TEXT NOT NULL,
      signals TEXT NOT NULL DEFAULT '{}',
      detected_patterns TEXT NOT NULL DEFAULT '[]'
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_telemetry_snapshots_time
    ON telemetry_snapshots(scanned_at DESC)
  `);

  db.exec(`
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

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_genre_suggestions_status
    ON genre_suggestions(status, created_at DESC)
  `);

  // GDD compliance gap triage. Read/written only by src/lib/gdd-compliance.ts.
  // Gap ids are deterministic across audits, so a resolution is durable: it is
  // re-applied to every subsequent report instead of dying with the browser tab.
  // Scoped by project — gap ids are only unique within one project. An audit that
  // carries no project scope (e.g. the pof_gdd_compliance MCP tool) uses the empty
  // string, so it sees only unscoped resolutions rather than another project's.
  db.exec(`
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
  // cold start. Only advances after a clean bootstrap; a throw earlier leaves the
  // version untouched so migrations retry next time.
  if (needsMigrations) db.pragma(`user_version = ${SCHEMA_VERSION}`);

  return db;
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

