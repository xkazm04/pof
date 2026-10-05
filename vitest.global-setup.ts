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
 * checkout cannot fight over one SQLite file. Each worker then narrows it to its own file
 * (`pof-test-<pid>-w<pool>.db`, set by `vitest.worker-env.ts`) so parallel files in ONE run do not
 * share a database either.
 */
export function testDbPath(): string {
  return path.join(os.tmpdir(), 'pof-vitest', `pof-test-${process.pid}.db`);
}

/** The run's floor DB plus every per-worker DB (and their WAL/SHM sidecars) that may exist. */
function runDbFiles(): string[] {
  const floor = testDbPath();
  const dir = path.dirname(floor);
  const stem = path.basename(floor, '.db');
  const files = [floor, `${floor}-wal`, `${floor}-shm`];
  if (!fs.existsSync(dir)) return files;
  for (const name of fs.readdirSync(dir)) {
    if (name.startsWith(`${stem}-w`)) files.push(path.join(dir, name));
  }
  return files;
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

/** Leftover per-file throwaway DBs: `pof-test-<name>[-<pid>].db` plus SQLite's -wal/-shm sidecars. */
const STALE_TEST_DB_NAME = /^pof-test-.*\.db(-wal|-shm)?$/;

/** A sweep candidate must be older than this, so a concurrent run in another worktree keeps its live files. */
export const STALE_TEST_DB_MIN_AGE_MS = 30 * 60 * 1000;

/**
 * Which entries of the OS temp dir are leftover throwaway test DBs safe to delete.
 *
 * Many suites key their DB by pid alone (`pof-test-<name>-<pid>.db`) and never delete it; Windows
 * reuses pids, so a later run can reopen an earlier run's rows. Pure on purpose — names and
 * mtimes in, names out — so the selection is unit-testable without a disk.
 *
 * Never selects: a name that is not a bare file name (no separators, so nothing outside the temp
 * dir), anything not matching the pattern (`pof.db`, the `pof-vitest/` dir), anything not older
 * than the age floor, or this run's own floor DB (`pof-test-<pid>…`, owned by `runDbFiles`).
 */
export function selectStaleTestDbs(
  entries: ReadonlyArray<{ name: string; mtimeMs: number }>,
  nowMs: number,
  ownPid: number = process.pid,
): string[] {
  const ownStem = `pof-test-${ownPid}`;
  return entries
    .filter(({ name, mtimeMs }) => {
      if (name !== path.basename(name) || !STALE_TEST_DB_NAME.test(name)) return false;
      if (name.startsWith(`${ownStem}.db`) || name.startsWith(`${ownStem}-w`)) return false;
      return nowMs - mtimeMs > STALE_TEST_DB_MIN_AGE_MS;
    })
    .map((e) => e.name);
}

/** Delete stale throwaway DBs in the temp dir; returns how many went. Never throws. */
function sweepStaleTestDbs(): number {
  const dir = os.tmpdir();
  // Defensive: never sweep the real DB's directory, whatever TEMP points at.
  if (path.resolve(dir) === path.dirname(realDbPath())) return 0;
  let deleted = 0;
  try {
    const entries: { name: string; mtimeMs: number }[] = [];
    for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!d.isFile()) continue;
      try { entries.push({ name: d.name, mtimeMs: fs.statSync(path.join(dir, d.name)).mtimeMs }); } catch { /* raced away */ }
    }
    for (const name of selectStaleTestDbs(entries, Date.now())) {
      try { fs.rmSync(path.join(dir, name), { force: true }); deleted++; } catch { /* EBUSY/EPERM: in use, leave it */ }
    }
  } catch { /* unreadable temp dir: a sweep is a backstop, never a failure */ }
  return deleted;
}

let baseline: FixtureFingerprint | null = null;

export default function setup() {
  /** Ensure the (gitignored) pipeline registry barrel exists before any test imports it. */
  execSync('node scripts/gen-pipeline-registry.mjs', { stdio: 'ignore' });

  // Start every run from an empty test DB. Leftovers from a previous run would make a suite's
  // reads depend on whatever the last one happened to write.
  const file = testDbPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  for (const f of runDbFiles()) {
    if (fs.existsSync(f)) fs.rmSync(f, { force: true });
  }

  // Backstop for the pid-keyed per-file DBs that suites leave behind (see `selectStaleTestDbs`).
  process.stdout.write(`[vitest.global-setup] swept ${sweepStaleTestDbs()} stale pof-test-* temp DB file(s)\n`);

  baseline = fingerprintRealDb();

  return () => {
    const after = fingerprintRealDb();
    // Clean up this run's throwaway DB. Best-effort: a leftover temp file is not worth
    // failing a green suite over, and the next run deletes it anyway.
    for (const f of runDbFiles()) {
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
