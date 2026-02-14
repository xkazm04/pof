import { getDb } from './db';
import type {
  PlaytestSession,
  PlaytestFinding,
  DirectorEvent,
  PlaytestConfig,
  PlaytestSummary,
  PlaytestStatus,
} from '@/types/game-director';

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
      FOREIGN KEY (session_id) REFERENCES game_director_sessions(id) ON DELETE CASCADE
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_gd_findings_session
    ON game_director_findings(session_id, severity)
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

  return getSession(id)!;
}

export function getSession(id: string): PlaytestSession | null {
  ensureTables();
  const db = getDb();
  const row = db.prepare('SELECT * FROM game_director_sessions WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  return rowToSession(row);
}

export function listSessions(): PlaytestSession[] {
  ensureTables();
  const db = getDb();
  const rows = db.prepare('SELECT * FROM game_director_sessions ORDER BY created_at DESC').all() as Record<string, unknown>[];
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
  db.prepare('DELETE FROM game_director_events WHERE session_id = ?').run(id);
  db.prepare('DELETE FROM game_director_findings WHERE session_id = ?').run(id);
  db.prepare('DELETE FROM game_director_sessions WHERE id = ?').run(id);
}

// ─── Findings CRUD ───────────────────────────────────────────────────────────

export function addFinding(finding: PlaytestFinding) {
  ensureTables();
  const db = getDb();
  db.prepare(`
    INSERT INTO game_director_findings
      (id, session_id, category, severity, title, description,
       related_module, screenshot_ref, game_timestamp, suggested_fix, confidence)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    finding.id, finding.sessionId, finding.category, finding.severity,
    finding.title, finding.description, finding.relatedModule,
    finding.screenshotRef, finding.gameTimestamp, finding.suggestedFix,
    finding.confidence,
  );

  // Update count on session
  db.prepare(`
    UPDATE game_director_sessions
    SET findings_count = (SELECT COUNT(*) FROM game_director_findings WHERE session_id = ?)
    WHERE id = ?
  `).run(finding.sessionId, finding.sessionId);
}

export function getFindings(sessionId: string): PlaytestFinding[] {
  ensureTables();
  const db = getDb();
  const rows = db.prepare(
    'SELECT * FROM game_director_findings WHERE session_id = ? ORDER BY severity, created_at'
  ).all(sessionId) as Record<string, unknown>[];
  return rows.map(rowToFinding);
}

export function getAllFindings(): PlaytestFinding[] {
  ensureTables();
  const db = getDb();
  const rows = db.prepare(
    'SELECT * FROM game_director_findings ORDER BY created_at DESC LIMIT 200'
  ).all() as Record<string, unknown>[];
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
  ).all(sessionId, limit) as Record<string, unknown>[];
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

export function getDirectorStats(): DirectorStats {
  ensureTables();
  const db = getDb();

  const sessCount = db.prepare('SELECT COUNT(*) as c FROM game_director_sessions').get() as { c: number };
  const completeCount = db.prepare("SELECT COUNT(*) as c FROM game_director_sessions WHERE status = 'complete'").get() as { c: number };
  const findCount = db.prepare('SELECT COUNT(*) as c FROM game_director_findings').get() as { c: number };
  const critCount = db.prepare("SELECT COUNT(*) as c FROM game_director_findings WHERE severity = 'critical'").get() as { c: number };

  // Average overall score from completed sessions
  const avgRow = db.prepare(
    "SELECT AVG(json_extract(summary, '$.overallScore')) as avg FROM game_director_sessions WHERE status = 'complete' AND summary IS NOT NULL"
  ).get() as { avg: number | null };

  const recentRows = db.prepare(
    'SELECT * FROM game_director_sessions ORDER BY created_at DESC LIMIT 5'
  ).all() as Record<string, unknown>[];

  return {
    totalSessions: sessCount.c,
    completedSessions: completeCount.c,
    totalFindings: findCount.c,
    criticalFindings: critCount.c,
    avgScore: avgRow.avg != null ? Math.round(avgRow.avg) : null,
    recentSessions: recentRows.map(rowToSession),
  };
}

// ─── Row mappers ─────────────────────────────────────────────────────────────

function rowToSession(row: Record<string, unknown>): PlaytestSession {
  return {
    id: row.id as string,
    name: row.name as string,
    status: row.status as PlaytestSession['status'],
    buildPath: row.build_path as string,
    createdAt: row.created_at as string,
    startedAt: (row.started_at as string) || null,
    completedAt: (row.completed_at as string) || null,
    durationMs: (row.duration_ms as number) || null,
    config: JSON.parse((row.config as string) || '{}'),
    summary: row.summary ? JSON.parse(row.summary as string) : null,
    systemsTestedCount: (row.systems_tested_count as number) || 0,
    findingsCount: (row.findings_count as number) || 0,
  };
}

function rowToFinding(row: Record<string, unknown>): PlaytestFinding {
  return {
    id: row.id as string,
    sessionId: row.session_id as string,
    category: row.category as PlaytestFinding['category'],
    severity: row.severity as PlaytestFinding['severity'],
    title: row.title as string,
    description: (row.description as string) || '',
    relatedModule: (row.related_module as string) || null,
    screenshotRef: (row.screenshot_ref as string) || null,
    gameTimestamp: (row.game_timestamp as number) || null,
    suggestedFix: (row.suggested_fix as string) || '',
    confidence: (row.confidence as number) || 80,
    createdAt: row.created_at as string,
  };
}

function rowToEvent(row: Record<string, unknown>): DirectorEvent {
  return {
    id: row.id as string,
    sessionId: row.session_id as string,
    timestamp: row.timestamp as string,
    type: row.type as DirectorEvent['type'],
    message: row.message as string,
    data: row.data ? JSON.parse(row.data as string) : undefined,
  };
}
