import { getDb } from './db';
import { getFindings, isTriageExcluded } from './game-director-db';
import type { PlaytestConfig, PlaytestFinding, PlaytestSession } from '@/types/game-director';
import type {
  FindingFingerprint,
  FingerprintOccurrence,
  RegressionAlert,
  RegressionReport,
  RegressionStats,
  RegressionStatus,
  RegressionStatusCounts,
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

  // One alert per (fingerprint, reappeared-in-session): a regression event is uniquely
  // identified by the fingerprint that came back and the session it came back in.
  // Re-analyzing the same session must not mint a second alert for the same event
  // (mirrors the regression_occurrences composite PRIMARY KEY idempotency).
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_reg_alert_fp_session
    ON regression_alerts(fingerprint_id, reappeared_in_session_id)
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

// ─── Status counting ────────────────────────────────────────────────────────────

/**
 * Tally fingerprint rows into the shared status breakdown. Single source of truth
 * for the counts consumed by both the per-session report and the dashboard stats.
 */
function countFingerprintStatuses(rows: { status: string }[]): RegressionStatusCounts {
  const regressedCount = rows.filter(f => f.status === 'regressed').length;
  return {
    totalTracked: rows.length,
    openCount: rows.filter(f => f.status === 'open').length,
    fixedCount: rows.filter(f => f.status === 'fixed').length,
    regressedCount,
    resolvedCount: rows.filter(f => f.status === 'resolved').length,
    regressionRate: rows.length > 0 ? regressedCount / rows.length : 0,
  };
}

// ─── Session projections ─────────────────────────────────────────────────────

/**
 * The only two session fields this module reads: chronological identity and the
 * name shown on a regression alert. Deliberately NOT a `PlaytestSession` — the
 * tracker has no business hydrating configs and summaries it never looks at.
 */
interface SessionRef {
  id: string;
  name: string;
}

/**
 * Test categories a stored session config declares. Tolerates a missing,
 * malformed or non-array config by returning nothing — a session whose scope
 * cannot be read tests nothing as far as the sweep is concerned, which can only
 * ever under-sweep.
 */
function parseTestCategories(rawConfig: string): string[] {
  try {
    const parsed = JSON.parse(rawConfig) as Partial<PlaytestConfig>;
    return Array.isArray(parsed?.testCategories)
      ? parsed.testCategories.filter((c): c is PlaytestConfig['testCategories'][number] => typeof c === 'string')
      : [];
  } catch {
    return [];
  }
}

// ─── Core tracking ───────────────────────────────────────────────────────────

/** Process all findings from a session and update fingerprint tracking */
export function processSession(session: PlaytestSession): RegressionReport {
  ensureTables();
  const db = getDb();

  // Wrap the whole multi-table mutation (fingerprints + occurrences + alerts + the
  // "mark fixed" sweep) in one transaction. better-sqlite3 transactions are synchronous
  // and roll back atomically on any throw, so a mid-loop failure can no longer leave
  // occurrence_count, the occurrence rows, and fingerprint status disagreeing.
  return db.transaction((): RegressionReport => {
  // Findings the user marked as false-positive or ignore are excluded from
  // fingerprinting so noise doesn't inflate regression counts.
  const findings = getFindings(session.id).filter(f => !isTriageExcluded(f.triageStatus));

  // Session ordering + names in ONE chronological SELECT. This used to call
  // listSessions() unbounded — hydrating and JSON-parsing every session's config
  // and summary for the whole project's history — purely so the regression
  // branch could look up one session's NAME. The ordered id+name projection is
  // all this function ever read off it.
  const sortedSessions = db.prepare(
    'SELECT id, name FROM game_director_sessions ORDER BY datetime(created_at)'
  ).all() as SessionRef[];
  const nameById = new Map(sortedSessions.map(s => [s.id, s.name]));

  // Build session index ordered by creation date
  const sessionIndex = new Map<string, number>();
  sortedSessions.forEach((s, i) => sessionIndex.set(s.id, i));

  const sessionOrder = sessionIndex.get(session.id) ?? 0;

  // ── Batch the per-finding READ round-trips ───────────────────────────────
  // Instead of one SELECT per finding inside the loop, fetch everything keyed
  // by the session's findings in a handful of queries and look up in memory.

  // 1. Compute every hash present in this session up front.
  const findingHashes = findings.map(finding => {
    const stem = stemTitle(finding.title);
    return {
      finding,
      stem,
      hash: hashFingerprint(finding.category, stem, finding.relatedModule),
    };
  });
  const uniqueHashes = [...new Set(findingHashes.map(f => f.hash))];

  // 2. One keyed read of all matching fingerprints (hash has a UNIQUE index).
  const fingerprintByHash = new Map<string, Record<string, unknown>>();
  if (uniqueHashes.length > 0) {
    const placeholders = uniqueHashes.map(() => '?').join(',');
    const rows = db.prepare(
      `SELECT * FROM regression_fingerprints WHERE hash IN (${placeholders})`
    ).all(...uniqueHashes) as Record<string, unknown>[];
    for (const row of rows) fingerprintByHash.set(row.hash as string, row);
  }
  const existingFpIds = [...fingerprintByHash.values()].map(r => r.id as string);

  // 3. One read of this session's existing occurrences (idempotency guard).
  const existingOccKeys = new Set<string>();
  const occRows = db.prepare(
    'SELECT fingerprint_id, finding_id FROM regression_occurrences WHERE session_id = ?'
  ).all(session.id) as { fingerprint_id: string; finding_id: string }[];
  for (const o of occRows) existingOccKeys.add(`${o.fingerprint_id}::${o.finding_id}`);

  // 4. One read of the distinct-session set per existing fingerprint, so the
  //    occurrence count (COUNT(DISTINCT session_id), evaluated AFTER this run's
  //    insert) can be reproduced in memory by adding session.id to the set.
  const distinctSessionsByFp = new Map<string, Set<string>>();
  for (const id of existingFpIds) distinctSessionsByFp.set(id, new Set());
  if (existingFpIds.length > 0) {
    const placeholders = existingFpIds.map(() => '?').join(',');
    const distRows = db.prepare(
      `SELECT DISTINCT fingerprint_id, session_id FROM regression_occurrences WHERE fingerprint_id IN (${placeholders})`
    ).all(...existingFpIds) as { fingerprint_id: string; session_id: string }[];
    for (const d of distRows) distinctSessionsByFp.get(d.fingerprint_id)?.add(d.session_id);
  }

  // Current fingerprints present in this session
  const currentHashes = new Set<string>();
  const newFindings: FindingFingerprint[] = [];
  const regressions: RegressionAlert[] = [];

  // Process each finding
  for (const { finding, stem, hash } of findingHashes) {
    currentHashes.add(hash);

    // Check if fingerprint exists (in-memory lookup, no DB round-trip)
    const existing = fingerprintByHash.get(hash);

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
      existingOccKeys.add(`${fpId}::${finding.id}`);

      const fp = getFingerprint(db, fpId)!;
      newFindings.push(fp);

      // Make the just-created fingerprint visible to later findings that share
      // its hash within this same session (mirrors the prior per-finding SELECT *,
      // which would have re-read the freshly inserted raw row).
      const insertedRow = db.prepare(
        'SELECT * FROM regression_fingerprints WHERE id = ?'
      ).get(fpId) as Record<string, unknown>;
      fingerprintByHash.set(hash, insertedRow);
      distinctSessionsByFp.set(fpId, new Set([session.id]));
    } else {
      const fpId = existing.id as string;
      const prevStatus = existing.status as RegressionStatus;

      // Add occurrence (idempotency guard via the in-memory key set)
      const occKey = `${fpId}::${finding.id}`;
      const existingOcc = existingOccKeys.has(occKey);
      if (!existingOcc) {
        insertOccurrence(db, fpId, session.id, finding);
        existingOccKeys.add(occKey);
      }

      // Update peak severity
      const newPeak = higherSeverity(existing.peak_severity as string, finding.severity);

      // Count occurrences (distinct sessions, AFTER this run's insert) in memory.
      const distinctSet = distinctSessionsByFp.get(fpId) ?? new Set<string>();
      distinctSet.add(session.id);
      distinctSessionsByFp.set(fpId, distinctSet);
      const occCount = distinctSet.size;

      if (prevStatus === 'fixed' || prevStatus === 'resolved') {
        // REGRESSION: was fixed but reappeared
        const regCount = (existing.regression_count as number) + 1;

        db.prepare(`
          UPDATE regression_fingerprints
          SET status = 'regressed', peak_severity = ?, occurrence_count = ?, regression_count = ?
          WHERE id = ?
        `).run(newPeak, occCount, regCount, fpId);

        // Reflect the mutation in memory so a later finding sharing this hash in the
        // same session sees the updated row (matches the prior per-finding re-read).
        existing.status = 'regressed';
        existing.peak_severity = newPeak;
        existing.occurrence_count = occCount;
        existing.regression_count = regCount;

        // Find the session where it was last fixed
        const lastFixedSessionId = findLastFixedSession(db, fpId, session.id, sortedSessions);
        const fixedSessionName = lastFixedSessionId ? nameById.get(lastFixedSessionId) : undefined;
        const fixedOrder = lastFixedSessionId ? (sessionIndex.get(lastFixedSessionId) ?? 0) : 0;
        const buildGap = sessionOrder - fixedOrder;

        // Idempotent on (fingerprint_id, reappeared_in_session_id): re-analyzing the
        // same session is a no-op for the alert table (INSERT OR IGNORE against the
        // UNIQUE index), exactly like insertOccurrence is idempotent on its PRIMARY KEY.
        const alertId = crypto.randomUUID();
        const inserted = db.prepare(`
          INSERT OR IGNORE INTO regression_alerts
            (id, fingerprint_id, fixed_in_session_id, reappeared_in_session_id,
             fixed_in_session_name, reappeared_in_session_name,
             category, severity, title, build_gap)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          alertId, fpId,
          lastFixedSessionId ?? session.id, session.id,
          fixedSessionName ?? '', session.name,
          finding.category, finding.severity, finding.title,
          buildGap,
        );

        // Only surface the alert in the report when this analyze run actually created
        // it; a duplicate (changes === 0) means the regression was already reported.
        if (inserted.changes > 0) {
          const alert = getAlert(db, alertId)!;
          regressions.push(alert);
        }
      } else {
        // Still open or regressed — update counts
        db.prepare(`
          UPDATE regression_fingerprints
          SET status = 'open', peak_severity = ?, occurrence_count = ?
          WHERE id = ?
        `).run(newPeak, occCount, fpId);

        // Reflect the mutation in memory (see note above).
        existing.status = 'open';
        existing.peak_severity = newPeak;
        existing.occurrence_count = occCount;
      }
    }
  }

  // ── The "mark fixed" sweep, SCOPED to what this session actually tested ────
  //
  // This sweep used to be global: every open/regressed fingerprint anywhere in
  // the DB whose hash was absent from THIS session was flipped to 'fixed'.
  // Analyzing a combat-only session therefore declared every exploration,
  // audio and save-load fingerprint fixed — and the next session that tested
  // those categories fired a regression alert for each one, with a build gap
  // measured against a fix that never happened. Every alert the tracker has
  // ever raised is downstream of that.
  //
  // A session can only testify about ground it covered. Absence of evidence is
  // evidence of a fix ONLY where the session looked.
  const newlyFixed: FindingFingerprint[] = [];
  const sweepScope = new Set<string>(session.config?.testCategories ?? []);
  const openFingerprints = db.prepare(
    "SELECT * FROM regression_fingerprints WHERE status IN ('open', 'regressed')"
  ).all() as Record<string, unknown>[];

  // Which test categories has each open fingerprint ever been observed under?
  // Fingerprints carry a FindingCategory ('animation-issue', 'level-pacing'),
  // while sessions declare TestCategories ('combat', 'exploration') — two
  // different taxonomies with no stored mapping between them. What IS recorded
  // is which sessions a fingerprint occurred in, and what those sessions tested.
  // So a fingerprint is in scope when this session re-covered ground that has
  // previously produced it. Bounded to open fingerprints: a resolved/fixed one
  // is not swept.
  const scopeByFingerprint = new Map<string, Set<string>>();
  if (openFingerprints.length > 0 && sweepScope.size > 0) {
    const configCache = new Map<string, string[]>();
    const rows = db.prepare(
      `SELECT DISTINCT o.fingerprint_id AS fp, s.config AS config
       FROM regression_occurrences o
       JOIN regression_fingerprints f ON f.id = o.fingerprint_id
       JOIN game_director_sessions s ON s.id = o.session_id
       WHERE f.status IN ('open', 'regressed')`
    ).all() as Array<{ fp: string; config: string | null }>;
    for (const r of rows) {
      const raw = r.config ?? '{}';
      let cats = configCache.get(raw);
      if (!cats) {
        cats = parseTestCategories(raw);
        configCache.set(raw, cats);
      }
      let set = scopeByFingerprint.get(r.fp);
      if (!set) { set = new Set(); scopeByFingerprint.set(r.fp, set); }
      for (const c of cats) set.add(c);
    }
  }

  for (const row of openFingerprints) {
    const hash = row.hash as string;
    if (currentHashes.has(hash)) continue;

    // A session may vindicate a fingerprint only if its scope COVERS every
    // category that has ever produced it — not merely overlaps one. Overlap is
    // not enough: a session testing [combat, exploration] produces exploration
    // fingerprints whose covered set includes combat, so an overlap rule would
    // let the next combat-only session clear them and re-open the exact false
    // regression this scoping exists to kill.
    //
    // Unknown scope (no readable categories behind the fingerprint) is treated
    // as NOT covered. Under-sweeping leaves a fingerprint 'open' — an honest "we
    // have not shown this is fixed"; over-sweeping invents a fix and then a
    // regression against it. Only one of those two errors lies.
    const covered = scopeByFingerprint.get(row.id as string);
    const inScope = covered != null && covered.size > 0
      && [...covered].every(c => sweepScope.has(c));
    if (!inScope) continue;

    db.prepare(
      "UPDATE regression_fingerprints SET status = 'fixed' WHERE id = ?"
    ).run(row.id as string);
    newlyFixed.push(rowToFingerprint({ ...row, status: 'fixed' }));
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
  const stats = countFingerprintStatuses(allFps);

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
  })();
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
  sortedSessions: SessionRef[],
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

export function getOccurrences(fingerprintId: string, limit?: number): FingerprintOccurrence[] {
  ensureTables();
  const db = getDb();
  const rows = (limit != null
    ? db.prepare('SELECT * FROM regression_occurrences WHERE fingerprint_id = ? ORDER BY created_at DESC LIMIT ?').all(fingerprintId, limit)
    : db.prepare('SELECT * FROM regression_occurrences WHERE fingerprint_id = ? ORDER BY created_at DESC').all(fingerprintId)) as Record<string, unknown>[];
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

export function getRegressionStats(): RegressionStats {
  ensureTables();
  const db = getDb();
  const all = db.prepare('SELECT status FROM regression_fingerprints').all() as { status: string }[];
  const activeAlerts = (db.prepare('SELECT COUNT(*) as cnt FROM regression_alerts WHERE dismissed = 0').get() as { cnt: number }).cnt;

  return { ...countFingerprintStatuses(all), activeAlerts };
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
