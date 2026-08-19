/**
 * The feature_matrix UNIQUE-key migration — rebuild, backfill, and the coexistence
 * it unlocks.
 *
 * The key was `UNIQUE(module_id, feature_name)`, so a feature was physically ONE row
 * across every project: a full upsert under project B REASSIGNED project A's row.
 * Widening it to `(project_id, module_id, feature_name)` needs a table REBUILD
 * (SQLite cannot ALTER a constraint), and a rebuild is exactly where rows get lost —
 * so the migration verifies its own copy before dropping anything, and this suite
 * verifies it against real DB files in the OLD shape.
 *
 * RED BEFORE THE CHANGE (all of it): the key was never widened, so two projects
 * could not hold one feature, and no backfill existed.
 *
 * Each case builds a throwaway SQLite file in the pre-migration shape, seeds it with
 * rows in BOTH states (unattributed `''` and already attributed), then opens it
 * through the real `getDb()` so the real migration runs. `vi.resetModules()` between
 * cases is what lets one file per scenario be opened by a module-level singleton.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const TMP = process.env.TEMP || process.env.TMPDIR || '/tmp';
const POF_PATH = 'C:\\Users\\kazda\\Documents\\Unreal Projects\\PoF';
const JINX_PATH = 'C:\\Users\\kazda\\Documents\\Unreal Projects\\jinx';
const POF_ID = 'c:/users/kazda/documents/unreal projects/pof';
const JINX_ID = 'c:/users/kazda/documents/unreal projects/jinx';

/** The feature_matrix shape as it existed in the real `~/.pof/pof.db` before this
 *  migration: project_id + source present, but the project NOT in the key. */
const OLD_FEATURE_MATRIX = `
  CREATE TABLE feature_matrix (
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
  )`;

const OLD_REVIEW_SNAPSHOTS = `
  CREATE TABLE review_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    module_id TEXT NOT NULL,
    reviewed_at TEXT NOT NULL,
    total INTEGER NOT NULL DEFAULT 0,
    implemented INTEGER NOT NULL DEFAULT 0,
    improved INTEGER NOT NULL DEFAULT 0,
    partial INTEGER NOT NULL DEFAULT 0,
    missing INTEGER NOT NULL DEFAULT 0,
    unknown INTEGER NOT NULL DEFAULT 0,
    avg_quality REAL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    project_id TEXT NOT NULL DEFAULT ''
  )`;

const OLD_RECENT_PROJECTS = `
  CREATE TABLE recent_projects (
    id TEXT PRIMARY KEY,
    project_name TEXT NOT NULL,
    project_path TEXT NOT NULL UNIQUE,
    ue_version TEXT NOT NULL DEFAULT '5.5',
    checklist_json TEXT NOT NULL DEFAULT '{}',
    last_opened_at TEXT NOT NULL DEFAULT (datetime('now')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`;

interface Seed {
  /** Rows written as `(module, feature, project_id)`. */
  features: [string, string, string][];
  /** Snapshots written as `(module, project_id)`. */
  snapshots: [string, string][];
  /** `recent_projects` rows as `(name, path)`. */
  projects: [string, string][];
}

let openHandles: Database.Database[] = [];
const madeFiles: string[] = [];

function buildLegacyDb(tag: string, seed: Seed): string {
  const file = path.join(TMP, `pof-test-fm-keymig-${process.pid}-${tag}.db`);
  for (const suffix of ['', '-wal', '-shm']) {
    if (fs.existsSync(file + suffix)) fs.rmSync(file + suffix);
  }
  madeFiles.push(file);

  const raw = new Database(file);
  raw.exec(OLD_FEATURE_MATRIX);
  raw.exec(OLD_REVIEW_SNAPSHOTS);
  raw.exec(OLD_RECENT_PROJECTS);

  const fm = raw.prepare(
    'INSERT INTO feature_matrix (module_id, feature_name, status, project_id) VALUES (?, ?, ?, ?)',
  );
  for (const [mod, feat, pid] of seed.features) fm.run(mod, feat, 'implemented', pid);

  const rs = raw.prepare(
    "INSERT INTO review_snapshots (module_id, reviewed_at, total, project_id) VALUES (?, '2026-01-01T00:00:00.000Z', 1, ?)",
  );
  for (const [mod, pid] of seed.snapshots) rs.run(mod, pid);

  const rp = raw.prepare(
    'INSERT INTO recent_projects (id, project_name, project_path, last_opened_at) VALUES (?, ?, ?, ?)',
  );
  seed.projects.forEach(([name, p], i) => rp.run(`id-${i}`, name, p, `2026-08-0${i + 1}`));

  // Stamped BELOW the current SCHEMA_VERSION, exactly like the DB in the field —
  // otherwise the one-off probes (and this migration with them) are skipped.
  raw.pragma('user_version = 2');
  raw.close();
  return file;
}

/** Open a legacy file through the REAL app bootstrap, so the real migration runs. */
async function openThroughApp(file: string) {
  process.env.POF_DB_PATH = file;
  vi.resetModules();
  const dbMod = await import('@/lib/db');
  const fmMod = await import('@/lib/feature-matrix-db');
  const handle = dbMod.getDb();
  openHandles.push(handle);
  return { db: handle, fm: fmMod };
}

function count(db: Database.Database, table: string): number {
  return (db.prepare(`SELECT COUNT(*) as c FROM ${table}`).get() as { c: number }).c;
}

function projectIds(db: Database.Database, table: string): Record<string, number> {
  const rows = db
    .prepare(`SELECT project_id, COUNT(*) as c FROM ${table} GROUP BY project_id`)
    .all() as { project_id: string; c: number }[];
  return Object.fromEntries(rows.map((r) => [r.project_id, r.c]));
}

afterEach(() => {
  for (const h of openHandles) {
    try { h.close(); } catch { /* already closed */ }
  }
  openHandles = [];
});

// ─────────────────────────────────────────────────────────────────────────────

describe('the migration preserves EXACT row counts', () => {
  it('rebuilds feature_matrix without losing or duplicating a single row', async () => {
    const seed: Seed = {
      features: [
        ['arpg-combat', 'f1', ''],
        ['arpg-combat', 'f2', ''],
        ['arpg-combat', 'f3', JINX_ID],
        ['arpg-loot', 'f4', ''],
        ['arpg-loot', 'f5', POF_ID],
      ],
      snapshots: [['arpg-combat', ''], ['arpg-combat', ''], ['arpg-loot', JINX_ID]],
      projects: [['jinx', JINX_PATH], ['PoF', POF_PATH]],
    };
    const file = buildLegacyDb('counts', seed);

    // Measured from the file itself, before the app ever opens it.
    const pre = new Database(file, { readonly: true });
    const featuresBefore = count(pre, 'feature_matrix');
    const snapshotsBefore = count(pre, 'review_snapshots');
    pre.close();
    expect(featuresBefore).toBe(5);
    expect(snapshotsBefore).toBe(3);

    const { db } = await openThroughApp(file);
    expect(count(db, 'feature_matrix')).toBe(featuresBefore);
    expect(count(db, 'review_snapshots')).toBe(snapshotsBefore);
  });

  it('leaves the widened key in place, and every column value intact', async () => {
    const file = buildLegacyDb('shape', {
      features: [['arpg-combat', 'kept', JINX_ID]],
      snapshots: [],
      projects: [['PoF', POF_PATH]],
    });
    const { db } = await openThroughApp(file);

    const sql = (db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='feature_matrix'")
      .get() as { sql: string }).sql;
    expect(sql).toContain('UNIQUE(project_id, module_id, feature_name)');
    expect(sql).not.toMatch(/UNIQUE\(module_id, feature_name\)/);

    // The row survived with its own values — not defaulted by the rebuild.
    const row = db.prepare('SELECT * FROM feature_matrix').get() as Record<string, unknown>;
    expect(row.feature_name).toBe('kept');
    expect(row.status).toBe('implemented');
    expect(row.project_id).toBe(JINX_ID);
  });

  it('is idempotent — a second bootstrap of the same file rebuilds nothing', async () => {
    const file = buildLegacyDb('idem', {
      features: [['arpg-combat', 'f1', ''], ['arpg-combat', 'f2', JINX_ID]],
      snapshots: [['arpg-combat', '']],
      projects: [['PoF', POF_PATH]],
    });
    const first = await openThroughApp(file);
    const afterFirst = {
      features: count(first.db, 'feature_matrix'),
      ids: projectIds(first.db, 'feature_matrix'),
    };
    first.db.close();

    const second = await openThroughApp(file);
    expect(count(second.db, 'feature_matrix')).toBe(afterFirst.features);
    expect(projectIds(second.db, 'feature_matrix')).toEqual(afterFirst.ids);
  });
});

describe('the backfill follows the operator rule, derived — never hardcoded', () => {
  it('attributes every unattributed row to the PoF project from recent_projects', async () => {
    const file = buildLegacyDb('backfill', {
      features: [
        ['arpg-combat', 'f1', ''],
        ['arpg-combat', 'f2', ''],
        ['arpg-combat', 'f3', JINX_ID],
      ],
      snapshots: [['arpg-combat', ''], ['arpg-loot', '']],
      projects: [['jinx', JINX_PATH], ['PoF', POF_PATH]],
    });
    const { db } = await openThroughApp(file);

    // No `''` rows left in EITHER table, and the already-attributed row is untouched.
    expect(projectIds(db, 'feature_matrix')).toEqual({ [POF_ID]: 2, [JINX_ID]: 1 });
    expect(projectIds(db, 'review_snapshots')).toEqual({ [POF_ID]: 2 });
  });

  it('matches the PoF project however its path is spelled', async () => {
    const file = buildLegacyDb('spelling', {
      features: [['arpg-combat', 'f1', '']],
      snapshots: [],
      // Trailing separator + different casing: the SAME project, and the migration
      // must normalize it exactly as the app does or the backfilled id is unmatchable.
      projects: [['PoF', 'C:/Users/kazda/Documents/Unreal Projects/pof/']],
    });
    const { db } = await openThroughApp(file);
    expect(projectIds(db, 'feature_matrix')).toEqual({ [POF_ID]: 1 });
  });

  it('does NOT guess an owner when recent_projects holds no PoF project', async () => {
    const file = buildLegacyDb('noguess', {
      features: [['arpg-combat', 'f1', ''], ['arpg-combat', 'f2', JINX_ID]],
      snapshots: [['arpg-combat', '']],
      projects: [['jinx', JINX_PATH]],
    });
    const { db } = await openThroughApp(file);

    // The key is still widened (no row is at risk), but nothing was attributed:
    // the rows stay unattributed and stay visible to every project.
    const sql = (db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='feature_matrix'")
      .get() as { sql: string }).sql;
    expect(sql).toContain('UNIQUE(project_id, module_id, feature_name)');
    expect(projectIds(db, 'feature_matrix')).toEqual({ '': 1, [JINX_ID]: 1 });
    expect(projectIds(db, 'review_snapshots')).toEqual({ '': 1 });
  });
});

describe('what the widened key unlocks: two projects, one feature, no takeover', () => {
  it('both projects hold (module, feature) at once and neither overwrites the other', async () => {
    const file = buildLegacyDb('coexist', { features: [], snapshots: [], projects: [['PoF', POF_PATH]] });
    const { db, fm } = await openThroughApp(file);

    const mkRow = (status: 'implemented' | 'missing') => ({
      featureName: 'Shared Feature',
      category: 'Core',
      status,
      description: '',
      filePaths: [] as string[],
      reviewNotes: '',
      qualityScore: 4,
      nextSteps: '',
      lastReviewedAt: '2026-08-18T00:00:00.000Z',
    });

    const a = fm.upsertFeatures('arpg-combat', [mkRow('implemented')], { projectId: POF_PATH });
    const b = fm.upsertFeatures('arpg-combat', [mkRow('missing')], { projectId: JINX_PATH });

    // RED before the key change: b.takenOver was 1 and A's row was gone.
    expect(a.takenOver).toBe(0);
    expect(b.takenOver).toBe(0);
    expect(count(db, 'feature_matrix')).toBe(2);
    expect(fm.getFeaturesByModule('arpg-combat', POF_PATH)[0].status).toBe('implemented');
    expect(fm.getFeaturesByModule('arpg-combat', JINX_PATH)[0].status).toBe('missing');

    // ...and a status fix under one project cannot move the other's row.
    fm.updateFeatureStatus('arpg-combat', 'Shared Feature', 'partial', { projectId: JINX_PATH });
    expect(fm.getFeaturesByModule('arpg-combat', POF_PATH)[0].status).toBe('implemented');
    expect(fm.getFeaturesByModule('arpg-combat', JINX_PATH)[0].status).toBe('partial');
  });

  it('backfilled rows are readable by the project they were attributed to', async () => {
    const file = buildLegacyDb('readback', {
      features: [['arpg-combat', 'legacy-feature', '']],
      snapshots: [],
      projects: [['PoF', POF_PATH]],
    });
    const { fm } = await openThroughApp(file);
    expect(fm.getFeaturesByModule('arpg-combat', POF_PATH).map((f) => f.featureName))
      .toEqual(['legacy-feature']);
    // The other project no longer sees it — it is attributed now, not legacy.
    expect(fm.getFeaturesByModule('arpg-combat', JINX_PATH)).toHaveLength(0);
  });
});
