/* ------------------------------------------------------------------ */
/*  Crash History — persisted sightings of OBSERVED crashes            */
/* ------------------------------------------------------------------ */

/**
 * The crash analyzer's memory.
 *
 * Nothing an operator imported used to survive a reload: the store held imported
 * reports in a plain in-memory array and the view re-fetched the same eight
 * static samples on mount, discarding them. So the single most valuable question
 * a crash tool answers — "have I seen this crash before?" — could not be asked
 * at all across sessions.
 *
 * Two rules this module exists to enforce:
 *
 *  1. **Only OBSERVED crashes are stored.** The eight built-in samples are demo
 *     data and are never written here. Persisting them would inflate a real
 *     project's crash history with fiction, and every row read back out is
 *     stamped `source: 'imported'` so the UI can keep the two apart.
 *  2. **Storage is bounded, and the bound is stated.** Crash logs are large and
 *     a stack-overflow callstack can run to thousands of frames, so the raw log,
 *     the frame count, and the number of retained signatures all have explicit
 *     caps (see {@link CRASH_HISTORY_LIMITS}) rather than an unbounded table
 *     that quietly grows the shared SQLite file.
 *
 * Follows the repo DB idiom: the shared better-sqlite3 connection from
 * `@/lib/db` (WAL, foreign keys on), an idempotent `CREATE TABLE IF NOT EXISTS`
 * bootstrap run at most once per process, and a single upsert keyed on a natural
 * unique constraint — the same shape as `error_memory`, which answers the same
 * "seen this before?" question for build errors.
 */

import { getDb } from './db';
import { crashSignature, signatureFingerprint } from './crash-analyzer/crash-signature';
import { CRASH_HISTORY_LIMITS } from '@/types/crash-analyzer';
import type {
  CallstackFrame,
  CrashHistoryMeta,
  CrashReport,
  CrashSeverity,
  CrashType,
  MachineState,
} from '@/types/crash-analyzer';

/* ------------------------------------------------------------------ */
/*  Bounds                                                             */
/* ------------------------------------------------------------------ */

/**
 * The storage bounds live in `@/types/crash-analyzer` (client-safe) because the
 * UI has to state them and cannot import this module. Re-exported here so the
 * DB-side reader finds them where the writes are.
 */
export { CRASH_HISTORY_LIMITS };

/** Appended in place of the dropped tail so a truncated log can never read as complete. */
const TRUNCATION_MARKER = '\n… [truncated by PoF crash history]';

/* ------------------------------------------------------------------ */
/*  Schema                                                             */
/* ------------------------------------------------------------------ */

let bootstrapped = false;

export function ensureCrashHistoryTable(): void {
  if (bootstrapped) return;
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS crash_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      crash_id TEXT NOT NULL,
      fingerprint TEXT NOT NULL UNIQUE,
      crash_type TEXT NOT NULL,
      severity TEXT NOT NULL,
      error_message TEXT NOT NULL,
      mapped_module TEXT,
      callstack_json TEXT NOT NULL DEFAULT '[]',
      machine_json TEXT NOT NULL DEFAULT '{}',
      crash_dir TEXT NOT NULL DEFAULT '',
      raw_log TEXT NOT NULL DEFAULT '',
      raw_log_chars INTEGER NOT NULL DEFAULT 0,
      raw_log_truncated INTEGER NOT NULL DEFAULT 0,
      occurrences INTEGER NOT NULL DEFAULT 1,
      first_seen_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      recorded_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_crash_history_seen
    ON crash_history(last_seen_at DESC)
  `);

  bootstrapped = true;
}

/** Test seam: drop the once-per-process bootstrap memo when the DB handle is swapped. */
export function resetCrashHistoryBootstrap(): void {
  bootstrapped = false;
}

/* ------------------------------------------------------------------ */
/*  Row mapping                                                        */
/* ------------------------------------------------------------------ */

interface CrashHistoryRow {
  id: number;
  crash_id: string;
  fingerprint: string;
  crash_type: string;
  severity: string;
  error_message: string;
  mapped_module: string | null;
  callstack_json: string;
  machine_json: string;
  crash_dir: string;
  raw_log: string;
  raw_log_chars: number;
  raw_log_truncated: number;
  occurrences: number;
  first_seen_at: string;
  last_seen_at: string;
  recorded_at: string;
}

/** A stored crash plus the history facts that answer "have I seen this before?". */
export interface CrashSighting {
  report: CrashReport;
  history: CrashHistoryMeta;
  fingerprint: string;
}

function parseJson<T>(text: string, fallback: T): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    // A row whose JSON no longer parses is corrupt, not fatal — the crash's own
    // identity fields are still readable and worth showing.
    return fallback;
  }
}

function rowToSighting(row: CrashHistoryRow): CrashSighting {
  const callstack = parseJson<CallstackFrame[]>(row.callstack_json, []);
  const report: CrashReport = {
    id: row.crash_id,
    timestamp: row.last_seen_at,
    crashType: row.crash_type as CrashType,
    severity: row.severity as CrashSeverity,
    errorMessage: row.error_message,
    callstack,
    culpritFrame: callstack.find((f) => f.isCrashOrigin) ?? null,
    machineState: parseJson<MachineState>(row.machine_json, {
      platform: 'Unknown', cpuBrand: 'Unknown', gpuBrand: 'Unknown', ramMB: 0,
      osVersion: 'Unknown', engineVersion: 'Unknown', buildConfig: 'Development', isEditor: true,
    }),
    crashDir: row.crash_dir,
    mappedModule: row.mapped_module,
    rawLog: row.raw_log,
    analyzed: true,
    // Every row in this table was observed, never seeded — see the module note.
    source: 'imported',
    history: {
      occurrences: row.occurrences,
      firstSeenAt: row.first_seen_at,
      lastSeenAt: row.last_seen_at,
      recordedAt: row.recorded_at,
      rawLogChars: row.raw_log_chars,
      rawLogTruncated: row.raw_log_truncated === 1,
    },
  };
  return { report, history: report.history!, fingerprint: row.fingerprint };
}

/* ------------------------------------------------------------------ */
/*  Record a sighting                                                  */
/* ------------------------------------------------------------------ */

/**
 * Record that a crash was observed, and report whether PoF had seen it before.
 *
 * Identity is the crash SIGNATURE fingerprint (failure class + culprit symbol +
 * file + module), not the report id — an id is minted fresh on every import, so
 * keying on it would file the same crash as a new one every time and make
 * "seen before" unanswerable, which is the whole point of the table.
 *
 * On a repeat sighting only the counters move: `occurrences` increments and the
 * first/last-seen window widens to cover the new crash time (importing an OLDER
 * log of the same crash correctly moves `first_seen_at` back). The stored
 * payload stays as first recorded, so the history does not churn — and the
 * returned report carries the ORIGINAL `crash_id`, so a re-import updates the
 * existing entry instead of appearing twice in the list.
 */
export function recordCrashSighting(report: CrashReport): CrashSighting {
  ensureCrashHistoryTable();
  const db = getDb();

  const fingerprint = signatureFingerprint(crashSignature(report));
  const frames = report.callstack.slice(0, CRASH_HISTORY_LIMITS.frames);
  const truncated = report.rawLog.length > CRASH_HISTORY_LIMITS.rawLogChars;
  const rawLog = truncated
    ? report.rawLog.slice(0, CRASH_HISTORY_LIMITS.rawLogChars) + TRUNCATION_MARKER
    : report.rawLog;

  const row = db.prepare(`
    INSERT INTO crash_history
      (crash_id, fingerprint, crash_type, severity, error_message, mapped_module,
       callstack_json, machine_json, crash_dir, raw_log, raw_log_chars,
       raw_log_truncated, first_seen_at, last_seen_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(fingerprint) DO UPDATE SET
      occurrences = occurrences + 1,
      first_seen_at = MIN(first_seen_at, excluded.first_seen_at),
      last_seen_at = MAX(last_seen_at, excluded.last_seen_at)
    RETURNING *
  `).get(
    report.id,
    fingerprint,
    report.crashType,
    report.severity,
    report.errorMessage,
    report.mappedModule,
    JSON.stringify(frames),
    JSON.stringify(report.machineState),
    report.crashDir,
    rawLog,
    report.rawLog.length,
    truncated ? 1 : 0,
    report.timestamp,
    report.timestamp,
  ) as CrashHistoryRow | undefined;

  if (!row) throw new Error(`Failed to record crash sighting (fingerprint=${fingerprint})`);

  pruneCrashHistory();
  return rowToSighting(row);
}

/**
 * Keep only the {@link CRASH_HISTORY_LIMITS.signatures} most-recently-seen
 * signatures. Runs after every insert so the table cannot outgrow its stated
 * bound between sessions.
 */
function pruneCrashHistory(): number {
  const result = getDb().prepare(`
    DELETE FROM crash_history
    WHERE id NOT IN (
      SELECT id FROM crash_history ORDER BY last_seen_at DESC, id DESC LIMIT ?
    )
  `).run(CRASH_HISTORY_LIMITS.signatures);
  return result.changes;
}

/* ------------------------------------------------------------------ */
/*  Read                                                               */
/* ------------------------------------------------------------------ */

/** Every observed crash, most recently seen first. */
export function listCrashHistory(limit: number = CRASH_HISTORY_LIMITS.signatures): CrashSighting[] {
  ensureCrashHistoryTable();
  const rows = getDb()
    .prepare('SELECT * FROM crash_history ORDER BY last_seen_at DESC, id DESC LIMIT ?')
    .all(limit) as CrashHistoryRow[];
  return rows.map(rowToSighting);
}

/** How many distinct crash signatures PoF has observed. */
export function countCrashHistory(): number {
  ensureCrashHistoryTable();
  const row = getDb().prepare('SELECT COUNT(*) AS n FROM crash_history').get() as { n: number };
  return row.n;
}

/** Forget everything observed. Used by tests and by an explicit operator reset. */
export function clearCrashHistory(): number {
  ensureCrashHistoryTable();
  return getDb().prepare('DELETE FROM crash_history').run().changes;
}
