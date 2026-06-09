import { getDb } from './db';
import type { SubModuleId } from '@/types/modules';
import type { SessionLogEntry, SessionLogEvent } from '@/types/session-log';

/** Ensure DB is initialized (tables created by getDb()). Call at the top of every exported function. */
function ensureTables() {
  getDb();
}

// ── Row mapping ──

function rowToEntry(row: Record<string, unknown>): SessionLogEntry {
  return {
    id: row.id as number,
    tabId: row.tab_id as string,
    sessionKey: row.session_key as string,
    moduleId: row.module_id as SubModuleId,
    projectPath: row.project_path as string,
    event: row.event as SessionLogEvent,
    success: row.success === null ? null : (row.success as number) === 1,
    promptPreview: row.prompt_preview as string,
    durationMs: row.duration_ms as number | null,
    createdAt: row.created_at as string,
  };
}

// ── Write ──

/** Shared INSERT for the session_log table — both writers use this so the column list cannot drift. */
const INSERT_SESSION_LOG = `
  INSERT INTO session_log
    (tab_id, session_key, module_id, project_path, event, success, prompt_preview, duration_ms)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`;

export function logSessionEvent(data: {
  tabId: string;
  sessionKey: string;
  moduleId: SubModuleId;
  projectPath: string;
  event: SessionLogEvent;
  success?: boolean;
  promptPreview?: string;
  durationMs?: number;
}): SessionLogEntry {
  ensureTables();
  const db = getDb();

  const result = db.prepare(INSERT_SESSION_LOG).run(
    data.tabId,
    data.sessionKey,
    data.moduleId,
    data.projectPath,
    data.event,
    data.success === undefined ? null : data.success ? 1 : 0,
    data.promptPreview ?? '',
    data.durationMs ?? null,
  );

  const row = db.prepare('SELECT * FROM session_log WHERE id = ?')
    .get(result.lastInsertRowid as number) as Record<string, unknown>;
  return rowToEntry(row);
}

// ── Read ──

export function getSessionLog(projectPath: string, limit = 50): SessionLogEntry[] {
  ensureTables();
  const rows = getDb()
    .prepare('SELECT * FROM session_log WHERE project_path = ? ORDER BY created_at DESC LIMIT ?')
    .all(projectPath, limit) as Record<string, unknown>[];
  return rows.map(rowToEntry);
}

export function getModuleSessionLog(moduleId: SubModuleId, limit = 30): SessionLogEntry[] {
  ensureTables();
  const rows = getDb()
    .prepare('SELECT * FROM session_log WHERE module_id = ? ORDER BY created_at DESC LIMIT ?')
    .all(moduleId, limit) as Record<string, unknown>[];
  return rows.map(rowToEntry);
}

/** Cancel all open sessions for a given project (used during project switch). */
export function cancelOpenSessions(projectPath: string): number {
  ensureTables();
  const db = getDb();

  const openRows = db.prepare(`
    SELECT s.* FROM session_log s
    WHERE s.project_path = ? AND s.event = 'started'
      AND s.id > COALESCE(
        (SELECT MAX(s2.id) FROM session_log s2
         WHERE s2.tab_id = s.tab_id AND s2.event IN ('completed', 'cancelled')),
        0
      )
  `).all(projectPath) as Record<string, unknown>[];

  if (openRows.length === 0) return 0;

  const insert = db.prepare(INSERT_SESSION_LOG);

  const batch = db.transaction(() => {
    for (const row of openRows) {
      insert.run(
        row.tab_id,
        row.session_key,
        row.module_id,
        row.project_path,
        'cancelled',
        0,
        '',
        null,
      );
    }
  });
  batch();

  return openRows.length;
}
