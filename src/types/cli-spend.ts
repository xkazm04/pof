/**
 * Types for the CLI cost & token spend dashboard.
 *
 * Every Claude Code CLI run emits a token/cost `result` event. These types model
 * the persisted per-run spend records plus the rollups (per module, per task
 * type, per day) and the daily/monthly budget guard surfaced by the dashboard.
 */

/** One persisted spend record — a single CLI run. */
export interface SpendRecord {
  id: number;
  /** Sub-module the run was launched from (or 'unknown'). */
  moduleId: string;
  /** CLITaskType (or 'interactive' for free-typed terminal prompts). */
  taskType: string;
  /** Human-readable task label, when known. */
  taskLabel: string | null;
  /** Terminal session key, when known. */
  sessionKey: string | null;
  costUsd: number;
  tokensIn: number;
  tokensOut: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  durationMs: number;
  success: boolean;
  /** ISO timestamp the run completed. */
  recordedAt: string;
}

/** Aggregate stats for one rollup key (a module id or a task type). */
export interface SpendGroupStat {
  key: string;
  runs: number;
  costUsd: number;
  tokensIn: number;
  tokensOut: number;
  successCount: number;
  /** Mean cost per run. */
  avgCostUsd: number;
}

/** One day's spend, for the trend chart. */
export interface DailySpend {
  /** YYYY-MM-DD (UTC). */
  day: string;
  costUsd: number;
  tokensIn: number;
  tokensOut: number;
  runs: number;
}

/** Editable daily/monthly budget limits. `null` = no limit. */
export interface BudgetConfig {
  dailyLimitUsd: number | null;
  monthlyLimitUsd: number | null;
}

/** Budget config + the live spend-against-budget meter. */
export interface BudgetStatus {
  config: BudgetConfig;
  todaySpendUsd: number;
  monthSpendUsd: number;
  /** limit − spend (clamped only at display time); null when no limit set. */
  dailyRemainingUsd: number | null;
  monthlyRemainingUsd: number | null;
  /** spend / limit × 100; null when no limit set. */
  dailyPct: number | null;
  monthlyPct: number | null;
  dailyExceeded: boolean;
  monthlyExceeded: boolean;
}

/** The full spend dashboard payload. */
export interface SpendDashboard {
  totalRuns: number;
  totalCostUsd: number;
  totalTokensIn: number;
  totalTokensOut: number;
  byModule: SpendGroupStat[];
  byTaskType: SpendGroupStat[];
  /** Up to the last 30 days, chronological. */
  daily: DailySpend[];
  /** Most recent runs, newest first. */
  recent: SpendRecord[];
  budget: BudgetStatus;
}

/** Historical cost estimate for one task type (for the pre-flight guardrail). */
export interface TaskTypeEstimate {
  avgCostUsd: number;
  runs: number;
}
