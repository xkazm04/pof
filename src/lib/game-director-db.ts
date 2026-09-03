import { getDb, prepareCached } from './db';
import { logger } from '@/lib/logger';
import type {
  PlaytestSession,
  PlaytestFinding,
  DirectorEvent,
  PlaytestConfig,
  PlaytestSummary,
  PlaytestStatus,
  TriageStatus,
  SessionSource,
  ReproRecord,
  ConfidenceBasis,
} from '@/types/game-director';
import { TRIAGE_STATUSES, validateTriageRepro } from '@/types/game-director';

/**
 * Triage states that suppress a finding from regression tracking and health scoring.
 *
 * `unreproducible` is deliberately NOT here. Failing to reproduce is weak evidence
 * against a defect while reproducing is strong evidence for one, so an attempt
 * series that came up empty bounds the finding's frequency — it does not retire
 * the finding. Excluding it would be the silent close this state exists to prevent.
 */
export const TRIAGE_EXCLUDED: readonly TriageStatus[] = ['false-positive', 'ignore'] as const;

export function isTriageExcluded(status: TriageStatus): boolean {
  return (TRIAGE_EXCLUDED as readonly string[]).includes(status);
}

/**
 * SQL predicate (no leading AND/WHERE) keeping only findings that aren't triaged
 * out. Derived from {@link TRIAGE_EXCLUDED} so the excluded list lives in exactly
 * one place — interpolate it into finding-count/stat queries instead of hardcoding
 * the literal list. The values are internal `TriageStatus` constants, never user
 * input, so direct interpolation carries no injection risk.
 */
export const TRIAGE_EXCLUDED_SQL = `triage_status NOT IN (${TRIAGE_EXCLUDED.map(s => `'${s}'`).join(',')})`;

// ─── Schema bootstrap ────────────────────────────────────────────────────────

let initialized = false;

/**
 * The findings table, parameterised by name so the rebuild below creates the
 * *identical* shape it will rename into place. One source of truth for the
 * schema — a rebuild that drifts from the CREATE is how a half-migrated database
 * happens.
 */
const FINDINGS_TABLE_SQL = (table: string) => `
  CREATE TABLE IF NOT EXISTS ${table} (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    category TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'medium'
      CHECK(severity IN ('critical','high','medium','low','positive')),
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    related_module TEXT,
    screenshot_ref TEXT,
    game_timestamp REAL,
    suggested_fix TEXT NOT NULL DEFAULT '',
    -- NULLABLE and undefaulted on purpose: NULL means nobody scored this finding.
    -- It used to be 'INTEGER NOT NULL DEFAULT 80', which made an unscored finding
    -- byte-identical to one an observer rated 80.
    confidence INTEGER,
    confidence_basis TEXT
      CHECK(confidence_basis IS NULL OR confidence_basis IN ('observer','unattributed')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    triage_status TEXT NOT NULL DEFAULT 'active'
      CHECK(triage_status IN ('active','confirmed','false-positive','ignore','snooze','unreproducible')),
    triage_note TEXT NOT NULL DEFAULT '',
    snoozed_until TEXT,
    fix_dispatched_at TEXT,
    -- The attempt series behind an 'unreproducible' verdict. NULL = not attempted.
    repro_attempts INTEGER CHECK(repro_attempts IS NULL OR repro_attempts >= 1),
    repro_build_id TEXT,
    repro_last_attempted_at TEXT,
    FOREIGN KEY (session_id) REFERENCES game_director_sessions(id) ON DELETE CASCADE
  )
`;

/** Columns copied verbatim by the rebuild, in table order. */
const FINDINGS_COPY_COLUMNS = [
  'id', 'session_id', 'category', 'severity', 'title', 'description',
  'related_module', 'screenshot_ref', 'game_timestamp', 'suggested_fix',
  'created_at', 'triage_status', 'triage_note', 'snoozed_until',
  'fix_dispatched_at', 'repro_attempts', 'repro_build_id', 'repro_last_attempted_at',
] as const;

/**
 * Rebuild `game_director_findings` when its stored DDL still carries either of
 * the two constraints SQLite cannot alter in place:
 *
 *   - `CHECK(triage_status IN (...))` without `'unreproducible'` — every write of
 *     the new state would be rejected on a pre-existing database.
 *   - `confidence INTEGER NOT NULL DEFAULT 80` — an unscored finding cannot say so.
 *
 * Data safety: every row is copied before the old table is dropped, the copy is
 * counted against the original inside the same transaction (a mismatch throws and
 * rolls the whole thing back), and nothing is deleted or coerced. Legacy
 * confidence numbers are PRESERVED and stamped `'unattributed'` rather than
 * discarded — we cannot know which of them an observer actually scored, and
 * "unknown basis" is the only honest label for a column that stored the default
 * and the measurement identically.
 *
 * Idempotent: after the rebuild the stored DDL satisfies both probes, so a second
 * run is a no-op. Foreign keys are suspended around it (SQLite's documented
 * table-rebuild procedure) and restored afterwards, so an orphaned row from an
 * older FK-off era is carried across instead of aborting the migration.
 */
function migrateFindingsTable(db: ReturnType<typeof getDb>) {
  const ddl = db.prepare(
    "SELECT sql FROM sqlite_master WHERE type='table' AND name='game_director_findings'"
  ).get() as { sql: string | null } | undefined;
  const sql = ddl?.sql;
  if (!sql) return;

  const checkIsStale = /CHECK\s*\(\s*triage_status/i.test(sql) && !sql.includes("'unreproducible'");
  const confidenceIsNotNull = /[(,]\s*confidence\s+INTEGER\s+NOT\s+NULL/i.test(sql);
  if (!checkIsStale && !confidenceIsNotNull) return;

  logger.info('[game-director-db] rebuilding game_director_findings (unreproducible triage state + nullable confidence)');

  const fkWasOn = db.pragma('foreign_keys', { simple: true }) === 1;
  if (fkWasOn) db.pragma('foreign_keys = OFF');
  try {
    const copy = FINDINGS_COPY_COLUMNS.join(', ');
    const rebuild = db.transaction(() => {
      const before = (db.prepare('SELECT COUNT(*) AS c FROM game_director_findings').get() as { c: number }).c;

      // A previous interrupted attempt may have left the scratch table behind.
      db.exec('DROP TABLE IF EXISTS game_director_findings__rebuild');
      db.exec(FINDINGS_TABLE_SQL('game_director_findings__rebuild'));
      db.exec(`
        INSERT INTO game_director_findings__rebuild
          (${copy}, confidence, confidence_basis)
        SELECT ${copy},
               confidence,
               CASE WHEN confidence IS NULL THEN NULL
                    ELSE COALESCE(confidence_basis, 'unattributed') END
        FROM game_director_findings
      `);

      const after = (db.prepare('SELECT COUNT(*) AS c FROM game_director_findings__rebuild').get() as { c: number }).c;
      if (before !== after) {
        // Throwing inside the transaction rolls it back: the original table is
        // untouched and the app keeps running on the old schema.
        throw new Error(`findings rebuild would lose rows (${before} -> ${after}) — aborted`);
      }

      db.exec('DROP TABLE game_director_findings');
      db.exec('ALTER TABLE game_director_findings__rebuild RENAME TO game_director_findings');
    });
    rebuild();
  } finally {
    if (fkWasOn) db.pragma('foreign_keys = ON');
  }
}

function ensureTables() {
  if (initialized) return;
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS game_director_sessions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'configuring'
        CHECK(status IN ('configuring','launching','playing','analyzing','complete','failed')),
      build_path TEXT NOT NULL DEFAULT '',
      config TEXT NOT NULL DEFAULT '{}',
      summary TEXT,
      systems_tested_count INTEGER NOT NULL DEFAULT 0,
      findings_count INTEGER NOT NULL DEFAULT 0,
      duration_ms INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      started_at TEXT,
      completed_at TEXT,
      source TEXT NOT NULL DEFAULT 'simulated'
        CHECK(source IN ('simulated','external'))
    )
  `);

  // Provenance backfill for pre-existing databases. Every row that predates this
  // column was written by `game-director-sim.ts` — there was no other writer —
  // so the 'simulated' default is a statement of fact, not an assumption.
  const sessCols = db.prepare("PRAGMA table_info(game_director_sessions)").all() as { name: string }[];
  if (!sessCols.some(c => c.name === 'source')) {
    // No CHECK on the ALTER path: SQLite rejects adding a column with a
    // constraint that would have to be validated against existing rows.
    db.exec(`ALTER TABLE game_director_sessions ADD COLUMN source TEXT NOT NULL DEFAULT 'simulated'`);
  }

  db.exec(FINDINGS_TABLE_SQL('game_director_findings'));

  // Backfill triage columns for pre-existing databases (CREATE TABLE IF NOT EXISTS
  // is a no-op once the table has been created without these columns).
  const cols = db.prepare("PRAGMA table_info(game_director_findings)").all() as { name: string }[];
  const colSet = new Set(cols.map(c => c.name));
  if (!colSet.has('triage_status')) {
    db.exec(`ALTER TABLE game_director_findings ADD COLUMN triage_status TEXT NOT NULL DEFAULT 'active'`);
  }
  if (!colSet.has('triage_note')) {
    db.exec(`ALTER TABLE game_director_findings ADD COLUMN triage_note TEXT NOT NULL DEFAULT ''`);
  }
  if (!colSet.has('snoozed_until')) {
    db.exec(`ALTER TABLE game_director_findings ADD COLUMN snoozed_until TEXT`);
  }
  if (!colSet.has('fix_dispatched_at')) {
    db.exec(`ALTER TABLE game_director_findings ADD COLUMN fix_dispatched_at TEXT`);
  }
  // Additive first, exactly as above: the repro record and the confidence basis
  // are new NULLABLE columns, so they need no rebuild on their own.
  if (!colSet.has('confidence_basis')) {
    db.exec(`ALTER TABLE game_director_findings ADD COLUMN confidence_basis TEXT`);
  }
  if (!colSet.has('repro_attempts')) {
    db.exec(`ALTER TABLE game_director_findings ADD COLUMN repro_attempts INTEGER`);
  }
  if (!colSet.has('repro_build_id')) {
    db.exec(`ALTER TABLE game_director_findings ADD COLUMN repro_build_id TEXT`);
  }
  if (!colSet.has('repro_last_attempted_at')) {
    db.exec(`ALTER TABLE game_director_findings ADD COLUMN repro_last_attempted_at TEXT`);
  }

  // The two things SQLite cannot alter in place: widening the `triage_status`
  // CHECK to admit 'unreproducible', and dropping `NOT NULL DEFAULT 80` from
  // `confidence` so an unscored finding can say so. Both need a table rebuild.
  migrateFindingsTable(db);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_gd_findings_session
    ON game_director_findings(session_id, severity)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_gd_findings_triage
    ON game_director_findings(triage_status)
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS game_director_events (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      type TEXT NOT NULL CHECK(type IN ('action','observation','screenshot','finding','system-test','error')),
      message TEXT NOT NULL DEFAULT '',
      data TEXT,
      FOREIGN KEY (session_id) REFERENCES game_director_sessions(id) ON DELETE CASCADE
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_gd_events_session
    ON game_director_events(session_id, timestamp)
  `);

  initialized = true;
}

// ─── Session CRUD ────────────────────────────────────────────────────────────

export function createSession(
  id: string,
  name: string,
  buildPath: string,
  config: PlaytestConfig,
  source: SessionSource = 'simulated',
): PlaytestSession {
  ensureTables();
  const db = getDb();

  db.prepare(`
    INSERT INTO game_director_sessions (id, name, build_path, config, source)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, name, buildPath, JSON.stringify(config), source);

  const session = getSession(id);
  if (!session) {
    throw new Error(`Failed to retrieve session after INSERT (id=${id})`);
  }
  return session;
}

export function getSession(id: string): PlaytestSession | null {
  ensureTables();
  const row = prepareCached('SELECT * FROM game_director_sessions WHERE id = ?').get(id) as SessionRow | undefined;
  if (!row) return null;
  return rowToSession(row);
}

/**
 * List sessions, newest first. Pass `limit` to bound the result — the sessions
 * table grows one row per playtest forever, so UI-facing callers should cap it
 * (the regression tracker, which fingerprints across all history, calls it
 * unbounded on purpose).
 */
export function listSessions(limit?: number): PlaytestSession[] {
  ensureTables();
  const sql = limit != null
    ? 'SELECT * FROM game_director_sessions ORDER BY created_at DESC LIMIT ?'
    : 'SELECT * FROM game_director_sessions ORDER BY created_at DESC';
  const rows = (limit != null
    ? prepareCached(sql).all(limit)
    : prepareCached(sql).all()) as SessionRow[];
  return rows.map(rowToSession);
}

export function updateSessionStatus(id: string, status: PlaytestStatus) {
  ensureTables();
  const db = getDb();
  const extras: Record<string, unknown> = {};
  if (status === 'playing') extras.started_at = new Date().toISOString();
  if (status === 'complete' || status === 'failed') extras.completed_at = new Date().toISOString();

  const sets = ['status = ?'];
  const vals: unknown[] = [status];
  for (const [col, val] of Object.entries(extras)) {
    sets.push(`${col} = ?`);
    vals.push(val);
  }
  vals.push(id);
  db.prepare(`UPDATE game_director_sessions SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
}

/**
 * Write a session's final summary. `source` stamps the provenance of the numbers
 * being written: the simulator passes `'simulated'`, the external writer API's
 * `complete` action passes `'external'`. It is part of the same write as the
 * summary on purpose — a score and its provenance must never be settable apart.
 */
export function updateSessionSummary(
  id: string,
  summary: PlaytestSummary,
  durationMs: number,
  systemsTestedCount: number,
  findingsCount: number,
  source: SessionSource = 'simulated',
) {
  ensureTables();
  const db = getDb();
  db.prepare(`
    UPDATE game_director_sessions
    SET summary = ?, duration_ms = ?, systems_tested_count = ?, findings_count = ?,
        status = 'complete', completed_at = datetime('now'), source = ?
    WHERE id = ?
  `).run(JSON.stringify(summary), durationMs, systemsTestedCount, findingsCount, source, id);
}

export function deleteSession(id: string) {
  ensureTables();
  const db = getDb();
  const deleteAll = db.transaction(() => {
    db.prepare('DELETE FROM game_director_events WHERE session_id = ?').run(id);
    db.prepare('DELETE FROM game_director_findings WHERE session_id = ?').run(id);
    db.prepare('DELETE FROM game_director_sessions WHERE id = ?').run(id);
  });
  deleteAll();
}

// ─── Findings CRUD ───────────────────────────────────────────────────────────

export function addFinding(finding: PlaytestFinding) {
  ensureTables();
  const db = getDb();
  const insertAndUpdate = db.transaction(() => {
    // Confidence and its basis are written as a PAIR — a number with no stated
    // basis is stamped 'unattributed', never promoted to a measurement, and an
    // absent number stays absent instead of falling back to the old 80 default.
    const confidence = typeof finding.confidence === 'number' && Number.isFinite(finding.confidence)
      ? finding.confidence
      : null;
    const confidenceBasis: ConfidenceBasis | null = confidence == null
      ? null
      : (finding.confidenceBasis === 'observer' ? 'observer' : 'unattributed');

    db.prepare(`
      INSERT INTO game_director_findings
        (id, session_id, category, severity, title, description,
         related_module, screenshot_ref, game_timestamp, suggested_fix,
         confidence, confidence_basis,
         triage_status, triage_note, snoozed_until,
         repro_attempts, repro_build_id, repro_last_attempted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      finding.id, finding.sessionId, finding.category, finding.severity,
      finding.title, finding.description, finding.relatedModule,
      finding.screenshotRef, finding.gameTimestamp, finding.suggestedFix,
      confidence, confidenceBasis,
      finding.triageStatus ?? 'active',
      finding.triageNote ?? '',
      finding.snoozedUntil ?? null,
      finding.reproAttempts ?? null,
      finding.reproBuildId ?? null,
      finding.reproLastAttemptedAt ?? null,
    );

    // Update count on session — excludes findings the user marked as
    // false-positive or ignored so they don't inflate the score.
    db.prepare(`
      UPDATE game_director_sessions
      SET findings_count = (
        SELECT COUNT(*) FROM game_director_findings
        WHERE session_id = ? AND ${TRIAGE_EXCLUDED_SQL}
      )
      WHERE id = ?
    `).run(finding.sessionId, finding.sessionId);
  });
  insertAndUpdate();
}

/**
 * Apply a triage decision.
 *
 * `repro` is the attempt series behind an `unreproducible` verdict and is
 * REQUIRED for that state — an instrument reports a verdict only after proving it
 * had input, and "could not reproduce" with no attempt count is a conclusion over
 * an unstated scope. Every other state must pass `null`, and doing so clears any
 * series already on the row: reopening a finding makes it unattempted again
 * rather than leaving a stale denominator attached to a fresh state.
 */
export function updateFindingTriage(
  findingId: string,
  triageStatus: TriageStatus,
  triageNote: string,
  snoozedUntil: string | null,
  repro: ReproRecord | null = null,
): PlaytestFinding | null {
  ensureTables();
  const db = getDb();

  if (!(TRIAGE_STATUSES as readonly string[]).includes(triageStatus)) {
    throw new Error(`Unknown triage status: ${triageStatus}`);
  }
  // Re-validated here and not only at the API seam: the DB module is the single
  // choke point every writer passes through, so the rule cannot be routed around.
  const gate = validateTriageRepro(triageStatus, repro?.attempts ?? null, repro?.buildId ?? null);
  if (!gate.ok) throw new Error(gate.error);
  const record = gate.data;

  const existing = db.prepare('SELECT session_id FROM game_director_findings WHERE id = ?')
    .get(findingId) as { session_id: string } | undefined;
  if (!existing) return null;

  const updateAndRecount = db.transaction(() => {
    db.prepare(`
      UPDATE game_director_findings
      SET triage_status = ?, triage_note = ?, snoozed_until = ?,
          repro_attempts = ?, repro_build_id = ?, repro_last_attempted_at = ?
      WHERE id = ?
    `).run(
      triageStatus, triageNote, snoozedUntil,
      record?.attempts ?? null,
      record?.buildId ?? null,
      record ? new Date().toISOString() : null,
      findingId,
    );

    db.prepare(`
      UPDATE game_director_sessions
      SET findings_count = (
        SELECT COUNT(*) FROM game_director_findings
        WHERE session_id = ? AND ${TRIAGE_EXCLUDED_SQL}
      )
      WHERE id = ?
    `).run(existing.session_id, existing.session_id);
  });
  updateAndRecount();

  const row = prepareCached('SELECT * FROM game_director_findings WHERE id = ?')
    .get(findingId) as FindingRow | undefined;
  return row ? rowToFinding(row) : null;
}

/**
 * Stamp a finding with the time a one-click "Fix this" CLI task was dispatched
 * for it. Records the detect→fix link so the regression tracker can later
 * confirm whether the fix held. Returns the updated finding, or null if missing.
 */
export function markFindingFixDispatched(findingId: string): PlaytestFinding | null {
  ensureTables();
  const db = getDb();

  const result = db.prepare(
    `UPDATE game_director_findings SET fix_dispatched_at = datetime('now') WHERE id = ?`
  ).run(findingId);
  if (result.changes === 0) return null;

  const row = prepareCached('SELECT * FROM game_director_findings WHERE id = ?')
    .get(findingId) as FindingRow | undefined;
  return row ? rowToFinding(row) : null;
}

export function getFindings(sessionId: string): PlaytestFinding[] {
  ensureTables();
  const rows = prepareCached(
    'SELECT * FROM game_director_findings WHERE session_id = ? ORDER BY severity, created_at'
  ).all(sessionId) as FindingRow[];
  return rows.map(rowToFinding);
}

export function getAllFindings(): PlaytestFinding[] {
  ensureTables();
  const db = getDb();
  const rows = db.prepare(
    'SELECT * FROM game_director_findings ORDER BY created_at DESC LIMIT 200'
  ).all() as FindingRow[];
  return rows.map(rowToFinding);
}

// ─── Events ──────────────────────────────────────────────────────────────────

export function addEvent(event: DirectorEvent) {
  ensureTables();
  const db = getDb();
  db.prepare(`
    INSERT INTO game_director_events (id, session_id, timestamp, type, message, data)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    event.id, event.sessionId, event.timestamp, event.type,
    event.message, event.data ? JSON.stringify(event.data) : null,
  );
}

export function getEvents(sessionId: string, limit = 100): DirectorEvent[] {
  ensureTables();
  const db = getDb();
  const rows = db.prepare(
    'SELECT * FROM game_director_events WHERE session_id = ? ORDER BY timestamp DESC LIMIT ?'
  ).all(sessionId, limit) as EventRow[];
  return rows.map(rowToEvent);
}

// ─── Aggregate stats ─────────────────────────────────────────────────────────

export interface DirectorStats {
  totalSessions: number;
  completedSessions: number;
  totalFindings: number;
  criticalFindings: number;
  /** Open (not triaged-out) findings at critical OR high severity — drives the nav "All Findings" urgency pill. */
  openCriticalHigh: number;
  /** Undismissed regression alerts — drives the nav "Regressions" pill. */
  activeAlerts: number;
  avgScore: number | null;
  /**
   * Provenance of the sessions `avgScore` averages over: `'simulated'` when every
   * contributing session came from the dev-fixture simulator, `'external'` when
   * every one came through the writer API, `'mixed'` when both, `null` when there
   * is no score at all.
   *
   * Optional on the interface so hand-built stats objects stay valid; **absent is
   * read as `'simulated'`** by the UI — an unattributed score is not a verified one.
   */
  scoreSource?: ScoreSource | null;
  /** How many completed sessions the average covers. Absent ⇒ unknown. */
  scoredSessions?: number;
  recentSessions: PlaytestSession[];
}

/** Provenance rollup across a set of sessions. */
export type ScoreSource = SessionSource | 'mixed';

/**
 * Time-series datapoint: one completed session with its score, finding counts,
 * and the number of regression alerts that fired when the session ran. Used to
 * answer "is the build getting better or worse over time?".
 */
export interface HealthTrendPoint {
  sessionId: string;
  sessionName: string;
  createdAt: string;
  overallScore: number;
  findingsCount: number;
  criticalCount: number;
  regressionCount: number;
  /** Provenance of this point's score — see {@link SessionSource}. */
  source: SessionSource;
}

export function getDirectorStats(): DirectorStats {
  ensureTables();
  const db = getDb();

  const sessCount = db.prepare('SELECT COUNT(*) as c FROM game_director_sessions').get() as { c: number };
  const completeCount = db.prepare("SELECT COUNT(*) as c FROM game_director_sessions WHERE status = 'complete'").get() as { c: number };
  // Counts exclude findings the user has triaged out so noise doesn't inflate the
  // health score. All three finding counts read the same (triage-filtered) table, so
  // collapse them into one row of conditional aggregates instead of three scans.
  const findAgg = db.prepare(
    `SELECT
       COUNT(*) as total,
       SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) as critical,
       SUM(CASE WHEN severity IN ('critical','high') THEN 1 ELSE 0 END) as openCritHigh
     FROM game_director_findings WHERE ${TRIAGE_EXCLUDED_SQL}`
  ).get() as { total: number; critical: number | null; openCritHigh: number | null };

  // regression_alerts is owned by regression-tracker.ts and created lazily; guard
  // for the case where no regressions have ever been processed (cf. getHealthTrend).
  const hasRegTable = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='regression_alerts'"
  ).get() as { name: string } | undefined;
  const activeAlerts = hasRegTable
    ? (db.prepare('SELECT COUNT(*) as c FROM regression_alerts WHERE dismissed = 0').get() as { c: number }).c
    : 0;

  // Average overall score from completed sessions, WITH the provenance of the
  // rows it averages — a score and the answer to "was any of this measured?"
  // are read together or the number is not interpretable.
  const avgRow = db.prepare(
    "SELECT AVG(json_extract(summary, '$.overallScore')) as avg FROM game_director_sessions WHERE status = 'complete' AND summary IS NOT NULL"
  ).get() as { avg: number | null };

  const sourceRows = db.prepare(
    `SELECT source, COUNT(*) as c FROM game_director_sessions
     WHERE status = 'complete' AND summary IS NOT NULL GROUP BY source`
  ).all() as Array<{ source: string | null; c: number }>;
  let externalScored = 0;
  let simulatedScored = 0;
  for (const r of sourceRows) {
    if (r.source === 'external') externalScored += r.c;
    else simulatedScored += r.c;
  }
  const scoreSource: ScoreSource | null =
    externalScored + simulatedScored === 0 ? null
      : externalScored === 0 ? 'simulated'
        : simulatedScored === 0 ? 'external'
          : 'mixed';

  const recentRows = db.prepare(
    'SELECT * FROM game_director_sessions ORDER BY created_at DESC LIMIT 5'
  ).all() as SessionRow[];

  return {
    totalSessions: sessCount.c,
    completedSessions: completeCount.c,
    totalFindings: findAgg.total,
    criticalFindings: findAgg.critical ?? 0,
    openCriticalHigh: findAgg.openCritHigh ?? 0,
    activeAlerts,
    avgScore: avgRow.avg != null ? Math.round(avgRow.avg) : null,
    scoreSource,
    scoredSessions: externalScored + simulatedScored,
    recentSessions: recentRows.map(rowToSession),
  };
}

/**
 * Time-series of completed sessions ordered oldest → newest, for the health
 * trend chart in DirectorOverview. Each point carries the session's overall
 * score, finding counts (filtered by triage), and the count of regression
 * alerts that fired in that session — rendered as deploy-style markers on the
 * chart.
 *
 * The `regression_alerts` table is owned by regression-tracker.ts. We query it
 * directly (with a sqlite_master existence check) instead of importing to keep
 * this module dependency-free; if the regression tracker hasn't run yet the
 * counts simply come back as 0.
 */
export function getHealthTrend(limit = 30): HealthTrendPoint[] {
  ensureTables();
  const db = getDb();

  const rows = db.prepare(`
    SELECT id, name, created_at, summary, findings_count, source
    FROM game_director_sessions
    WHERE status = 'complete' AND summary IS NOT NULL
    ORDER BY datetime(created_at) ASC
    LIMIT ?
  `).all(limit) as Array<{
    id: string;
    name: string;
    created_at: string;
    summary: string;
    findings_count: number;
    source: string | null;
  }>;

  if (rows.length === 0) return [];

  // Regression alerts table is created lazily by regression-tracker.ts; guard
  // for the case where no regressions have ever been processed.
  const hasRegTable = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='regression_alerts'"
  ).get() as { name: string } | undefined;

  // Pre-aggregate per-session critical counts and regression-alert counts with one
  // GROUP BY each, then look up from Maps in the .map below — instead of two point
  // queries per session row (the former N+1). Sessions with no matching rows are
  // absent from the Map and fall back to 0, exactly as the per-row COUNT(*) did.
  const sessionIds = rows.map(r => r.id);
  const idPlaceholders = sessionIds.map(() => '?').join(',');

  const critCounts = new Map<string, number>();
  for (const row of db.prepare(
    `SELECT session_id as id, COUNT(*) as c FROM game_director_findings
     WHERE session_id IN (${idPlaceholders}) AND severity = 'critical' AND ${TRIAGE_EXCLUDED_SQL}
     GROUP BY session_id`
  ).all(...sessionIds) as Array<{ id: string; c: number }>) {
    critCounts.set(row.id, row.c);
  }

  const regCounts = new Map<string, number>();
  if (hasRegTable) {
    for (const row of db.prepare(
      `SELECT reappeared_in_session_id as id, COUNT(*) as c FROM regression_alerts
       WHERE reappeared_in_session_id IN (${idPlaceholders})
       GROUP BY reappeared_in_session_id`
    ).all(...sessionIds) as Array<{ id: string; c: number }>) {
      regCounts.set(row.id, row.c);
    }
  }

  return rows.map(r => {
    let overallScore = 0;
    try {
      const summary = JSON.parse(r.summary) as PlaytestSummary;
      overallScore = typeof summary.overallScore === 'number' ? summary.overallScore : 0;
    } catch {
      overallScore = 0;
    }
    return {
      sessionId: r.id,
      sessionName: r.name,
      createdAt: r.created_at,
      overallScore,
      findingsCount: r.findings_count ?? 0,
      criticalCount: critCounts.get(r.id) ?? 0,
      regressionCount: regCounts.get(r.id) ?? 0,
      source: r.source === 'external' ? 'external' : 'simulated',
    };
  });
}

// ─── Row types ───────────────────────────────────────────────────────────────

interface SessionRow {
  id: string;
  name: string;
  status: string;
  build_path: string;
  config: string;
  summary: string | null;
  systems_tested_count: number;
  findings_count: number;
  duration_ms: number | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  source: string | null;
}

interface FindingRow {
  id: string;
  session_id: string;
  category: string;
  severity: string;
  title: string;
  description: string;
  related_module: string | null;
  screenshot_ref: string | null;
  game_timestamp: number | null;
  suggested_fix: string;
  confidence: number | null;
  confidence_basis: string | null;
  created_at: string;
  triage_status: string | null;
  triage_note: string | null;
  snoozed_until: string | null;
  fix_dispatched_at: string | null;
  repro_attempts: number | null;
  repro_build_id: string | null;
  repro_last_attempted_at: string | null;
}

interface EventRow {
  id: string;
  session_id: string;
  timestamp: string;
  type: string;
  message: string;
  data: string | null;
}

// ─── Row mappers ─────────────────────────────────────────────────────────────

function rowToSession(row: SessionRow): PlaytestSession {
  return {
    id: row.id,
    name: row.name,
    status: row.status as PlaytestSession['status'],
    buildPath: row.build_path,
    createdAt: row.created_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    durationMs: row.duration_ms,
    config: JSON.parse(row.config || '{}'),
    summary: row.summary ? JSON.parse(row.summary) : null,
    systemsTestedCount: row.systems_tested_count || 0,
    findingsCount: row.findings_count || 0,
    // Anything that isn't an explicit 'external' is simulated — an unrecognised
    // or missing value must fall to the unverified side, never the trusted one.
    source: row.source === 'external' ? 'external' : 'simulated',
  };
}

function rowToFinding(row: FindingRow): PlaytestFinding {
  // A snooze is time-bounded: once `snoozedUntil` lapses, the finding must
  // reappear as open. Derive the un-snoozed state at read time so every
  // consumer (filters, stats, regression tracker) sees it without a cron job.
  let triageStatus = (row.triage_status as PlaytestFinding['triageStatus']) || 'active';
  let snoozedUntil = row.snoozed_until;
  if (
    triageStatus === 'snooze' &&
    snoozedUntil &&
    new Date(snoozedUntil).getTime() <= Date.now()
  ) {
    triageStatus = 'active';
    snoozedUntil = null;
  }
  return {
    id: row.id,
    sessionId: row.session_id,
    category: row.category as PlaytestFinding['category'],
    severity: row.severity as PlaytestFinding['severity'],
    title: row.title,
    description: row.description || '',
    relatedModule: row.related_module,
    screenshotRef: row.screenshot_ref,
    gameTimestamp: row.game_timestamp,
    suggestedFix: row.suggested_fix || '',
    // `row.confidence || 80` used to sit here: it turned a stored 0 into 80 and
    // an absent score into a fabricated one. NULL now travels as null.
    confidence: typeof row.confidence === 'number' ? row.confidence : null,
    confidenceBasis: row.confidence == null
      ? null
      : (row.confidence_basis === 'observer' ? 'observer' : 'unattributed'),
    createdAt: row.created_at,
    triageStatus,
    triageNote: row.triage_note || '',
    snoozedUntil,
    fixDispatchedAt: row.fix_dispatched_at,
    reproAttempts: typeof row.repro_attempts === 'number' ? row.repro_attempts : null,
    reproBuildId: row.repro_build_id,
    reproLastAttemptedAt: row.repro_last_attempted_at,
  };
}

function rowToEvent(row: EventRow): DirectorEvent {
  return {
    id: row.id,
    sessionId: row.session_id,
    timestamp: row.timestamp,
    type: row.type as DirectorEvent['type'],
    message: row.message,
    data: row.data ? JSON.parse(row.data) : undefined,
  };
}
