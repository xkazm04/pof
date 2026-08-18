/**
 * The shared ledger columns behind `procgen_runs` and `scatter_runs`.
 *
 * Both tables recorded a count + a seed and nothing else, and only the newest
 * row was ever queryable. So the seed behind a good map was unrecoverable one
 * re-roll later, a run could not be tied to the design document it was generated
 * for, and a FAILED run left no trace whatsoever — it simply never POSTed.
 *
 * The migration here is strictly ADDITIVE (guarded `ALTER TABLE … ADD COLUMN`),
 * so every existing row survives and `getLatest*Run` consumers keep working; a
 * legacy row just reports empty provenance rather than inventing any.
 */

import type { Database } from 'better-sqlite3';
import type { GenerationRunBase } from '@/types/procgen';
import { ok, err, type Result } from '@/types/result';

/** Additive columns, `name → DDL`. Applied to both run tables. */
const LEDGER_COLUMNS: ReadonlyArray<readonly [string, string]> = [
  ['algorithm', "algorithm TEXT NOT NULL DEFAULT ''"],
  ['params', "params TEXT NOT NULL DEFAULT '{}'"],
  ['doc_id', 'doc_id INTEGER'],
  ['map_path', "map_path TEXT NOT NULL DEFAULT ''"],
  ['success', 'success INTEGER NOT NULL DEFAULT 1'],
  ['failure_reason', "failure_reason TEXT NOT NULL DEFAULT ''"],
];

/** Add any ledger column the table is missing. Safe to call on every access. */
export function ensureLedgerColumns(db: Database, table: string): void {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  const have = new Set(cols.map((c) => c.name));
  for (const [name, ddl] of LEDGER_COLUMNS) {
    if (!have.has(name)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }
}

/**
 * Parse the stored params blob. A damaged blob degrades to `{}` — one bad row
 * must not take down the whole history the panels read.
 */
function parseParams(raw: unknown): Record<string, unknown> {
  if (typeof raw !== 'string' || !raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

/** Map the shared ledger columns of one row. */
export function readLedger(row: Record<string, unknown>): GenerationRunBase {
  return {
    id: row.id as number,
    seed: row.seed as number,
    algorithm: (row.algorithm as string) ?? '',
    params: parseParams(row.params),
    docId: typeof row.doc_id === 'number' ? row.doc_id : null,
    mapPath: (row.map_path as string) ?? '',
    // Legacy rows predate the column and its DEFAULT 1 — they were successes.
    success: row.success === undefined || row.success === null ? true : Number(row.success) === 1,
    failureReason: (row.failure_reason as string) ?? '',
    createdAt: row.created_at as string,
  };
}

/** Everything a caller may record about a run beyond its count. */
export interface LedgerInput {
  seed: number;
  algorithm?: string;
  params?: Record<string, unknown>;
  docId?: number | null;
  mapPath?: string;
  success?: boolean;
  failureReason?: string;
}

/** The shared column names + bound values for an INSERT, in matching order. */
export function ledgerInsert(input: LedgerInput): { columns: string[]; values: unknown[] } {
  const success = input.success !== false;
  return {
    columns: ['seed', 'algorithm', 'params', 'doc_id', 'map_path', 'success', 'failure_reason'],
    values: [
      input.seed,
      input.algorithm ?? '',
      JSON.stringify(input.params ?? {}),
      input.docId ?? null,
      input.mapPath ?? '',
      success ? 1 : 0,
      // A success carries no reason; a failure's reason is enforced at the route.
      success ? '' : (input.failureReason ?? ''),
    ],
  };
}

/** How many rows a history query returns by default, and the hard ceiling. */
export const DEFAULT_HISTORY_LIMIT = 20;
export const MAX_HISTORY_LIMIT = 100;

/** Clamp a caller-supplied history limit into [1, MAX_HISTORY_LIMIT]. */
export function clampHistoryLimit(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_HISTORY_LIMIT;
  return Math.min(MAX_HISTORY_LIMIT, Math.floor(n));
}

// ── Submission contract ─────────────────────────────────────────────────────

export interface RunSubmission extends LedgerInput {
  /** Rooms / instances the run reported. 0 for a failure. */
  count: number;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Validate one run-result callback body into a ledger row.
 *
 * The important asymmetry: a run that reports `success: false` does NOT need a
 * count — but it MUST name a reason, because a failure with no reason is the
 * same vanished run the ledger exists to stop. A successful run must report its
 * count, or there is nothing to record.
 */
export function parseRunSubmission(
  body: unknown,
  countField: 'roomCount' | 'instanceCount',
): Result<RunSubmission, string> {
  if (!isRecord(body)) return err('Body must be a JSON object');

  const seed = Number(body.seed);
  if (!Number.isFinite(seed)) return err('seed is required and must be a number');

  const succeeded = body.success !== false;

  let count = 0;
  if (succeeded) {
    const raw = Number(body[countField]);
    if (!Number.isFinite(raw) || raw < 0) {
      return err(`${countField} is required and must be a non-negative number for a successful run`);
    }
    count = Math.floor(raw);
  } else {
    const raw = Number(body[countField]);
    if (Number.isFinite(raw) && raw >= 0) count = Math.floor(raw);
  }

  const failureReason = typeof body.failureReason === 'string' ? body.failureReason.trim() : '';
  if (!succeeded && !failureReason) {
    return err('failureReason is required when success is false — a failed run is recorded WITH its reason, never dropped');
  }

  let docId: number | null = null;
  if (body.docId !== undefined && body.docId !== null && body.docId !== '') {
    const n = Number(body.docId);
    if (!Number.isInteger(n) || n <= 0) return err('docId must be a positive integer when present');
    docId = n;
  }

  return ok({
    count,
    seed,
    algorithm: typeof body.algorithm === 'string' ? body.algorithm : '',
    params: isRecord(body.params) ? body.params : {},
    docId,
    mapPath: typeof body.mapPath === 'string' ? body.mapPath : '',
    success: succeeded,
    failureReason: succeeded ? '' : failureReason,
  });
}
