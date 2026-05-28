/**
 * Build Health & Trend Analytics
 *
 * Turns the raw `headless_builds` history (durations, error/warning counts,
 * status, target) into actionable insight: success rate, duration trend,
 * slowest targets, recurring error fingerprints (joined with the error-memory
 * DB), and — most importantly — regression alerts that flag when build duration
 * or error count spikes versus a rolling baseline, so a slow-creep build
 * problem is caught early.
 *
 * The aggregation + regression logic lives as pure functions over plain build
 * records (unit-tested without a DB); the DB query layer fetches rows and feeds
 * them in.
 */

import { getDb } from '@/lib/db';
import { getAllErrors } from '@/lib/error-memory-db';
import { ensureHeadlessBuildsTable } from '@/lib/ue5-bridge/build-pipeline';
import type { BuildStatus } from '@/types/ue5-bridge';

// ── Types ────────────────────────────────────────────────────────────────────

/** Normalized build record for analytics — the columns trending cares about. */
export interface HealthBuild {
  buildId: string;
  targetName: string;
  configuration: string;
  platform: string;
  status: BuildStatus;
  durationMs: number | null;
  errorCount: number;
  warningCount: number;
  createdAt: string; // ISO timestamp
}

export interface BuildHealthSummary {
  totalBuilds: number;
  successCount: number;
  failedCount: number;
  abortedCount: number;
  /** Percentage 0–100 of builds that succeeded. */
  successRate: number;
  /** Mean duration over successful builds (failed/aborted excluded — unreliable). */
  avgDurationMs: number | null;
  medianDurationMs: number | null;
  totalErrors: number;
  totalWarnings: number;
  avgErrorsPerBuild: number;
}

export interface DurationTrendPoint {
  buildId: string;
  createdAt: string;
  durationMs: number;
  status: BuildStatus;
  errorCount: number;
  warningCount: number;
}

export interface TargetHealth {
  targetName: string;
  builds: number;
  /** Percentage 0–100. */
  successRate: number;
  avgDurationMs: number | null;
  maxDurationMs: number | null;
  /** Status of the most recent build for this target. */
  lastStatus: BuildStatus;
}

export interface RecurringError {
  fingerprint: string;
  pattern: string;
  category: string;
  message: string;
  occurrences: number;
  moduleId: string;
  errorCode: string | null;
  wasResolved: boolean;
  lastSeenAt: string;
}

export interface RegressionAlert {
  kind: 'duration' | 'errors';
  buildId: string;
  createdAt: string;
  /** Current (latest) value — ms for duration, count for errors. */
  current: number;
  /** Rolling-baseline value derived from the preceding builds. */
  baseline: number;
  /** Percentage change vs baseline (rounded). */
  deltaPct: number;
  severity: 'warning' | 'critical';
  message: string;
}

export interface BuildHealthReport {
  summary: BuildHealthSummary;
  durationTrend: DurationTrendPoint[];
  slowestTargets: TargetHealth[];
  recurringErrors: RecurringError[];
  regressions: RegressionAlert[];
  generatedAt: string;
}

/** Tuning knobs for {@link detectRegressions}. */
export interface RegressionConfig {
  /** Number of prior builds that form the rolling baseline. */
  baselineWindow: number;
  /** Minimum prior samples required before a judgment is made. */
  minBaselineSamples: number;
  /** current/baseline duration ratio that triggers a warning (1.3 = 30% slower). */
  durationSpikeFactor: number;
  /** current/baseline duration ratio that escalates to critical. */
  durationCriticalFactor: number;
  /** current − baseline error count that triggers a warning. */
  errorSpikeDelta: number;
  /** current − baseline error count that escalates to critical. */
  errorCriticalDelta: number;
}

export const DEFAULT_REGRESSION_CONFIG: RegressionConfig = {
  baselineWindow: 5,
  minBaselineSamples: 3,
  durationSpikeFactor: 1.3,
  durationCriticalFactor: 1.75,
  errorSpikeDelta: 2,
  errorCriticalDelta: 5,
};

// ── Pure helpers ───────────────────────────────────────────────────────────

function sortChronological(builds: HealthBuild[]): HealthBuild[] {
  return [...builds].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

// ── summarizeBuilds ──────────────────────────────────────────────────────────

export function summarizeBuilds(builds: HealthBuild[]): BuildHealthSummary {
  const total = builds.length;
  const successBuilds = builds.filter((b) => b.status === 'success');
  const successCount = successBuilds.length;
  const failedCount = builds.filter((b) => b.status === 'failed').length;
  const abortedCount = builds.filter((b) => b.status === 'aborted').length;

  const successDurations = successBuilds
    .map((b) => b.durationMs)
    .filter((d): d is number => d != null);

  const totalErrors = builds.reduce((sum, b) => sum + b.errorCount, 0);
  const totalWarnings = builds.reduce((sum, b) => sum + b.warningCount, 0);

  return {
    totalBuilds: total,
    successCount,
    failedCount,
    abortedCount,
    successRate: total > 0 ? Math.round((successCount / total) * 100) : 0,
    avgDurationMs: successDurations.length > 0 ? Math.round(mean(successDurations)) : null,
    medianDurationMs: median(successDurations),
    totalErrors,
    totalWarnings,
    avgErrorsPerBuild: total > 0 ? totalErrors / total : 0,
  };
}

// ── buildDurationTrend ───────────────────────────────────────────────────────

export function buildDurationTrend(builds: HealthBuild[]): DurationTrendPoint[] {
  return sortChronological(builds)
    .filter((b): b is HealthBuild & { durationMs: number } => b.durationMs != null)
    .map((b) => ({
      buildId: b.buildId,
      createdAt: b.createdAt,
      durationMs: b.durationMs,
      status: b.status,
      errorCount: b.errorCount,
      warningCount: b.warningCount,
    }));
}

// ── rankTargetsByDuration ────────────────────────────────────────────────────

export function rankTargetsByDuration(builds: HealthBuild[]): TargetHealth[] {
  const byTarget = new Map<string, HealthBuild[]>();
  for (const b of builds) {
    const list = byTarget.get(b.targetName);
    if (list) list.push(b);
    else byTarget.set(b.targetName, [b]);
  }

  const targets: TargetHealth[] = [];
  for (const [targetName, group] of byTarget) {
    const chronological = sortChronological(group);
    const durations = group.map((b) => b.durationMs).filter((d): d is number => d != null);
    const successCount = group.filter((b) => b.status === 'success').length;
    targets.push({
      targetName,
      builds: group.length,
      successRate: group.length > 0 ? Math.round((successCount / group.length) * 100) : 0,
      avgDurationMs: durations.length > 0 ? Math.round(mean(durations)) : null,
      maxDurationMs: durations.length > 0 ? Math.max(...durations) : null,
      lastStatus: chronological[chronological.length - 1].status,
    });
  }

  // Slowest average first; targets with no duration data sort last.
  return targets.sort((a, b) => (b.avgDurationMs ?? -1) - (a.avgDurationMs ?? -1));
}

// ── detectRegressions ────────────────────────────────────────────────────────

/**
 * Flag the latest build when its duration or error count spikes versus a
 * rolling baseline of the preceding builds. Returns at most one alert per kind
 * (duration / errors). An improvement (latest faster / fewer errors than
 * baseline) never produces an alert.
 */
export function detectRegressions(
  builds: HealthBuild[],
  config: Partial<RegressionConfig> = {},
): RegressionAlert[] {
  const cfg = { ...DEFAULT_REGRESSION_CONFIG, ...config };
  const alerts: RegressionAlert[] = [];

  const chronological = sortChronological(builds);
  if (chronological.length === 0) return alerts;

  const latest = chronological[chronological.length - 1];
  const priors = chronological.slice(0, -1);

  // ── Duration regression (successful builds with a recorded duration) ──
  if (latest.status === 'success' && latest.durationMs != null) {
    const priorDurations = priors
      .filter((b) => b.status === 'success' && b.durationMs != null)
      .slice(-cfg.baselineWindow)
      .map((b) => b.durationMs as number);

    if (priorDurations.length >= cfg.minBaselineSamples) {
      const baseline = mean(priorDurations);
      const current = latest.durationMs;
      if (baseline > 0 && current > baseline * cfg.durationSpikeFactor) {
        const deltaPct = Math.round(((current - baseline) / baseline) * 100);
        const severity = current > baseline * cfg.durationCriticalFactor ? 'critical' : 'warning';
        alerts.push({
          kind: 'duration',
          buildId: latest.buildId,
          createdAt: latest.createdAt,
          current: Math.round(current),
          baseline: Math.round(baseline),
          deltaPct,
          severity,
          message: `Build duration spiked ${deltaPct}% above the rolling baseline (${Math.round(current / 1000)}s vs ${Math.round(baseline / 1000)}s).`,
        });
      }
    }
  }

  // ── Error-count regression (across all builds — failures count) ──
  {
    const priorErrors = priors.slice(-cfg.baselineWindow).map((b) => b.errorCount);
    if (priorErrors.length >= cfg.minBaselineSamples) {
      const baseline = mean(priorErrors);
      const current = latest.errorCount;
      if (current >= baseline + cfg.errorSpikeDelta) {
        const deltaPct = baseline > 0 ? Math.round(((current - baseline) / baseline) * 100) : 100;
        const severity = current >= baseline + cfg.errorCriticalDelta ? 'critical' : 'warning';
        alerts.push({
          kind: 'errors',
          buildId: latest.buildId,
          createdAt: latest.createdAt,
          current,
          baseline: Math.round(baseline * 10) / 10,
          deltaPct,
          severity,
          message: `Error count spiked to ${current} (rolling baseline ${Math.round(baseline * 10) / 10}).`,
        });
      }
    }
  }

  return alerts;
}

// ── DB query layer ───────────────────────────────────────────────────────────

interface HealthBuildRow {
  build_id: string;
  target_name: string;
  configuration: string;
  platform: string;
  status: string;
  duration_ms: number | null;
  error_count: number;
  warning_count: number;
  created_at: string;
}

/**
 * Fetch recent headless builds for a project as normalized {@link HealthBuild}
 * records, most-recent first (the analytics functions re-sort as needed).
 */
export function getHealthBuilds(projectPath: string, limit = 200): HealthBuild[] {
  ensureHeadlessBuildsTable();
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT build_id, target_name, configuration, platform, status,
              duration_ms, error_count, warning_count, created_at
         FROM headless_builds
        WHERE project_path = ?
        ORDER BY created_at DESC
        LIMIT ?`,
    )
    .all(projectPath, limit) as HealthBuildRow[];

  return rows.map((r) => ({
    buildId: r.build_id,
    targetName: r.target_name,
    configuration: r.configuration,
    platform: r.platform,
    status: r.status as BuildStatus,
    durationMs: r.duration_ms,
    errorCount: r.error_count ?? 0,
    warningCount: r.warning_count ?? 0,
    createdAt: r.created_at,
  }));
}

/**
 * Most recurring error fingerprints from the error-memory DB — the build
 * pipeline records compile errors here, so this surfaces what keeps breaking
 * builds, ranked by occurrence.
 */
export function getRecurringBuildErrors(limit = 8): RecurringError[] {
  return getAllErrors(limit).map((e) => ({
    fingerprint: e.fingerprint,
    pattern: e.pattern,
    category: e.category,
    message: e.message,
    occurrences: e.occurrences,
    moduleId: e.moduleId,
    errorCode: e.errorCode,
    wasResolved: e.wasResolved,
    lastSeenAt: e.lastSeenAt,
  }));
}

/**
 * Build the full health report for a project: summary + duration trend +
 * slowest targets + recurring errors + regression alerts.
 */
export function getBuildHealthReport(
  projectPath: string,
  opts: { limit?: number; regression?: Partial<RegressionConfig> } = {},
): BuildHealthReport {
  const builds = getHealthBuilds(projectPath, opts.limit ?? 200);
  return {
    summary: summarizeBuilds(builds),
    durationTrend: buildDurationTrend(builds),
    slowestTargets: rankTargetsByDuration(builds),
    recurringErrors: getRecurringBuildErrors(),
    regressions: detectRegressions(builds, opts.regression),
    generatedAt: new Date().toISOString(),
  };
}
