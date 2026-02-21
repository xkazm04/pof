import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';
import fs from 'fs';

const DB_DIR = path.join(os.homedir(), '.pof');
const DB_PATH = path.join(DB_DIR, 'pof.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

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
      UNIQUE(module_id, feature_name)
    )
  `);

  // Migrate: add columns if missing (table may already exist from earlier schema)
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

  // Review snapshots — captures module state at each review for trend tracking
  db.exec(`
    CREATE TABLE IF NOT EXISTS review_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      module_id TEXT NOT NULL,
      reviewed_at TEXT NOT NULL,
      total INTEGER NOT NULL DEFAULT 0,
      implemented INTEGER NOT NULL DEFAULT 0,
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
  const fmCols = db.prepare("PRAGMA table_info(feature_matrix)").all() as { name: string }[];
  if (!new Set(fmCols.map((c) => c.name)).has('project_id')) {
    db.exec("ALTER TABLE feature_matrix ADD COLUMN project_id TEXT NOT NULL DEFAULT ''");
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

  // Headless build results — tracks UBT builds triggered from PoF
  db.exec(`
    CREATE TABLE IF NOT EXISTS headless_builds (
      id TEXT PRIMARY KEY,
      project_path TEXT NOT NULL,
      target_name TEXT NOT NULL,
      platform TEXT NOT NULL,
      configuration TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('queued','running','success','failed','aborted')),
      started_at TEXT,
      completed_at TEXT,
      duration_ms INTEGER,
      exit_code INTEGER,
      error_count INTEGER DEFAULT 0,
      warning_count INTEGER DEFAULT 0,
      output_log TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_headless_builds_project
    ON headless_builds(project_path, created_at DESC)
  `);

  return db;
}

export function getSetting(key: string): string | null {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  getDb().prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
}

