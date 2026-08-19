/**
 * `getDb()` bootstrap atomicity, and the two LEGACY table rebuilds inside it.
 *
 * Two defects this suite pins, both measured before the fix:
 *
 * 1. The singleton was assigned BEFORE any DDL ran, so a throw anywhere in the
 *    ~400-line bootstrap cached a HALF-BUILT connection: every later `getDb()`
 *    handed it back and the app 500'd with "no such table: X" at random query
 *    sites for the rest of the process. The file's own comment claimed the
 *    migrations would "retry next time" — untrue in a long-lived server.
 *
 * 2. The legacy `feature_matrix` rebuild copied with `INSERT ... SELECT *` (a
 *    POSITIONAL copy) in a bare `db.exec`, with no count check and no
 *    transaction. Executed against the exact shape it targets — the
 *    pre-`improved` 13-column table — it threw
 *      `table feature_matrix_new has 14 columns but 13 values were supplied`
 *    and left a stray, empty `feature_matrix_new` behind, which made EVERY
 *    subsequent boot fail on `CREATE TABLE feature_matrix_new`.
 *
 * Each case builds a throwaway SQLite file, points `POF_DB_PATH` at it and opens
 * it through the REAL `getDb()`; `vi.resetModules()` is what lets one file per
 * scenario be opened by a module-level singleton. The user's real
 * `~/.pof/pof.db` is never opened here.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const TMP = process.env.TEMP || process.env.TMPDIR || '/tmp';
const POF_PATH = 'C:\\Users\\kazda\\Documents\\Unreal Projects\\PoF';
const POF_ID = 'c:/users/kazda/documents/unreal projects/pof';

/**
 * `feature_matrix` EXACTLY as it shipped before the `improved` status existed
 * (commits a733da4b / bc20b505): THIRTEEN columns, no `project_id`, no `source`.
 * This is the shape the legacy rebuild branch keys off, and the shape it threw on.
 */
const PRE_IMPROVED_FEATURE_MATRIX = `
  CREATE TABLE feature_matrix (
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
  )`;

/** `session_analytics` before the ISO default change: `datetime('now')` defaults. */
const LEGACY_SESSION_ANALYTICS = `
  CREATE TABLE session_analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    module_id TEXT NOT NULL,
    session_key TEXT NOT NULL,
    prompt TEXT NOT NULL,
    prompt_preview TEXT NOT NULL,
    had_project_context INTEGER NOT NULL DEFAULT 0,
    prompt_length INTEGER NOT NULL DEFAULT 0,
    success INTEGER NOT NULL DEFAULT 0,
    duration_ms INTEGER NOT NULL DEFAULT 0,
    started_at TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`;

let openHandles: Database.Database[] = [];
const madeFiles: string[] = [];

function newDbFile(tag: string): string {
  const file = path.join(TMP, `pof-test-bootstrap-${process.pid}-${tag}.db`);
  for (const suffix of ['', '-wal', '-shm']) {
    if (fs.existsSync(file + suffix)) fs.rmSync(file + suffix);
  }
  madeFiles.push(file);
  return file;
}

/** Load a FRESH copy of the db module bound to `file`. */
async function loadDbModule(file: string) {
  process.env.POF_DB_PATH = file;
  vi.resetModules();
  return import('@/lib/db');
}

async function openThroughApp(file: string): Promise<Database.Database> {
  const mod = await loadDbModule(file);
  const handle = mod.getDb();
  openHandles.push(handle);
  return handle;
}

function tableNames(db: Database.Database): string[] {
  return (db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[])
    .map((r) => r.name);
}

function tableSql(db: Database.Database, name: string): string {
  const row = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name=?").get(name) as
    | { sql: string }
    | undefined;
  return row?.sql ?? '';
}

function count(db: Database.Database, table: string): number {
  return (db.prepare(`SELECT COUNT(*) as c FROM ${table}`).get() as { c: number }).c;
}

afterEach(() => {
  for (const h of openHandles) {
    try { h.close(); } catch { /* already closed */ }
  }
  openHandles = [];
});

// ─────────────────────────────────────────────────────────────────────────────

describe('a bootstrap that throws is never cached as a working connection', () => {
  /**
   * A VIEW named `eval_findings` makes the bootstrap throw at a KNOWN point:
   * `CREATE TABLE IF NOT EXISTS eval_findings` quietly no-ops against the view,
   * and the very next statement — `CREATE INDEX ... ON eval_findings(...)` —
   * throws "views may not be indexed". By then `settings` / `feature_matrix` /
   * `review_snapshots` exist; `recent_projects`, `session_analytics` and
   * everything after them do not. That is a half-built connection, precisely.
   */
  function buildBlockedDb(tag: string): string {
    const file = newDbFile(tag);
    const raw = new Database(file);
    raw.exec('CREATE VIEW eval_findings AS SELECT 1 AS x');
    raw.close();
    return file;
  }

  it('re-attempts on the next call instead of handing back a half-built handle', async () => {
    const file = buildBlockedDb('blocked');
    const mod = await loadDbModule(file);

    expect(() => mod.getDb()).toThrow(/may not be indexed/);

    // RED before the fix: the second call returned the cached, half-built
    // connection — no throw, and `recent_projects` simply did not exist on it.
    let second: Database.Database | null = null;
    expect(() => { second = mod.getDb(); }).toThrow(/may not be indexed/);
    expect(second).toBeNull();
  });

  it('leaves no stray rebuild table behind when the bootstrap fails', async () => {
    const file = buildBlockedDb('blocked-stray');
    const mod = await loadDbModule(file);
    expect(() => mod.getDb()).toThrow();

    const raw = new Database(file, { readonly: true });
    openHandles.push(raw);
    expect(tableNames(raw).filter((n) => /_new$|_rebuild$|_projectkey$/.test(n))).toEqual([]);
  });

  it('recovers fully once the cause is removed — the retry really re-runs the DDL', async () => {
    const file = buildBlockedDb('recover');
    const mod = await loadDbModule(file);
    expect(() => mod.getDb()).toThrow();

    const fixer = new Database(file);
    fixer.exec('DROP VIEW eval_findings');
    fixer.close();

    // RED before the fix: this returned the SAME half-built handle and the
    // assertion below died with "no such table: recent_projects".
    const db = mod.getDb();
    openHandles.push(db);
    expect(count(db, 'recent_projects')).toBe(0);
    expect(count(db, 'session_analytics')).toBe(0);
    expect(count(db, 'eval_findings')).toBe(0);
  });
});

describe("the legacy 'improved' status rebuild", () => {
  function buildPreImprovedDb(
    tag: string,
    opts: { rows?: number; projects?: [string, string][]; strayNewTable?: boolean } = {},
  ): string {
    const file = newDbFile(tag);
    const raw = new Database(file);
    raw.exec(PRE_IMPROVED_FEATURE_MATRIX);
    const insert = raw.prepare(
      `INSERT INTO feature_matrix
         (module_id, feature_name, category, status, description, file_paths,
          review_notes, quality_score, next_steps, last_reviewed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (let i = 0; i < (opts.rows ?? 3); i++) {
      insert.run(
        'arpg-combat', `feature-${i}`, 'Core', 'implemented', `desc-${i}`,
        JSON.stringify([`Source/f${i}.cpp`]), `notes-${i}`, 4, `next-${i}`, '2026-01-01T00:00:00.000Z',
      );
    }
    if (opts.projects) {
      raw.exec(`
        CREATE TABLE recent_projects (
          id TEXT PRIMARY KEY,
          project_name TEXT NOT NULL,
          project_path TEXT NOT NULL UNIQUE,
          ue_version TEXT NOT NULL DEFAULT '5.5',
          checklist_json TEXT NOT NULL DEFAULT '{}',
          last_opened_at TEXT NOT NULL DEFAULT (datetime('now')),
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )`);
      const rp = raw.prepare(
        'INSERT INTO recent_projects (id, project_name, project_path, last_opened_at) VALUES (?, ?, ?, ?)',
      );
      opts.projects.forEach(([name, p], i) => rp.run(`id-${i}`, name, p, `2026-08-0${i + 1}`));
    }
    if (opts.strayNewTable) {
      // EXACTLY what the old broken rebuild left behind: the CREATE succeeded,
      // the positional INSERT threw, and nothing was in a transaction.
      raw.exec(`
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
        )`);
    }
    raw.pragma('user_version = 0');
    raw.close();
    return file;
  }

  it('opens a pre-improved DB at all — it threw on the shape it targets', async () => {
    const file = buildPreImprovedDb('legacy-open', { rows: 3 });
    // RED before the fix, verbatim:
    //   table feature_matrix_new has 14 columns but 13 values were supplied
    const db = await openThroughApp(file);
    expect(count(db, 'feature_matrix')).toBe(3);
  });

  it('copies by NAME, not position — every column value survives', async () => {
    const file = buildPreImprovedDb('legacy-values', { rows: 1 });
    const db = await openThroughApp(file);

    const row = db.prepare('SELECT * FROM feature_matrix').get() as Record<string, unknown>;
    expect(row.module_id).toBe('arpg-combat');
    expect(row.feature_name).toBe('feature-0');
    expect(row.category).toBe('Core');
    expect(row.status).toBe('implemented');
    expect(row.description).toBe('desc-0');
    expect(row.file_paths).toBe(JSON.stringify(['Source/f0.cpp']));
    expect(row.review_notes).toBe('notes-0');
    expect(row.quality_score).toBe(4);
    expect(row.next_steps).toBe('next-0');
    expect(row.last_reviewed_at).toBe('2026-01-01T00:00:00.000Z');
  });

  it('lands on the CURRENT shape — it must not drop source or revert the project key', async () => {
    const file = buildPreImprovedDb('legacy-shape', { rows: 2 });
    const db = await openThroughApp(file);

    const sql = tableSql(db, 'feature_matrix');
    expect(sql).toContain("'improved'");
    expect(sql).toContain('source');
    // Waves 15 and 16 shipped these; the legacy rebuild declared the table
    // without `source` and with the pre-wave-16 key, so a run would have undone both.
    expect(sql).toContain('UNIQUE(project_id, module_id, feature_name)');
    expect(sql).not.toMatch(/UNIQUE\(module_id, feature_name\)/);
    expect(count(db, 'feature_matrix')).toBe(2);
  });

  it('still reaches the wave-16 backfill afterwards', async () => {
    const file = buildPreImprovedDb('legacy-backfill', { rows: 2, projects: [['PoF', POF_PATH]] });
    const db = await openThroughApp(file);

    const ids = (db.prepare('SELECT project_id, COUNT(*) as c FROM feature_matrix GROUP BY project_id')
      .all() as { project_id: string; c: number }[]);
    expect(ids).toEqual([{ project_id: POF_ID, c: 2 }]);
  });

  it('boots past a stray feature_matrix_new left by the old broken rebuild', async () => {
    const file = buildPreImprovedDb('legacy-stray', { rows: 2, strayNewTable: true });
    // RED before the fix: "table feature_matrix_new already exists" — the state the
    // old rebuild left behind made every subsequent boot fail.
    const db = await openThroughApp(file);
    expect(count(db, 'feature_matrix')).toBe(2);
    expect(tableNames(db)).not.toContain('feature_matrix_new');
  });

  it('leaves no temp table behind on a clean run', async () => {
    const file = buildPreImprovedDb('legacy-clean', { rows: 1 });
    const db = await openThroughApp(file);
    expect(tableNames(db).filter((n) => /_new$|_rebuild$|_projectkey$/.test(n))).toEqual([]);
  });
});

describe('the legacy session_analytics ISO-default rebuild', () => {
  it('preserves every row and normalizes the legacy space-separated stamps', async () => {
    const file = newDbFile('sa-legacy');
    const raw = new Database(file);
    raw.exec(LEGACY_SESSION_ANALYTICS);
    const insert = raw.prepare(
      `INSERT INTO session_analytics
         (module_id, session_key, prompt, prompt_preview, had_project_context,
          prompt_length, success, duration_ms, started_at, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    insert.run('arpg-combat', 'k1', 'p1', 'p1', 1, 2, 1, 30, '2026-01-01 10:00:00', '2026-01-01 10:00:05');
    insert.run('arpg-loot', 'k2', 'p2', 'p2', 0, 2, 0, 40, '2026-02-02T10:00:00.000Z', '2026-02-02T10:00:05.000Z');
    raw.pragma('user_version = 0');
    raw.close();

    const db = await openThroughApp(file);
    expect(count(db, 'session_analytics')).toBe(2);
    expect(tableSql(db, 'session_analytics')).not.toContain("datetime('now')");

    const rows = db.prepare('SELECT session_key, prompt, started_at, duration_ms FROM session_analytics ORDER BY id')
      .all() as { session_key: string; prompt: string; started_at: string; duration_ms: number }[];
    expect(rows[0]).toEqual({
      session_key: 'k1', prompt: 'p1', started_at: '2026-01-01T10:00:00Z', duration_ms: 30,
    });
    expect(rows[1]).toEqual({
      session_key: 'k2', prompt: 'p2', started_at: '2026-02-02T10:00:00.000Z', duration_ms: 40,
    });
    expect(tableNames(db)).not.toContain('session_analytics_new');
  });
});

describe('an already-stamped DB is untouched', () => {
  it('opens a user_version 3 database without altering one schema object', async () => {
    // Build it the way the app itself would, then re-open: nothing may move.
    const file = newDbFile('stamped');
    const first = await openThroughApp(file);
    expect(first.pragma('user_version', { simple: true })).toBe(3);
    first.prepare("INSERT INTO settings (key, value) VALUES ('k','v')").run();
    const before = (first.prepare("SELECT type, name, sql FROM sqlite_master ORDER BY type, name").all());
    first.close();

    const again = await openThroughApp(file);
    expect(again.pragma('user_version', { simple: true })).toBe(3);
    expect(again.prepare("SELECT type, name, sql FROM sqlite_master ORDER BY type, name").all()).toEqual(before);
    expect(count(again, 'settings')).toBe(1);
  });
});
