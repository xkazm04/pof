import { getDb } from './db';
import { listSessions, getFindings } from './game-director-db';
import type { PlaytestFinding, PlaytestSession } from '@/types/game-director';
import type {
  FindingFingerprint,
  FingerprintOccurrence,
  RegressionAlert,
  RegressionReport,
  RegressionStatus,
} from '@/types/regression-tracker';

// ─── Schema bootstrap ────────────────────────────────────────────────────────

let initialized = false;

function ensureTables() {
  if (initialized) return;
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS regression_fingerprints (
      id TEXT PRIMARY KEY,
      hash TEXT NOT NULL UNIQUE,
      category TEXT NOT NULL,
      title_stem TEXT NOT NULL,
      related_module TEXT,
      first_seen_session_id TEXT NOT NULL,
      first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
      status TEXT NOT NULL DEFAULT 'open'
        CHECK(status IN ('open','fixed','regressed','resolved')),
      peak_severity TEXT NOT NULL DEFAULT 'medium',
      occurrence_count INTEGER NOT NULL DEFAULT 1,
      regression_count INTEGER NOT NULL DEFAULT 0
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS regression_occurrences (
      fingerprint_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      finding_id TEXT NOT NULL,
      severity TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      suggested_fix TEXT NOT NULL DEFAULT '',
      confidence INTEGER NOT NULL DEFAULT 80,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (fingerprint_id, session_id, finding_id)
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_reg_occ_session
    ON regression_occurrences(session_id)
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS regression_alerts (
      id TEXT PRIMARY KEY,
      fingerprint_id TEXT NOT NULL,
      fixed_in_session_id TEXT NOT NULL,
      reappeared_in_session_id TEXT NOT NULL,
      fixed_in_session_name TEXT NOT NULL DEFAULT '',
      reappeared_in_session_name TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL,
      severity TEXT NOT NULL,
      title TEXT NOT NULL,
      build_gap INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      dismissed INTEGER NOT NULL DEFAULT 0
    )
  `);

  initialized = true;
}

// ─── Fingerprint hashing ─────────────────────────────────────────────────────

/** Normalize a finding title into a stable stem for matching across builds */
function stemTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Create a deterministic hash from category + title stem + module */
function hashFingerprint(category: string, titleStem: string, relatedModule: string | null): string {
  const raw = `${category}::${titleStem}::${relatedModule ?? ''}`;
  // Simple string hash (djb2)
  let h = 5381;
  for (let i = 0; i < raw.length; i++) {
    h = ((h << 5) + h + raw.charCodeAt(i)) >>> 0;
  }
  return h.toString(36);
}

// ─── Severity ranking ─────────────────────────────────────────────────────────

const SEVERITY_RANK: Record<string, number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  positive: 1,
};

function higherSeverity(a: string, b: string): string {
  return (SEVERITY_RANK[a] ?? 0) >= (SEVERITY_RANK[b] ?? 0) ? a : b;
}

// ─── Core tracking ───────────────────────────────────────────────────────────

/** Process all findings from a session and update fingerprint tracking */
export function processSession(session: PlaytestSession): RegressionReport {
  ensureTables();
  const db = getDb();

  const findings = getFindings(session.id);
  const allSessions = listSessions();

  // Build session index ordered by creation date
  const sessionIndex = new Map<string, number>();
  const sortedSessions = [...allSessions].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
  sortedSessions.forEach((s, i) => sessionIndex.set(s.id, i));

  const sessionOrder = sessionIndex.get(session.id) ?? 0;

  // Current fingerprints present in this session
  const currentHashes = new Set<string>();
  const newFindings: FindingFingerprint[] = [];
  const regressions: RegressionAlert[] = [];

  // Process each finding
  for (const finding of findings) {
    const stem = stemTitle(finding.title);
    const hash = hashFingerprint(finding.category, stem, finding.relatedModule);
    currentHashes.add(hash);

    // Check if fingerprint exists
    const existing = db.prepare(
      'SELECT * FROM regression_fingerprints WHERE hash = ?'
    ).get(hash) as Record<string, unknown> | undefined;

    if (!existing) {
      // New finding — create fingerprint
      const fpId = crypto.randomUUID();
      db.prepare(`
        INSERT INTO regression_fingerprints
          (id, hash, category, title_stem, related_module, first_seen_session_id, status, peak_severity)
        VALUES (?, ?, ?, ?, ?, ?, 'open', ?)
      `).run(fpId, hash, finding.category, stem, finding.relatedModule, session.id, finding.severity);

      // Add occurrence
      insertOccurrence(db, fpId, session.id, finding);

      const fp = getFingerprint(db, fpId)!;
      newFindings.push(fp);
    } else {
      const fpId = existing.id as string;
      const prevStatus = existing.status as RegressionStatus;

      // Add occurrence
      const existingOcc = db.prepare(
        'SELECT 1 FROM regression_occurrences WHERE fingerprint_id = ? AND session_id = ? AND finding_id = ?'
      ).get(fpId, session.id, finding.id);
      if (!existingOcc) {
        insertOccurrence(db, fpId, session.id, finding);
      }

      // Update peak severity
      const newPeak = higherSeverity(existing.peak_severity as string, finding.severity);

      // Count occurrences
      const occCount = (db.prepare(
        'SELECT COUNT(DISTINCT session_id) as cnt FROM regression_occurrences WHERE fingerprint_id = ?'
      ).get(fpId) as { cnt: number }).cnt;

      if (prevStatus === 'fixed' || prevStatus === 'resolved') {
        // REGRESSION: was fixed but reappeared
        const regCount = (existing.regression_count as number) + 1;

        db.prepare(`
          UPDATE regression_fingerprints
          SET status = 'regressed', peak_severity = ?, occurrence_count = ?, regression_count = ?
          WHERE id = ?
        `).run(newPeak, occCount, regCount, fpId);

        // Find the session where it was last fixed
        const lastFixedSessionId = findLastFixedSession(db, fpId, session.id, sortedSessions);
        const fixedSession = allSessions.find(s => s.id === lastFixedSessionId);
        const fixedOrder = lastFixedSessionId ? (sessionIndex.get(lastFixedSessionId) ?? 0) : 0;
        const buildGap = sessionOrder - fixedOrder;

        const alertId = crypto.randomUUID();
        db.prepare(`
          INSERT INTO regression_alerts
            (id, fingerprint_id, fixed_in_session_id, reappeared_in_session_id,
             fixed_in_session_name, reappeared_in_session_name,
             category, severity, title, build_gap)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          alertId, fpId,
          lastFixedSessionId ?? session.id, session.id,
          fixedSession?.name ?? '', session.name,
          finding.category, finding.severity, finding.title,
          buildGap,
        );

        const alert = getAlert(db, alertId)!;
        regressions.push(alert);
      } else {
        // Still open or regressed — update counts
        db.prepare(`
          UPDATE regression_fingerprints
          SET status = 'open', peak_severity = ?, occurrence_count = ?
          WHERE id = ?
        `).run(newPeak, occCount, fpId);
      }
    }
  }

  // Find fingerprints that were open/regressed but NOT in this session → mark fixed
  const newlyFixed: FindingFingerprint[] = [];
  const openFingerprints = db.prepare(
    "SELECT * FROM regression_fingerprints WHERE status IN ('open', 'regressed')"
  ).all() as Record<string, unknown>[];

  for (const row of openFingerprints) {
    const hash = row.hash as string;
    if (!currentHashes.has(hash)) {
      // Not found in this session — mark as fixed
      db.prepare(
        "UPDATE regression_fingerprints SET status = 'fixed' WHERE id = ?"
      ).run(row.id as string);
      newlyFixed.push(rowToFingerprint({ ...row, status: 'fixed' }));
    }
  }

  // Persistent: open fingerprints that appeared in this session AND were already known
  const persistent = db.prepare(
    "SELECT * FROM regression_fingerprints WHERE status = 'open' AND hash != ''"
  ).all() as Record<string, unknown>[];
  const persistentList = persistent
    .filter(r => currentHashes.has(r.hash as string) && !newFindings.some(n => n.hash === r.hash as string))
    .map(rowToFingerprint);

  // Stats
  const allFps = db.prepare('SELECT status FROM regression_fingerprints').all() as { status: string }[];
  const stats = {
    totalTracked: allFps.length,
    openCount: allFps.filter(f => f.status === 'open').length,
    fixedCount: allFps.filter(f => f.status === 'fixed').length,
    regressedCount: allFps.filter(f => f.status === 'regressed').length,
    resolvedCount: allFps.filter(f => f.status === 'resolved').length,
    regressionRate: allFps.length > 0
      ? allFps.filter(f => f.status === 'regressed').length / allFps.length
      : 0,
  };

  return {
    sessionId: session.id,
    sessionName: session.name,
    generatedAt: new Date().toISOString(),
    newFindings,
    regressions,
    persistent: persistentList,
    newlyFixed,
    stats,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function insertOccurrence(db: ReturnType<typeof getDb>, fpId: string, sessionId: string, finding: PlaytestFinding) {
  db.prepare(`
    INSERT OR IGNORE INTO regression_occurrences
      (fingerprint_id, session_id, finding_id, severity, title, description, suggested_fix, confidence)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(fpId, sessionId, finding.id, finding.severity, finding.title, finding.description, finding.suggestedFix, finding.confidence);
}

function findLastFixedSession(
  db: ReturnType<typeof getDb>,
  fingerprintId: string,
  currentSessionId: string,
  sortedSessions: PlaytestSession[],
): string | null {
  // Find the most recent session before this one that had the occurrence
  const occurrences = db.prepare(
    'SELECT session_id FROM regression_occurrences WHERE fingerprint_id = ? AND session_id != ?'
  ).all(fingerprintId, currentSessionId) as { session_id: string }[];

  const occSessionIds = new Set(occurrences.map(o => o.session_id));

  // Walk backwards to find the last session that had it
  for (let i = sortedSessions.length - 1; i >= 0; i--) {
    if (occSessionIds.has(sortedSessions[i].id)) {
      return sortedSessions[i].id;
    }
  }
  return null;
}

// ─── Read API ─────────────────────────────────────────────────────────────────

export function getAllFingerprints(): FindingFingerprint[] {
  ensureTables();
  const db = getDb();
  const rows = db.prepare('SELECT * FROM regression_fingerprints ORDER BY regression_count DESC, occurrence_count DESC').all() as Record<string, unknown>[];
  return rows.map(rowToFingerprint);
}

export function getOccurrences(fingerprintId: string): FingerprintOccurrence[] {
  ensureTables();
  const db = getDb();
  const rows = db.prepare(
    'SELECT * FROM regression_occurrences WHERE fingerprint_id = ? ORDER BY created_at DESC'
  ).all(fingerprintId) as Record<string, unknown>[];
  return rows.map(rowToOccurrence);
}

export function getActiveAlerts(): RegressionAlert[] {
  ensureTables();
  const db = getDb();
  const rows = db.prepare(
    'SELECT * FROM regression_alerts WHERE dismissed = 0 ORDER BY created_at DESC'
  ).all() as Record<string, unknown>[];
  return rows.map(rowToAlert);
}

export function getAllAlerts(): RegressionAlert[] {
  ensureTables();
  const db = getDb();
  const rows = db.prepare(
    'SELECT * FROM regression_alerts ORDER BY created_at DESC LIMIT 100'
  ).all() as Record<string, unknown>[];
  return rows.map(rowToAlert);
}

export function dismissAlert(alertId: string) {
  ensureTables();
  const db = getDb();
  db.prepare('UPDATE regression_alerts SET dismissed = 1 WHERE id = ?').run(alertId);
}

export function markResolved(fingerprintId: string) {
  ensureTables();
  const db = getDb();
  db.prepare("UPDATE regression_fingerprints SET status = 'resolved' WHERE id = ?").run(fingerprintId);
}

export function getRegressionStats() {
  ensureTables();
  const db = getDb();
  const all = db.prepare('SELECT status FROM regression_fingerprints').all() as { status: string }[];
  const activeAlerts = (db.prepare('SELECT COUNT(*) as cnt FROM regression_alerts WHERE dismissed = 0').get() as { cnt: number }).cnt;

  return {
    totalTracked: all.length,
    openCount: all.filter(f => f.status === 'open').length,
    fixedCount: all.filter(f => f.status === 'fixed').length,
    regressedCount: all.filter(f => f.status === 'regressed').length,
    resolvedCount: all.filter(f => f.status === 'resolved').length,
    activeAlerts,
    regressionRate: all.length > 0 ? all.filter(f => f.status === 'regressed').length / all.length : 0,
  };
}

// ─── Row mappers ──────────────────────────────────────────────────────────────

function rowToFingerprint(row: Record<string, unknown>): FindingFingerprint {
  return {
    id: row.id as string,
    hash: row.hash as string,
    category: row.category as FindingFingerprint['category'],
    titleStem: row.title_stem as string,
    relatedModule: (row.related_module as string) || null,
    firstSeenSessionId: row.first_seen_session_id as string,
    firstSeenAt: row.first_seen_at as string,
    status: row.status as FindingFingerprint['status'],
    peakSeverity: row.peak_severity as FindingFingerprint['peakSeverity'],
    occurrenceCount: row.occurrence_count as number,
    regressionCount: row.regression_count as number,
  };
}

function getFingerprint(db: ReturnType<typeof getDb>, id: string): FindingFingerprint | null {
  const row = db.prepare('SELECT * FROM regression_fingerprints WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  return rowToFingerprint(row);
}

function getAlert(db: ReturnType<typeof getDb>, id: string): RegressionAlert | null {
  const row = db.prepare('SELECT * FROM regression_alerts WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  return rowToAlert(row);
}

function rowToOccurrence(row: Record<string, unknown>): FingerprintOccurrence {
  return {
    fingerprintId: row.fingerprint_id as string,
    sessionId: row.session_id as string,
    findingId: row.finding_id as string,
    severity: row.severity as FingerprintOccurrence['severity'],
    title: row.title as string,
    description: row.description as string,
    suggestedFix: row.suggested_fix as string,
    confidence: row.confidence as number,
    createdAt: row.created_at as string,
  };
}

function rowToAlert(row: Record<string, unknown>): RegressionAlert {
  return {
    id: row.id as string,
    fingerprintId: row.fingerprint_id as string,
    fixedInSessionId: row.fixed_in_session_id as string,
    reappearedInSessionId: row.reappeared_in_session_id as string,
    fixedInSessionName: row.fixed_in_session_name as string,
    reappearedInSessionName: row.reappeared_in_session_name as string,
    category: row.category as RegressionAlert['category'],
    severity: row.severity as RegressionAlert['severity'],
    title: row.title as string,
    buildGap: row.build_gap as number,
    createdAt: row.created_at as string,
    dismissed: !!(row.dismissed as number),
  };
}
