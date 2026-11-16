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
import { isEvalPass } from './module-eval-prompts';
import type { PassOutcome } from './deep-eval-engine';

let ensured = false;

const TABLE_DDL = (name: string): string => `
    CREATE TABLE IF NOT EXISTS ${name} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scan_id TEXT NOT NULL,
      project_id TEXT NOT NULL DEFAULT '',
      module_id TEXT NOT NULL,
      pass TEXT NOT NULL,
      status TEXT NOT NULL,
      error TEXT,
      findings_json TEXT NOT NULL DEFAULT '[]',
      finished_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (scan_id, project_id, module_id, pass)
    )
  `;

/** The pre-project-key shape: a second project reusing a scanId overwrote the first's rows. */
const LEGACY_UNIQUE = /UNIQUE\s*\(\s*scan_id\s*,\s*module_id\s*,\s*pass\s*\)/i;

function ensureTable(): void {
  if (ensured) return;
  const db = getDb();
  db.exec(TABLE_DDL('deep_eval_passes'));
  const row = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='deep_eval_passes'").get() as
    { sql: string } | undefined;
  if (row && LEGACY_UNIQUE.test(row.sql)) {
    // Table rebuild (SQLite cannot alter a UNIQUE): copy every row, swap, abort if any row would be lost.
    db.transaction(() => {
      db.exec('DROP TABLE IF EXISTS deep_eval_passes__rebuild');
      db.exec(TABLE_DDL('deep_eval_passes__rebuild'));
      db.exec(`INSERT INTO deep_eval_passes__rebuild (id, scan_id, project_id, module_id, pass, status, error, findings_json, finished_at)
               SELECT id, scan_id, project_id, module_id, pass, status, error, findings_json, finished_at FROM deep_eval_passes`);
      const before = (db.prepare('SELECT COUNT(*) AS n FROM deep_eval_passes').get() as { n: number }).n;
      const after = (db.prepare('SELECT COUNT(*) AS n FROM deep_eval_passes__rebuild').get() as { n: number }).n;
      if (before !== after) throw new Error(`deep_eval_passes rebuild would lose rows (${before} -> ${after}) - aborted`);
      db.exec('DROP TABLE deep_eval_passes');
      db.exec('ALTER TABLE deep_eval_passes__rebuild RENAME TO deep_eval_passes');
    })();
  }
  ensured = true;
}

/** Persist one finished pass. A re-run of the same cell replaces its row. */
export function recordPassOutcome(scanId: string, projectId: string, outcome: PassOutcome): void {
  ensureTable();
  getDb().prepare(`
    INSERT INTO deep_eval_passes (scan_id, project_id, module_id, pass, status, error, findings_json)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (scan_id, project_id, module_id, pass) DO UPDATE SET
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

/**
 * Every recorded pass of a scan, in the order they finished. With `projectId`, only the
 * rows recorded for that project: a resume must never replay one project's findings
 * into another's scan (the same rule as the client baseline's `baselineFor`).
 */
export function readPassLedger(scanId: string, projectId?: string): PassOutcome[] {
  ensureTable();
  const rows = (projectId === undefined
    ? getDb()
      .prepare('SELECT module_id, pass, status, error, findings_json FROM deep_eval_passes WHERE scan_id = ? ORDER BY id')
      .all(scanId)
    : getDb()
      .prepare('SELECT module_id, pass, status, error, findings_json FROM deep_eval_passes WHERE scan_id = ? AND project_id = ? ORDER BY id')
      .all(scanId, projectId)) as PassRow[];
  const out: PassOutcome[] = [];
  for (const r of rows) {
    // A pass outside the vocabulary can never match a cell of this run: not read.
    if (!isEvalPass(r.pass)) continue;
    const findings = parseFindingsJson(r.findings_json);
    if (findings === null) {
      // A resumed run REPLAYS a done row's findings into its dedup, which throws on a
      // non-finding. Unreadable findings are unmeasured: read as error, re-run on resume.
      out.push({ moduleId: r.module_id, pass: r.pass, status: 'error', error: 'unreadable ledger findings', findings: [] });
      continue;
    }
    out.push({
      moduleId: r.module_id,
      pass: r.pass,
      status: r.status === 'done' ? 'done' : 'error',
      error: r.error,
      findings,
    });
  }
  return out;
}

/** The fields the engine's dedup/aggregate read off every replayed finding. */
function isReplayableFinding(v: unknown): v is EvalFinding {
  if (typeof v !== 'object' || v === null) return false;
  const f = v as Record<string, unknown>;
  return typeof f.id === 'string'
    && typeof f.moduleId === 'string'
    && typeof f.description === 'string'
    && typeof f.category === 'string'
    && typeof f.severity === 'string'
    && (f.file === null || typeof f.file === 'string')
    && (f.line === null || typeof f.line === 'number');
}

/** The recorded findings, or null when the column is not an array of findings. */
function parseFindingsJson(json: string): EvalFinding[] | null {
  try {
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed) && parsed.every(isReplayableFinding) ? parsed : null;
  } catch {
    return null;
  }
}
