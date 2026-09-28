/**
 * Deep-eval pass ledger: one row per finished (scan, module, pass).
 *
 * The server deep-eval job (`deep-eval-job.ts`) writes a row the moment each pass
 * ends, done or error, so a 30-60 minute scan keeps every pass it finished even if
 * the process dies mid-run, and a job started again with the same `scanId` skips the
 * passes already recorded as `done` (errors are re-run).
 *
 * Additive table (`deep_eval_passes`), created lazily like the other *-db modules.
 * Nothing outside the job reads it; the completed scan still lands in
 * `evaluator_results` through `/api/evaluator/results`. Server-only.
 */

import { getDb } from '@/lib/db';
import type { EvalFinding } from './finding-collector';
import type { EvalPass } from './module-eval-prompts';
import type { PassOutcome } from './deep-eval-engine';

let ensured = false;

function ensureTable(): void {
  if (ensured) return;
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS deep_eval_passes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scan_id TEXT NOT NULL,
      project_id TEXT NOT NULL DEFAULT '',
      module_id TEXT NOT NULL,
      pass TEXT NOT NULL,
      status TEXT NOT NULL,
      error TEXT,
      findings_json TEXT NOT NULL DEFAULT '[]',
      finished_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (scan_id, module_id, pass)
    )
  `);
  ensured = true;
}

/** Persist one finished pass. A re-run of the same cell replaces its row. */
export function recordPassOutcome(scanId: string, projectId: string, outcome: PassOutcome): void {
  ensureTable();
  getDb().prepare(`
    INSERT INTO deep_eval_passes (scan_id, project_id, module_id, pass, status, error, findings_json)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (scan_id, module_id, pass) DO UPDATE SET
      status = excluded.status,
      error = excluded.error,
      findings_json = excluded.findings_json,
      finished_at = datetime('now')
  `).run(scanId, projectId, outcome.moduleId, outcome.pass, outcome.status, outcome.error, JSON.stringify(outcome.findings));
}

interface PassRow {
  module_id: string;
  pass: string;
  status: string;
  error: string | null;
  findings_json: string;
}

/** Every recorded pass of a scan, in the order they finished. */
export function readPassLedger(scanId: string): PassOutcome[] {
  ensureTable();
  const rows = getDb()
    .prepare('SELECT module_id, pass, status, error, findings_json FROM deep_eval_passes WHERE scan_id = ? ORDER BY id')
    .all(scanId) as PassRow[];
  return rows.map((r) => ({
    moduleId: r.module_id,
    pass: r.pass as EvalPass,
    status: r.status === 'done' ? 'done' : 'error',
    error: r.error,
    findings: parseFindingsJson(r.findings_json),
  }));
}

function parseFindingsJson(json: string): EvalFinding[] {
  try {
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed) ? (parsed as EvalFinding[]) : [];
  } catch {
    return [];
  }
}
