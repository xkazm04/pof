/**
 * Deep-eval scan-result persistence.
 *
 * Every completed deep-eval scan is durable here — one row per scan holding the
 * full (merged-baseline) findings JSON plus the scan's metadata (module set,
 * failed modules, timings, severity counts). This turns the regression baseline
 * from a single localStorage snapshot (`deepEvalStore`, one step deep, per-browser,
 * wiped on re-scan) into a queryable server-side history that the Game Director's
 * regression tracking can read (see `scan-delta.ts`).
 *
 * Single SQLite instance via {@link getDb}; the table is created lazily on first
 * use, matching the other *-db.ts modules. Server-only — never import from a
 * client component; go through `/api/evaluator/results`.
 */

import { getDb } from '@/lib/db';
import type { EvalFinding } from './finding-collector';
import type { SeverityCounts } from './regression-diff';

// ── Types ──────────────────────────────────────────────────────────────────────

/** A completed scan as persisted / read back. */
export interface PersistedScan {
  scanId: string;
  /** Project identity (project path), or '' when unscoped. */
  projectId: string;
  /** Scan completion time, ISO-8601. */
  scannedAt: string;
  /** Scan completion time, ms epoch (derived from `scannedAt`) — the git `--since` window. */
  timestamp: number;
  durationMs: number;
  /** Modules successfully evaluated in this scan (the diff scope). */
  modulesEvaluated: string[];
  /** Modules whose passes errored — excluded from baseline merges. */
  failedModules: string[];
  totalFindings: number;
  severityCounts: SeverityCounts;
  /** The merged-baseline findings after this scan (full known state). */
  findings: EvalFinding[];
}

/** Input to {@link recordScanResult} — derived counts are computed server-side. */
export interface RecordScanInput {
  scanId: string;
  projectId?: string;
  /** ISO timestamp; defaults to now. */
  scannedAt?: string;
  durationMs?: number;
  modulesEvaluated: string[];
  failedModules?: string[];
  findings: EvalFinding[];
}

// ── Schema bootstrap ─────────────────────────────────────────────────────────

export function ensureEvaluatorResultsTable(): void {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS evaluator_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scan_id TEXT NOT NULL UNIQUE,
      project_id TEXT NOT NULL DEFAULT '',
      scanned_at TEXT NOT NULL,
      duration_ms INTEGER NOT NULL DEFAULT 0,
      modules_evaluated TEXT NOT NULL DEFAULT '[]',
      failed_modules TEXT NOT NULL DEFAULT '[]',
      total_findings INTEGER NOT NULL DEFAULT 0,
      severity_counts TEXT NOT NULL DEFAULT '{}',
      findings TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_evaluator_results_time ON evaluator_results(scanned_at DESC)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_evaluator_results_project ON evaluator_results(project_id, scanned_at DESC)`);
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function emptyCounts(): SeverityCounts {
  return { critical: 0, high: 0, medium: 0, low: 0 };
}

function countBySeverity(findings: EvalFinding[]): SeverityCounts {
  const counts = emptyCounts();
  for (const f of findings) counts[f.severity]++;
  return counts;
}

function rowToScan(row: Record<string, unknown>): PersistedScan {
  const scannedAt = row.scanned_at as string;
  return {
    scanId: row.scan_id as string,
    projectId: (row.project_id as string) ?? '',
    scannedAt,
    timestamp: Date.parse(scannedAt),
    durationMs: (row.duration_ms as number) ?? 0,
    modulesEvaluated: safeParseArray(row.modules_evaluated as string),
    failedModules: safeParseArray(row.failed_modules as string),
    totalFindings: (row.total_findings as number) ?? 0,
    severityCounts: safeParseCounts(row.severity_counts as string),
    findings: safeParseFindings(row.findings as string),
  };
}

function safeParseArray(json: string): string[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function safeParseCounts(json: string): SeverityCounts {
  try {
    const v = JSON.parse(json) as Partial<SeverityCounts>;
    return { ...emptyCounts(), ...v };
  } catch {
    return emptyCounts();
  }
}

function safeParseFindings(json: string): EvalFinding[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? (v as EvalFinding[]) : [];
  } catch {
    return [];
  }
}

// ── Record ─────────────────────────────────────────────────────────────────────

/**
 * Persist a completed scan. Idempotent on `scanId`: re-submitting the same scan
 * updates the existing row rather than duplicating it (a callback may fire twice).
 */
export function recordScanResult(input: RecordScanInput): PersistedScan {
  ensureEvaluatorResultsTable();
  const db = getDb();
  const scannedAt = input.scannedAt ?? new Date().toISOString();
  const severityCounts = countBySeverity(input.findings);
  db.prepare(
    `INSERT INTO evaluator_results
       (scan_id, project_id, scanned_at, duration_ms, modules_evaluated,
        failed_modules, total_findings, severity_counts, findings)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(scan_id) DO UPDATE SET
       project_id = excluded.project_id,
       scanned_at = excluded.scanned_at,
       duration_ms = excluded.duration_ms,
       modules_evaluated = excluded.modules_evaluated,
       failed_modules = excluded.failed_modules,
       total_findings = excluded.total_findings,
       severity_counts = excluded.severity_counts,
       findings = excluded.findings`,
  ).run(
    input.scanId,
    input.projectId ?? '',
    scannedAt,
    input.durationMs ?? 0,
    JSON.stringify(input.modulesEvaluated),
    JSON.stringify(input.failedModules ?? []),
    input.findings.length,
    JSON.stringify(severityCounts),
    JSON.stringify(input.findings),
  );
  const row = db.prepare('SELECT * FROM evaluator_results WHERE scan_id = ?').get(input.scanId) as Record<string, unknown>;
  return rowToScan(row);
}

// ── Query ──────────────────────────────────────────────────────────────────────

/** Scan history, newest first. Optionally scoped to a project. */
export function getScanHistory(limit = 50, projectId?: string): PersistedScan[] {
  ensureEvaluatorResultsTable();
  const db = getDb();
  const rows = (projectId
    ? db
        .prepare('SELECT * FROM evaluator_results WHERE project_id = ? ORDER BY scanned_at DESC, id DESC LIMIT ?')
        .all(projectId, limit)
    : db.prepare('SELECT * FROM evaluator_results ORDER BY scanned_at DESC, id DESC LIMIT ?').all(limit)) as Record<
    string,
    unknown
  >[];
  return rows.map(rowToScan);
}

/** The most recent scan (baseline hydration source), or null if none. */
export function getLatestScan(projectId?: string): PersistedScan | null {
  const [latest] = getScanHistory(1, projectId);
  return latest ?? null;
}
