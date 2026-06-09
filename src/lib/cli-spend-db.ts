/**
 * CLI cost & token spend persistence.
 *
 * Every Claude Code CLI run emits a token/cost result event. This module records
 * one row per run and serves the rollups (per module, per task type, per day),
 * the daily/monthly budget guard, and the per-task-type cost estimate the
 * pre-flight guardrail reads. Single SQLite instance via {@link getDb}; tables
 * are created lazily on first use (matching the other *-db.ts modules).
 */

import { getDb } from './db';
import type {
  SpendRecord,
  SpendGroupStat,
  DailySpend,
  BudgetConfig,
  BudgetStatus,
  SpendDashboard,
  TaskTypeEstimate,
} from '@/types/cli-spend';

// ── Schema bootstrap ─────────────────────────────────────────────────────────

export function ensureCliSpendTables(): void {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS cli_spend (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      module_id TEXT NOT NULL DEFAULT 'unknown',
      task_type TEXT NOT NULL DEFAULT 'interactive',
      task_label TEXT,
      session_key TEXT,
      cost_usd REAL NOT NULL DEFAULT 0,
      tokens_in INTEGER NOT NULL DEFAULT 0,
      tokens_out INTEGER NOT NULL DEFAULT 0,
      cache_read_tokens INTEGER NOT NULL DEFAULT 0,
      cache_creation_tokens INTEGER NOT NULL DEFAULT 0,
      duration_ms INTEGER NOT NULL DEFAULT 0,
      success INTEGER NOT NULL DEFAULT 1,
      recorded_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_cli_spend_module ON cli_spend(module_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_cli_spend_task_type ON cli_spend(task_type)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_cli_spend_recorded ON cli_spend(recorded_at)`);
  db.exec(`
    CREATE TABLE IF NOT EXISTS cli_spend_budget (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      daily_limit_usd REAL,
      monthly_limit_usd REAL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

// ── Row mapping ──────────────────────────────────────────────────────────────

function rowToRecord(row: Record<string, unknown>): SpendRecord {
  return {
    id: row.id as number,
    moduleId: row.module_id as string,
    taskType: row.task_type as string,
    taskLabel: (row.task_label as string | null) ?? null,
    sessionKey: (row.session_key as string | null) ?? null,
    costUsd: row.cost_usd as number,
    tokensIn: row.tokens_in as number,
    tokensOut: row.tokens_out as number,
    cacheReadTokens: row.cache_read_tokens as number,
    cacheCreationTokens: row.cache_creation_tokens as number,
    durationMs: row.duration_ms as number,
    success: (row.success as number) === 1,
    recordedAt: row.recorded_at as string,
  };
}

// ── Record ───────────────────────────────────────────────────────────────────

export interface RecordSpendInput {
  moduleId?: string;
  taskType?: string;
  taskLabel?: string | null;
  sessionKey?: string | null;
  costUsd: number;
  tokensIn: number;
  tokensOut: number;
  cacheReadTokens?: number;
  cacheCreationTokens?: number;
  durationMs?: number;
  success?: boolean;
  /** ISO timestamp; defaults to now. */
  recordedAt?: string;
}

export function recordSpend(input: RecordSpendInput): SpendRecord {
  ensureCliSpendTables();
  const db = getDb();
  const recordedAt = input.recordedAt ?? new Date().toISOString();
  const info = db
    .prepare(
      `INSERT INTO cli_spend
        (module_id, task_type, task_label, session_key, cost_usd, tokens_in, tokens_out,
         cache_read_tokens, cache_creation_tokens, duration_ms, success, recorded_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.moduleId ?? 'unknown',
      input.taskType ?? 'interactive',
      input.taskLabel ?? null,
      input.sessionKey ?? null,
      input.costUsd,
      input.tokensIn,
      input.tokensOut,
      input.cacheReadTokens ?? 0,
      input.cacheCreationTokens ?? 0,
      input.durationMs ?? 0,
      input.success === false ? 0 : 1,
      recordedAt,
    );
  const row = db.prepare('SELECT * FROM cli_spend WHERE id = ?').get(info.lastInsertRowid) as Record<string, unknown>;
  return rowToRecord(row);
}

// ── Budget config ──────────────────────────────────────────────────────────────

export function getBudgetConfig(): BudgetConfig {
  ensureCliSpendTables();
  const row = getDb().prepare('SELECT * FROM cli_spend_budget WHERE id = 1').get() as
    | Record<string, unknown>
    | undefined;
  return {
    dailyLimitUsd: (row?.daily_limit_usd as number | null) ?? null,
    monthlyLimitUsd: (row?.monthly_limit_usd as number | null) ?? null,
  };
}

export function setBudgetConfig(config: BudgetConfig): BudgetConfig {
  ensureCliSpendTables();
  getDb()
    .prepare(
      `INSERT INTO cli_spend_budget (id, daily_limit_usd, monthly_limit_usd, updated_at)
       VALUES (1, ?, ?, datetime('now'))
       ON CONFLICT(id) DO UPDATE SET
         daily_limit_usd = excluded.daily_limit_usd,
         monthly_limit_usd = excluded.monthly_limit_usd,
         updated_at = excluded.updated_at`,
    )
    .run(config.dailyLimitUsd, config.monthlyLimitUsd);
  return getBudgetConfig();
}

// ── Aggregation helpers ──────────────────────────────────────────────────────

/** Sum of cost where the recorded_at date prefix matches (UTC). */
function sumCostForPrefix(prefix: string, len: number): number {
  const row = getDb()
    .prepare(`SELECT COALESCE(SUM(cost_usd), 0) AS c FROM cli_spend WHERE substr(recorded_at, 1, ?) = ?`)
    .get(len, prefix) as { c: number };
  return row.c;
}

export function getBudgetStatus(): BudgetStatus {
  ensureCliSpendTables();
  const config = getBudgetConfig();
  const nowIso = new Date().toISOString();
  const today = nowIso.slice(0, 10); // YYYY-MM-DD
  const month = nowIso.slice(0, 7); // YYYY-MM

  const todaySpendUsd = sumCostForPrefix(today, 10);
  const monthSpendUsd = sumCostForPrefix(month, 7);

  const dailyRemainingUsd = config.dailyLimitUsd != null ? config.dailyLimitUsd - todaySpendUsd : null;
  const monthlyRemainingUsd = config.monthlyLimitUsd != null ? config.monthlyLimitUsd - monthSpendUsd : null;
  const dailyPct =
    config.dailyLimitUsd != null && config.dailyLimitUsd > 0 ? (todaySpendUsd / config.dailyLimitUsd) * 100 : null;
  const monthlyPct =
    config.monthlyLimitUsd != null && config.monthlyLimitUsd > 0
      ? (monthSpendUsd / config.monthlyLimitUsd) * 100
      : null;

  return {
    config,
    todaySpendUsd,
    monthSpendUsd,
    dailyRemainingUsd,
    monthlyRemainingUsd,
    dailyPct,
    monthlyPct,
    dailyExceeded: dailyRemainingUsd != null && dailyRemainingUsd < 0,
    monthlyExceeded: monthlyRemainingUsd != null && monthlyRemainingUsd < 0,
  };
}

interface RawGroupRow {
  key: string;
  runs: number;
  cost: number;
  ti: number;
  to_: number;
  succ: number;
}

function rowToGroup(r: RawGroupRow): SpendGroupStat {
  return {
    key: r.key,
    runs: r.runs,
    costUsd: r.cost,
    tokensIn: r.ti,
    tokensOut: r.to_,
    successCount: r.succ,
    avgCostUsd: r.runs > 0 ? r.cost / r.runs : 0,
  };
}

function groupBy(column: 'module_id' | 'task_type'): SpendGroupStat[] {
  const rows = getDb()
    .prepare(
      `SELECT ${column} AS key, COUNT(*) AS runs, COALESCE(SUM(cost_usd),0) AS cost,
              COALESCE(SUM(tokens_in),0) AS ti, COALESCE(SUM(tokens_out),0) AS to_,
              COALESCE(SUM(success),0) AS succ
       FROM cli_spend GROUP BY ${column} ORDER BY cost DESC`,
    )
    .all() as RawGroupRow[];
  return rows.map(rowToGroup);
}

export function getRecentSpend(limit = 20): SpendRecord[] {
  ensureCliSpendTables();
  const rows = getDb()
    .prepare('SELECT * FROM cli_spend ORDER BY id DESC LIMIT ?')
    .all(limit) as Record<string, unknown>[];
  return rows.map(rowToRecord);
}

function getDailySpend(days = 30): DailySpend[] {
  const rows = getDb()
    .prepare(
      `SELECT substr(recorded_at,1,10) AS day, COALESCE(SUM(cost_usd),0) AS cost,
              COALESCE(SUM(tokens_in),0) AS ti, COALESCE(SUM(tokens_out),0) AS to_, COUNT(*) AS runs
       FROM cli_spend GROUP BY day ORDER BY day DESC LIMIT ?`,
    )
    .all(days) as { day: string; cost: number; ti: number; to_: number; runs: number }[];
  // Query is newest-first for the LIMIT; present chronological.
  return rows
    .map((r) => ({ day: r.day, costUsd: r.cost, tokensIn: r.ti, tokensOut: r.to_, runs: r.runs }))
    .reverse();
}

/** Historical average cost for one task type — feeds the pre-flight guardrail. */
export function getTaskTypeEstimate(taskType: string): TaskTypeEstimate | null {
  ensureCliSpendTables();
  const row = getDb()
    .prepare(
      `SELECT COALESCE(AVG(cost_usd),0) AS avg, COUNT(*) AS runs
       FROM cli_spend WHERE task_type = ? AND cost_usd > 0`,
    )
    .get(taskType) as { avg: number; runs: number };
  if (!row || row.runs === 0) return null;
  return { avgCostUsd: row.avg, runs: row.runs };
}

// ── Full dashboard ─────────────────────────────────────────────────────────────

export function getSpendDashboard(): SpendDashboard {
  ensureCliSpendTables();
  const totals = getDb()
    .prepare(
      `SELECT COUNT(*) AS runs, COALESCE(SUM(cost_usd),0) AS cost,
              COALESCE(SUM(tokens_in),0) AS ti, COALESCE(SUM(tokens_out),0) AS to_
       FROM cli_spend`,
    )
    .get() as { runs: number; cost: number; ti: number; to_: number };

  return {
    totalRuns: totals.runs,
    totalCostUsd: totals.cost,
    totalTokensIn: totals.ti,
    totalTokensOut: totals.to_,
    byModule: groupBy('module_id'),
    byTaskType: groupBy('task_type'),
    daily: getDailySpend(30),
    recent: getRecentSpend(20),
    budget: getBudgetStatus(),
  };
}
