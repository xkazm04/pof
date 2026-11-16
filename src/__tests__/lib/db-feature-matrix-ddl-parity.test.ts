// @vitest-environment node
/**
 * feature_matrix's column set is declared ONCE in db.ts (`featureMatrixDdl`) and used by the
 * bootstrap CREATE and both rebuild migrations (project key, 'improved' status). A hand-copied
 * body per rebuild let a column added to the bootstrap and forgotten in a rebuild be dropped
 * on an older DB; the copy LISTS are gated by db-rebuild-column-lists.test.ts, the DDL by this.
 *
 * Runs against throwaway DB files under the OS temp dir, never ~/.pof/pof.db.
 */
import { describe, it, expect, vi, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const TMP = process.env.TEMP || process.env.TMPDIR || '/tmp';
const made: string[] = [];
const handles: Database.Database[] = [];

/** The 13-column pre-`project_id`, pre-'improved' table the 'improved' rebuild targets. */
const PRE_IMPROVED = `
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

function dbFile(tag: string): string {
  const file = path.join(TMP, `pof-test-fm-ddl-${process.pid}-${tag}.db`);
  for (const s of ['', '-wal', '-shm']) if (fs.existsSync(file + s)) fs.rmSync(file + s);
  made.push(file);
  return file;
}

async function openThroughApp(file: string) {
  process.env.POF_DB_PATH = file;
  vi.resetModules();
  const { getDb } = await import('@/lib/db');
  const handle = getDb();
  handles.push(handle);
  return handle;
}

function shape(db: Database.Database) {
  return db.prepare('PRAGMA table_info(feature_matrix)').all();
}

afterAll(() => {
  for (const h of handles) if (h.open) h.close();
  for (const f of made) for (const s of ['', '-wal', '-shm']) fs.rmSync(f + s, { force: true });
});

describe('feature_matrix DDL has one source of truth', () => {
  it('db.ts declares the column set once', () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'src/lib/db.ts'), 'utf-8');
    const blocks = src.match(/quality_score INTEGER,/g) ?? [];
    expect(blocks).toHaveLength(1);
  });

  it('a rebuilt legacy table has the fresh bootstrap\'s exact columns', async () => {
    const fresh = shape(await openThroughApp(dbFile('fresh')));
    const legacyFile = dbFile('legacy');
    const raw = new Database(legacyFile);
    raw.exec(PRE_IMPROVED);
    raw.exec("INSERT INTO feature_matrix (module_id, feature_name, status) VALUES ('m', 'f', 'implemented')");
    raw.pragma('user_version = 2');
    raw.close();
    const db = await openThroughApp(legacyFile);
    expect(shape(db)).toEqual(fresh);
    expect((db.prepare('SELECT COUNT(*) AS c FROM feature_matrix').get() as { c: number }).c).toBe(1);
  });
});
