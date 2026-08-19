import { execSync } from 'node:child_process';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Where the test suite's SQLite lives.
 *
 * `src/lib/db.ts` resolves `process.env.POF_DB_PATH || ~/.pof/pof.db`, and until now the
 * override was per-test opt-in — which meant every suite that forgot it wrote into the
 * OPERATOR'S REAL DATABASE. It was not hypothetical: on 2026-08-19 the live DB held 344
 * `pipeline_artifacts`, 114 `judge_verdicts`, 255 `judge_verdict_history` and 383
 * `pipeline_artifact_revisions` rows belonging to synthetic harness entities, the newest of
 * them stamped minutes after a `npm run validate` gate run. Two-fifths of the artifact table
 * was test residue that `/status`, the drain and the prompt-fitness join all had to read past.
 *
 * `vitest.config.ts` feeds this into `test.env`, which vitest applies to every worker BEFORE
 * any module in it loads — so no import order can bypass it, unlike a `setupFiles` assignment
 * that races `import '@/lib/db'`. Files that set their own `vi.hoisted` override still win;
 * this is the floor, not a ceiling.
 *
 * Keyed by the vitest process's own pid so two `npm run validate` runs in this shared
 * checkout cannot fight over one SQLite file.
 */
export function testDbPath(): string {
  return path.join(os.tmpdir(), 'pof-vitest', `pof-test-${process.pid}.db`);
}

/** The database this guard is protecting — the one `db.ts` falls back to. */
function realDbPath(): string {
  return path.join(os.homedir(), '.pof', 'pof.db');
}

/**
 * A fingerprint of the FIXTURE rows in the operator's real DB: how many synthetic-entity
 * rows each table holds and the newest timestamp among them.
 *
 * Deliberately scoped to synthetic entities rather than to whole-table counts. A whole-table
 * snapshot cannot tell a test's write apart from the dev server or a parallel session
 * legitimately producing an artifact mid-run, and a guard that reds the gate for someone
 * else's honest work gets disabled within a week. Nothing but a test harness ever writes an
 * entity id `isSyntheticEntity` recognises, so an increase here is attributable to this run.
 */
interface FixtureFingerprint {
  [table: string]: { rows: number; newest: string | null };
}

const FIXTURE_TABLES: ReadonlyArray<{ table: string; stamp: string }> = [
  { table: 'pipeline_artifacts', stamp: 'updated_at' },
  { table: 'pipeline_artifact_revisions', stamp: 'archived_at' },
  { table: 'judge_verdicts', stamp: 'judged_at' },
  { table: 'judge_verdict_history', stamp: 'judged_at' },
];

/** Mirrors `isSyntheticEntity` (`test-headless*` / `item-mcp-smoke`) in SQL. */
const SYNTHETIC_SQL = "(entity_id LIKE 'test-headless%' OR entity_id = 'item-mcp-smoke')";

/**
 * Read the fingerprint, or `null` when it cannot be read at all (no DB yet on a fresh
 * machine, native module unavailable, a concurrent writer holding an exclusive lock). A
 * guard that cannot measure says so by returning null and stays silent — it must never fail
 * a run for its own inability to look.
 */
function fingerprintRealDb(): FixtureFingerprint | null {
  const file = realDbPath();
  if (!fs.existsSync(file)) return null;
  let db: Database.Database | null = null;
  try {
    db = new Database(file, { readonly: true, fileMustExist: true });
    const out: FixtureFingerprint = {};
    for (const { table, stamp } of FIXTURE_TABLES) {
      const exists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table);
      if (!exists) continue;
      const row = db
        .prepare(`SELECT count(*) AS rows, max(${stamp}) AS newest FROM ${table} WHERE ${SYNTHETIC_SQL}`)
        .get() as { rows: number; newest: string | null };
      out[table] = { rows: row.rows, newest: row.newest };
    }
    return out;
  } catch {
    return null;
  } finally {
    db?.close();
  }
}

function describeDrift(before: FixtureFingerprint, after: FixtureFingerprint): string[] {
  const drift: string[] = [];
  for (const table of Object.keys(after)) {
    const b = before[table] ?? { rows: 0, newest: null };
    const a = after[table];
    if (a.rows !== b.rows) drift.push(`${table}: ${b.rows} → ${a.rows} fixture rows`);
    else if (a.newest !== b.newest) drift.push(`${table}: ${b.rows} fixture rows re-written (newest ${b.newest ?? 'none'} → ${a.newest ?? 'none'})`);
  }
  return drift;
}

let baseline: FixtureFingerprint | null = null;

export default function setup() {
  /** Ensure the (gitignored) pipeline registry barrel exists before any test imports it. */
  execSync('node scripts/gen-pipeline-registry.mjs', { stdio: 'ignore' });

  // Start every run from an empty test DB. Leftovers from a previous run would make a suite's
  // reads depend on whatever the last one happened to write.
  const file = testDbPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  for (const f of [file, `${file}-wal`, `${file}-shm`]) {
    if (fs.existsSync(f)) fs.rmSync(f, { force: true });
  }

  baseline = fingerprintRealDb();

  return () => {
    const after = fingerprintRealDb();
    // Clean up this run's throwaway DB. Best-effort: a leftover temp file is not worth
    // failing a green suite over, and the next run deletes it anyway.
    for (const f of [file, `${file}-wal`, `${file}-shm`]) {
      try { if (fs.existsSync(f)) fs.rmSync(f, { force: true }); } catch { /* best effort */ }
    }
    if (!baseline || !after) return;
    const drift = describeDrift(baseline, after);
    if (drift.length === 0) return;
    throw new Error(
      `Test run wrote synthetic fixture rows into the operator's REAL database (${realDbPath()}).\n` +
        drift.map((d) => `  - ${d}`).join('\n') +
        `\nA test reached ~/.pof/pof.db instead of the throwaway DB at ${file}. ` +
        `Either it opened SQLite directly, or it overrode POF_DB_PATH to the real path. ` +
        `Fix the offending suite — do not delete this guard; the rows it catches are the ones ` +
        `that made 42% of pipeline_artifacts test residue.`,
    );
  };
}
