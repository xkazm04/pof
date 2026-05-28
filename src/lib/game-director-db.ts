import { getDb } from './db';
import type {
  PlaytestSession,
  PlaytestFinding,
  DirectorEvent,
  PlaytestConfig,
  PlaytestSummary,
  PlaytestStatus,
  TriageStatus,
} from '@/types/game-director';

/** Triage states that suppress a finding from regression tracking and health scoring. */
export const TRIAGE_EXCLUDED: readonly TriageStatus[] = ['false-positive', 'ignore'] as const;

export function isTriageExcluded(status: TriageStatus): boolean {
  return (TRIAGE_EXCLUDED as readonly string[]).includes(status);
}

// ─── Schema bootstrap ────────────────────────────────────────────────────────

let initialized = false;

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
      completed_at TEXT
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS game_director_findings (
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
      confidence INTEGER NOT NULL DEFAULT 80,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      triage_status TEXT NOT NULL DEFAULT 'active'
        CHECK(triage_status IN ('active','confirmed','false-positive','ignore','snooze')),
      triage_note TEXT NOT NULL DEFAULT '',
      snoozed_until TEXT,
      FOREIGN KEY (session_id) REFERENCES game_director_sessions(id) ON DELETE CASCADE
    )
  `);

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
): PlaytestSession {
  ensureTables();
  const db = getDb();

  db.prepare(`
    INSERT INTO game_director_sessions (id, name, build_path, config)
    VALUES (?, ?, ?, ?)
  `).run(id, name, buildPath, JSON.stringify(config));

  const session = getSession(id);
  if (!session) {
    throw new Error(`Failed to retrieve session after INSERT (id=${id})`);
  }
  return session;
}

export function getSession(id: string): PlaytestSession | null {
  ensureTables();
  const db = getDb();
  const row = db.prepare('SELECT * FROM game_director_sessions WHERE id = ?').get(id) as SessionRow | undefined;
  if (!row) return null;
  return rowToSession(row);
}

export function listSessions(): PlaytestSession[] {
  ensureTables();
  const db = getDb();
  const rows = db.prepare('SELECT * FROM game_director_sessions ORDER BY created_at DESC').all() as SessionRow[];
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

export function updateSessionSummary(
  id: string,
  summary: PlaytestSummary,
  durationMs: number,
  systemsTestedCount: number,
  findingsCount: number,
) {
  ensureTables();
  const db = getDb();
  db.prepare(`
    UPDATE game_director_sessions
    SET summary = ?, duration_ms = ?, systems_tested_count = ?, findings_count = ?,
        status = 'complete', completed_at = datetime('now')
    WHERE id = ?
  `).run(JSON.stringify(summary), durationMs, systemsTestedCount, findingsCount, id);
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
    db.prepare(`
      INSERT INTO game_director_findings
        (id, session_id, category, severity, title, description,
         related_module, screenshot_ref, game_timestamp, suggested_fix, confidence,
         triage_status, triage_note, snoozed_until)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      finding.id, finding.sessionId, finding.category, finding.severity,
      finding.title, finding.description, finding.relatedModule,
      finding.screenshotRef, finding.gameTimestamp, finding.suggestedFix,
      finding.confidence,
      finding.triageStatus ?? 'active',
      finding.triageNote ?? '',
      finding.snoozedUntil ?? null,
    );

    // Update count on session — excludes findings the user marked as
    // false-positive or ignored so they don't inflate the score.
    db.prepare(`
      UPDATE game_director_sessions
      SET findings_count = (
        SELECT COUNT(*) FROM game_director_findings
        WHERE session_id = ? AND triage_status NOT IN ('false-positive','ignore')
      )
      WHERE id = ?
    `).run(finding.sessionId, finding.sessionId);
  });
  insertAndUpdate();
}

export function updateFindingTriage(
  findingId: string,
  triageStatus: TriageStatus,
  triageNote: string,
  snoozedUntil: string | null,
): PlaytestFinding | null {
  ensureTables();
  const db = getDb();

  const existing = db.prepare('SELECT session_id FROM game_director_findings WHERE id = ?')
    .get(findingId) as { session_id: string } | undefined;
  if (!existing) return null;

  const updateAndRecount = db.transaction(() => {
    db.prepare(`
      UPDATE game_director_findings
      SET triage_status = ?, triage_note = ?, snoozed_until = ?
      WHERE id = ?
    `).run(triageStatus, triageNote, snoozedUntil, findingId);

    db.prepare(`
      UPDATE game_director_sessions
      SET findings_count = (
        SELECT COUNT(*) FROM game_director_findings
        WHERE session_id = ? AND triage_status NOT IN ('false-positive','ignore')
      )
      WHERE id = ?
    `).run(existing.session_id, existing.session_id);
  });
  updateAndRecount();

  const row = db.prepare('SELECT * FROM game_director_findings WHERE id = ?')
    .get(findingId) as FindingRow | undefined;
  return row ? rowToFinding(row) : null;
}

export function getFindings(sessionId: string): PlaytestFinding[] {
  ensureTables();
  const db = getDb();
  const rows = db.prepare(
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
  avgScore: number | null;
  recentSessions: PlaytestSession[];
}

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
}

export function getDirectorStats(): DirectorStats {
  ensureTables();
  const db = getDb();

  const sessCount = db.prepare('SELECT COUNT(*) as c FROM game_director_sessions').get() as { c: number };
  const completeCount = db.prepare("SELECT COUNT(*) as c FROM game_director_sessions WHERE status = 'complete'").get() as { c: number };
  // Counts exclude findings the user has triaged out so noise doesn't inflate the health score.
  const findCount = db.prepare(
    "SELECT COUNT(*) as c FROM game_director_findings WHERE triage_status NOT IN ('false-positive','ignore')"
  ).get() as { c: number };
  const critCount = db.prepare(
    "SELECT COUNT(*) as c FROM game_director_findings WHERE severity = 'critical' AND triage_status NOT IN ('false-positive','ignore')"
  ).get() as { c: number };

  // Average overall score from completed sessions
  const avgRow = db.prepare(
    "SELECT AVG(json_extract(summary, '$.overallScore')) as avg FROM game_director_sessions WHERE status = 'complete' AND summary IS NOT NULL"
  ).get() as { avg: number | null };

  const recentRows = db.prepare(
    'SELECT * FROM game_director_sessions ORDER BY created_at DESC LIMIT 5'
  ).all() as SessionRow[];

  return {
    totalSessions: sessCount.c,
    completedSessions: completeCount.c,
    totalFindings: findCount.c,
    criticalFindings: critCount.c,
    avgScore: avgRow.avg != null ? Math.round(avgRow.avg) : null,
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
    SELECT id, name, created_at, summary, findings_count
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
  }>;

  if (rows.length === 0) return [];

  // Regression alerts table is created lazily by regression-tracker.ts; guard
  // for the case where no regressions have ever been processed.
  const hasRegTable = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='regression_alerts'"
  ).get() as { name: string } | undefined;

  const regCountStmt = hasRegTable
    ? db.prepare(
        'SELECT COUNT(*) as c FROM regression_alerts WHERE reappeared_in_session_id = ?'
      )
    : null;

  const critCountStmt = db.prepare(
    "SELECT COUNT(*) as c FROM game_director_findings WHERE session_id = ? AND severity = 'critical' AND triage_status NOT IN ('false-positive','ignore')"
  );

  return rows.map(r => {
    let overallScore = 0;
    try {
      const summary = JSON.parse(r.summary) as PlaytestSummary;
      overallScore = typeof summary.overallScore === 'number' ? summary.overallScore : 0;
    } catch {
      overallScore = 0;
    }
    const critRow = critCountStmt.get(r.id) as { c: number };
    const regRow = regCountStmt ? (regCountStmt.get(r.id) as { c: number }) : { c: 0 };
    return {
      sessionId: r.id,
      sessionName: r.name,
      createdAt: r.created_at,
      overallScore,
      findingsCount: r.findings_count ?? 0,
      criticalCount: critRow.c,
      regressionCount: regRow.c,
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
  confidence: number;
  created_at: string;
  triage_status: string | null;
  triage_note: string | null;
  snoozed_until: string | null;
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
  };
}

function rowToFinding(row: FindingRow): PlaytestFinding {
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
    confidence: row.confidence || 80,
    createdAt: row.created_at,
    triageStatus: (row.triage_status as PlaytestFinding['triageStatus']) || 'active',
    triageNote: row.triage_note || '',
    snoozedUntil: row.snoozed_until,
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
