/**
 * Harness run history — persistent per-run snapshots so the user can compare
 * builder runs over time (pass-rate, cost, duration, area regressions).
 *
 * Rows live in `harness_runs` alongside the rest of `~/.pof/pof.db`. Each row
 * is one orchestrator run identified by a `runId` (the orchestrator picks one
 * at start). `status` advances `running` → `completed | paused | error`.
 */

import { getDb } from '@/lib/db';
import type {
  GameBuildGuide,
  GamePlan,
  HarnessCostTotals,
  ProgressEntry,
} from '@/lib/harness/types';

export type HarnessRunStatus = 'running' | 'completed' | 'paused' | 'error';

export interface HarnessRunRow {
  runId: string;
  projectName: string;
  projectPath: string;
  status: HarnessRunStatus;
  startedAt: string;
  endedAt: string | null;
  durationMs: number | null;
  iteration: number;
  totalFeatures: number;
  passingFeatures: number;
  passRate: number; // 0-100
  totalAreas: number;
  completedAreas: number;
  failedAreas: number;
  spentUsd: number;
  budgetUsd: number | null;
  sessions: number;
  themeDirective: string | null;
  errorMessage: string | null;
  /** JSON-encoded full GamePlan snapshot (final) */
  planJson: string;
  /** JSON-encoded full ProgressEntry[] snapshot (final) */
  progressJson: string;
  /** JSON-encoded GameBuildGuide snapshot (may be null if never generated) */
  guideJson: string | null;
  /** JSON-encoded HarnessCostTotals snapshot */
  costJson: string;
}

export interface HarnessRunSummary {
  runId: string;
  projectName: string;
  projectPath: string;
  status: HarnessRunStatus;
  startedAt: string;
  endedAt: string | null;
  durationMs: number | null;
  iteration: number;
  totalFeatures: number;
  passingFeatures: number;
  passRate: number;
  totalAreas: number;
  completedAreas: number;
  failedAreas: number;
  spentUsd: number;
  budgetUsd: number | null;
  sessions: number;
  themeDirective: string | null;
  errorMessage: string | null;
}

export interface HarnessRunDetail extends HarnessRunSummary {
  plan: GamePlan | null;
  progress: ProgressEntry[];
  guide: GameBuildGuide | null;
  cost: HarnessCostTotals | null;
}

function ensureTable(): void {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS harness_runs (
      run_id TEXT PRIMARY KEY,
      project_name TEXT NOT NULL,
      project_path TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('running','completed','paused','error')),
      started_at TEXT NOT NULL,
      ended_at TEXT,
      duration_ms INTEGER,
      iteration INTEGER NOT NULL DEFAULT 0,
      total_features INTEGER NOT NULL DEFAULT 0,
      passing_features INTEGER NOT NULL DEFAULT 0,
      pass_rate REAL NOT NULL DEFAULT 0,
      total_areas INTEGER NOT NULL DEFAULT 0,
      completed_areas INTEGER NOT NULL DEFAULT 0,
      failed_areas INTEGER NOT NULL DEFAULT 0,
      spent_usd REAL NOT NULL DEFAULT 0,
      budget_usd REAL,
      sessions INTEGER NOT NULL DEFAULT 0,
      theme_directive TEXT,
      error_message TEXT,
      plan_json TEXT NOT NULL DEFAULT '{}',
      progress_json TEXT NOT NULL DEFAULT '[]',
      guide_json TEXT,
      cost_json TEXT NOT NULL DEFAULT '{}'
    )
  `);
  getDb().exec(`
    CREATE INDEX IF NOT EXISTS idx_harness_runs_started
    ON harness_runs(started_at DESC)
  `);
  getDb().exec(`
    CREATE INDEX IF NOT EXISTS idx_harness_runs_project
    ON harness_runs(project_path, started_at DESC)
  `);
}

function deriveStats(plan: GamePlan | null, cost: HarnessCostTotals | null) {
  const totalFeatures = plan?.totalFeatures ?? 0;
  const passingFeatures = plan?.passingFeatures ?? 0;
  const passRate = totalFeatures > 0 ? (passingFeatures / totalFeatures) * 100 : 0;
  const totalAreas = plan?.areas.length ?? 0;
  const completedAreas = plan?.areas.filter((a) => a.status === 'completed').length ?? 0;
  const failedAreas = plan?.areas.filter((a) => a.status === 'failed').length ?? 0;
  return {
    iteration: plan?.iteration ?? 0,
    totalFeatures,
    passingFeatures,
    passRate,
    totalAreas,
    completedAreas,
    failedAreas,
    spentUsd: cost?.spentUsd ?? 0,
    budgetUsd: cost?.budgetUsd ?? null,
    sessions: cost?.sessions ?? 0,
  };
}

export interface RunStartInput {
  runId: string;
  projectName: string;
  projectPath: string;
  startedAt: string;
  themeDirective?: string | null;
  plan: GamePlan | null;
  cost: HarnessCostTotals | null;
}

/** Insert a fresh row in `running` state at orchestrator start. */
export function startRun(input: RunStartInput): void {
  ensureTable();
  const s = deriveStats(input.plan, input.cost);
  getDb().prepare(`
    INSERT INTO harness_runs (
      run_id, project_name, project_path, status, started_at,
      iteration, total_features, passing_features, pass_rate,
      total_areas, completed_areas, failed_areas,
      spent_usd, budget_usd, sessions,
      theme_directive,
      plan_json, progress_json, guide_json, cost_json
    ) VALUES (
      @run_id, @project_name, @project_path, 'running', @started_at,
      @iteration, @total_features, @passing_features, @pass_rate,
      @total_areas, @completed_areas, @failed_areas,
      @spent_usd, @budget_usd, @sessions,
      @theme_directive,
      @plan_json, '[]', NULL, @cost_json
    )
  `).run({
    run_id: input.runId,
    project_name: input.projectName,
    project_path: input.projectPath,
    started_at: input.startedAt,
    iteration: s.iteration,
    total_features: s.totalFeatures,
    passing_features: s.passingFeatures,
    pass_rate: s.passRate,
    total_areas: s.totalAreas,
    completed_areas: s.completedAreas,
    failed_areas: s.failedAreas,
    spent_usd: s.spentUsd,
    budget_usd: s.budgetUsd,
    sessions: s.sessions,
    theme_directive: input.themeDirective ?? null,
    plan_json: JSON.stringify(input.plan ?? {}),
    cost_json: JSON.stringify(input.cost ?? {}),
  });
}

export interface RunFinalizeInput {
  runId: string;
  status: HarnessRunStatus;
  endedAt: string;
  plan: GamePlan | null;
  progress: ProgressEntry[];
  guide: GameBuildGuide | null;
  cost: HarnessCostTotals | null;
  errorMessage?: string | null;
}

/**
 * Snapshot final plan/progress/guide/cost and mark the run terminal. Idempotent
 * for the same `runId` — the latest call wins so a paused→resume that then
 * completes overwrites the paused snapshot.
 */
export function finalizeRun(input: RunFinalizeInput): void {
  ensureTable();
  const s = deriveStats(input.plan, input.cost);
  const row = getDb()
    .prepare('SELECT started_at FROM harness_runs WHERE run_id = ?')
    .get(input.runId) as { started_at?: string } | undefined;
  const startedAt = row?.started_at ? Date.parse(row.started_at) : NaN;
  const endedAtMs = Date.parse(input.endedAt);
  const durationMs = Number.isFinite(startedAt) && Number.isFinite(endedAtMs)
    ? Math.max(0, endedAtMs - startedAt)
    : null;

  getDb().prepare(`
    UPDATE harness_runs SET
      status = @status,
      ended_at = @ended_at,
      duration_ms = @duration_ms,
      iteration = @iteration,
      total_features = @total_features,
      passing_features = @passing_features,
      pass_rate = @pass_rate,
      total_areas = @total_areas,
      completed_areas = @completed_areas,
      failed_areas = @failed_areas,
      spent_usd = @spent_usd,
      budget_usd = @budget_usd,
      sessions = @sessions,
      error_message = @error_message,
      plan_json = @plan_json,
      progress_json = @progress_json,
      guide_json = @guide_json,
      cost_json = @cost_json
    WHERE run_id = @run_id
  `).run({
    run_id: input.runId,
    status: input.status,
    ended_at: input.endedAt,
    duration_ms: durationMs,
    iteration: s.iteration,
    total_features: s.totalFeatures,
    passing_features: s.passingFeatures,
    pass_rate: s.passRate,
    total_areas: s.totalAreas,
    completed_areas: s.completedAreas,
    failed_areas: s.failedAreas,
    spent_usd: s.spentUsd,
    budget_usd: s.budgetUsd,
    sessions: s.sessions,
    error_message: input.errorMessage ?? null,
    plan_json: JSON.stringify(input.plan ?? {}),
    progress_json: JSON.stringify(input.progress),
    guide_json: input.guide ? JSON.stringify(input.guide) : null,
    cost_json: JSON.stringify(input.cost ?? {}),
  });
}

function rowToSummary(row: Record<string, unknown>): HarnessRunSummary {
  return {
    runId: row.run_id as string,
    projectName: row.project_name as string,
    projectPath: row.project_path as string,
    status: row.status as HarnessRunStatus,
    startedAt: row.started_at as string,
    endedAt: (row.ended_at as string | null) ?? null,
    durationMs: (row.duration_ms as number | null) ?? null,
    iteration: (row.iteration as number) ?? 0,
    totalFeatures: (row.total_features as number) ?? 0,
    passingFeatures: (row.passing_features as number) ?? 0,
    passRate: (row.pass_rate as number) ?? 0,
    totalAreas: (row.total_areas as number) ?? 0,
    completedAreas: (row.completed_areas as number) ?? 0,
    failedAreas: (row.failed_areas as number) ?? 0,
    spentUsd: (row.spent_usd as number) ?? 0,
    budgetUsd: (row.budget_usd as number | null) ?? null,
    sessions: (row.sessions as number) ?? 0,
    themeDirective: (row.theme_directive as string | null) ?? null,
    errorMessage: (row.error_message as string | null) ?? null,
  };
}

function safeParse<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try { return JSON.parse(s) as T; } catch { return fallback; }
}

function rowToDetail(row: Record<string, unknown>): HarnessRunDetail {
  const summary = rowToSummary(row);
  return {
    ...summary,
    plan: safeParse<GamePlan | null>(row.plan_json as string, null),
    progress: safeParse<ProgressEntry[]>(row.progress_json as string, []),
    guide: safeParse<GameBuildGuide | null>(row.guide_json as string | null, null),
    cost: safeParse<HarnessCostTotals | null>(row.cost_json as string, null),
  };
}

export function listRuns(opts: { limit?: number; projectPath?: string } = {}): HarnessRunSummary[] {
  ensureTable();
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 500);
  const sql = opts.projectPath
    ? `SELECT run_id, project_name, project_path, status, started_at, ended_at, duration_ms,
              iteration, total_features, passing_features, pass_rate,
              total_areas, completed_areas, failed_areas,
              spent_usd, budget_usd, sessions, theme_directive, error_message
       FROM harness_runs WHERE project_path = ? ORDER BY started_at DESC LIMIT ?`
    : `SELECT run_id, project_name, project_path, status, started_at, ended_at, duration_ms,
              iteration, total_features, passing_features, pass_rate,
              total_areas, completed_areas, failed_areas,
              spent_usd, budget_usd, sessions, theme_directive, error_message
       FROM harness_runs ORDER BY started_at DESC LIMIT ?`;
  const args = opts.projectPath ? [opts.projectPath, limit] : [limit];
  const rows = getDb().prepare(sql).all(...args) as Record<string, unknown>[];
  return rows.map(rowToSummary);
}

export function getRun(runId: string): HarnessRunDetail | null {
  ensureTable();
  const row = getDb()
    .prepare('SELECT * FROM harness_runs WHERE run_id = ?')
    .get(runId) as Record<string, unknown> | undefined;
  return row ? rowToDetail(row) : null;
}

export function deleteRun(runId: string): boolean {
  ensureTable();
  const info = getDb().prepare('DELETE FROM harness_runs WHERE run_id = ?').run(runId);
  return info.changes > 0;
}
