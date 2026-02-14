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
        CHECK(status IN ('implemented', 'partial', 'missing', 'unknown')),
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
  if (!new Set(rsCols.map((c) => c.name)).has('project_id')) {
    db.exec("ALTER TABLE review_snapshots ADD COLUMN project_id TEXT NOT NULL DEFAULT ''");
  }

  const bhCols = db.prepare("PRAGMA table_info(build_history)").all() as { name: string }[];
  if (!new Set(bhCols.map((c) => c.name)).has('project_id')) {
    db.exec("ALTER TABLE build_history ADD COLUMN project_id TEXT NOT NULL DEFAULT ''");
  }

  return db;
}

export function getSetting(key: string): string | null {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  getDb().prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
}

