'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Hammer, RefreshCw, CheckCircle, Clock, ListChecks, AlertTriangle,
  TrendingUp, Bug, Activity, XCircle, Timer,
} from 'lucide-react';
import { apiFetch } from '@/lib/api-utils';
import { formatDuration } from '@/lib/format';
import { useProjectStore } from '@/stores/projectStore';
import { KPICard } from '@/components/ui/KPICard';
import { EmptyState } from '@/components/ui/EmptyState';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { FetchError } from '../shared/FetchError';
import { BuildDurationTrendChart } from './BuildDurationTrendChart';
import {
  MODULE_COLORS, STATUS_SUCCESS, STATUS_ERROR, STATUS_WARNING, STATUS_INFO, STATUS_STALE,
  STATUS_NEUTRAL, successRateColor, SEVERITY_TOKENS, withOpacity, OPACITY_10,
} from '@/lib/chart-colors';
import type {
  BuildHealthReport, RegressionAlert, TargetHealth, RecurringError,
} from '@/lib/ue5-bridge/build-health';
import type { BuildStatus } from '@/types/ue5-bridge';

const ACCENT = MODULE_COLORS.systems;

interface BuildHealthDashboardProps {
  /** Pre-supplied report — bypasses the network fetch (used by tests / SSR). */
  initialReport?: BuildHealthReport;
}

function statusColor(status: BuildStatus): string {
  if (status === 'success') return STATUS_SUCCESS;
  if (status === 'failed') return STATUS_ERROR;
  if (status === 'aborted') return STATUS_WARNING;
  return STATUS_NEUTRAL;
}

export function BuildHealthDashboard({ initialReport }: BuildHealthDashboardProps) {
  const projectPath = useProjectStore((s) => s.projectPath);
  const [report, setReport] = useState<BuildHealthReport | null>(initialReport ?? null);
  const [loading, setLoading] = useState(!initialReport);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = useCallback(async () => {
    if (!projectPath) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<BuildHealthReport>(
        `/api/ue5-bridge/build-health?projectPath=${encodeURIComponent(projectPath)}`,
      );
      setReport(data);
    } catch (e) {
      console.error('[BuildHealthDashboard] Failed to fetch build health:', e);
      setError(e instanceof Error ? e.message : 'Failed to load build health');
    } finally {
      setLoading(false);
    }
  }, [projectPath]);

  // Skip the network entirely when a report was injected (tests / SSR).
  useEffect(() => {
    if (initialReport) return;
    fetchReport();
  }, [initialReport, fetchReport]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Activity className="w-5 h-5 animate-spin text-text-muted" />
      </div>
    );
  }

  if (error) {
    return <FetchError message={error} onRetry={fetchReport} />;
  }

  if (!projectPath && !report) {
    return (
      <EmptyState
        icon={Hammer}
        title="No project selected"
        description="Select or set up a UE project to see its build health and trends."
        iconColor={ACCENT}
      />
    );
  }

  if (!report || report.summary.totalBuilds === 0) {
    return (
      <div data-testid="build-health-empty">
        <EmptyState
          icon={Hammer}
          title="No headless builds yet"
          description="Run a headless UE build (from a module's build action or the nightly scheduler) and its duration, errors, and warnings will be tracked and trended here."
          iconColor={ACCENT}
        />
      </div>
    );
  }

  const { summary, durationTrend, slowestTargets, recurringErrors, regressions } = report;
  const maxTargetAvg = Math.max(1, ...slowestTargets.map((t) => t.avgDurationMs ?? 0));

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Hammer className="w-4 h-4" style={{ color: ACCENT }} />
          <span className="text-sm font-semibold text-text">Build Health &amp; Trends</span>
          <span className="text-xs text-text-muted font-mono">{summary.totalBuilds} builds</span>
        </div>
        <button
          onClick={fetchReport}
          disabled={loading || !!initialReport}
          className="p-1 rounded text-text-muted hover:text-text hover:bg-surface-hover transition-colors disabled:opacity-40"
          aria-label="Refresh build health"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Regression alerts */}
      {regressions.length > 0 && (
        <RegressionBanner regressions={regressions} />
      )}

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        <KPICard
          layout="vertical"
          accent={successRateColor(summary.successRate)}
          icon={<CheckCircle className="w-3.5 h-3.5" style={{ color: successRateColor(summary.successRate) }} />}
          label="Success Rate"
          value={<span data-stat="success-rate">{summary.successRate}%</span>}
          sub={`${summary.successCount}/${summary.totalBuilds} succeeded`}
        />
        <KPICard
          layout="vertical"
          accent={STATUS_INFO}
          icon={<Clock className="w-3.5 h-3.5" style={{ color: STATUS_INFO }} />}
          label="Avg Duration"
          value={<span data-stat="avg-duration">{summary.avgDurationMs != null ? formatDuration(summary.avgDurationMs) : '—'}</span>}
          sub={summary.medianDurationMs != null ? `median ${formatDuration(summary.medianDurationMs)}` : undefined}
        />
        <KPICard
          layout="vertical"
          accent={STATUS_STALE}
          icon={<ListChecks className="w-3.5 h-3.5" style={{ color: STATUS_STALE }} />}
          label="Total Builds"
          value={<span data-stat="total-builds">{summary.totalBuilds}</span>}
          sub={summary.failedCount > 0 ? `${summary.failedCount} failed` : 'all passing'}
        />
        <KPICard
          layout="vertical"
          accent={summary.totalErrors > 0 ? STATUS_ERROR : STATUS_SUCCESS}
          icon={<Bug className="w-3.5 h-3.5" style={{ color: summary.totalErrors > 0 ? STATUS_ERROR : STATUS_SUCCESS }} />}
          label="Total Errors"
          value={<span data-stat="total-errors">{summary.totalErrors}</span>}
          sub={`${summary.avgErrorsPerBuild.toFixed(1)} avg/build · ${summary.totalWarnings} warns`}
        />
      </div>

      {/* Duration trend */}
      <SurfaceCard level={1} className="p-4">
        <div className="flex items-center gap-1.5 mb-3">
          <TrendingUp className="w-3.5 h-3.5" style={{ color: ACCENT }} />
          <span className="text-xs font-semibold text-text">Build Duration Over Time</span>
          <span className="ml-auto text-2xs text-text-muted">dashed line = avg</span>
        </div>
        <BuildDurationTrendChart data={durationTrend} baselineMs={summary.avgDurationMs} height={190} />
      </SurfaceCard>

      {/* Slowest targets + Recurring errors */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Slowest targets */}
        <SurfaceCard level={1} className="p-4" data-testid="build-health-targets">
          <div className="flex items-center gap-1.5 mb-3">
            <Timer className="w-3.5 h-3.5" style={{ color: STATUS_INFO }} />
            <span className="text-xs font-semibold text-text">Slowest Targets</span>
          </div>
          <div className="space-y-2">
            {slowestTargets.map((t) => (
              <TargetRow key={t.targetName} target={t} maxAvg={maxTargetAvg} />
            ))}
          </div>
        </SurfaceCard>

        {/* Recurring errors */}
        <SurfaceCard level={1} className="p-4" data-testid="build-health-errors">
          <div className="flex items-center gap-1.5 mb-3">
            <Bug className="w-3.5 h-3.5" style={{ color: STATUS_ERROR }} />
            <span className="text-xs font-semibold text-text">Recurring Build Errors</span>
            <span className="ml-auto text-2xs text-text-muted">from error memory</span>
          </div>
          {recurringErrors.length === 0 ? (
            <div className="text-center text-text-muted text-xs py-6">No recorded build errors. 🎉</div>
          ) : (
            <div className="space-y-1.5">
              {recurringErrors.map((e) => (
                <RecurringErrorRow key={e.fingerprint} error={e} />
              ))}
            </div>
          )}
        </SurfaceCard>
      </div>
    </div>
  );
}

// ── Regression banner ────────────────────────────────────────────────────────

function RegressionBanner({ regressions }: { regressions: RegressionAlert[] }) {
  return (
    <div data-testid="build-health-regressions" className="space-y-2">
      {regressions.map((r) => {
        const token = r.severity === 'critical' ? SEVERITY_TOKENS.critical : SEVERITY_TOKENS.warning;
        return (
          <div
            key={`${r.kind}-${r.buildId}`}
            data-regression-kind={r.kind}
            data-regression-severity={r.severity}
            className="flex items-start gap-2.5 rounded-lg px-3 py-2.5"
            style={{ backgroundColor: token.bg, border: `1px solid ${token.border}` }}
          >
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: token.color }} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold" style={{ color: token.color }}>
                  {r.kind === 'duration' ? 'Build slowdown' : 'Error spike'} regression
                </span>
                <span
                  className="text-2xs px-1.5 py-0.5 rounded font-medium uppercase tracking-wide"
                  style={{ backgroundColor: withOpacity(token.color, OPACITY_10), color: token.color }}
                >
                  {r.severity}
                </span>
                <span className="text-2xs font-mono text-text-muted">+{r.deltaPct}%</span>
              </div>
              <p className="text-xs text-text-muted-hover leading-relaxed mt-0.5">{r.message}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Target row ─────────────────────────────────────────────────────────────

function TargetRow({ target, maxAvg }: { target: TargetHealth; maxAvg: number }) {
  const widthPct = Math.round(((target.avgDurationMs ?? 0) / maxAvg) * 100);
  return (
    <div data-target={target.targetName} className="text-xs">
      <div className="flex items-center justify-between mb-1">
        <span className="flex items-center gap-1.5 min-w-0">
          {target.lastStatus === 'success'
            ? <CheckCircle className="w-3 h-3 flex-shrink-0" style={{ color: statusColor(target.lastStatus) }} />
            : <XCircle className="w-3 h-3 flex-shrink-0" style={{ color: statusColor(target.lastStatus) }} />}
          <span className="font-mono text-text truncate">{target.targetName}</span>
          <span className="text-2xs text-text-muted">({target.builds})</span>
        </span>
        <span className="font-mono text-text-muted flex-shrink-0">{target.avgDurationMs != null ? formatDuration(target.avgDurationMs) : '—'}</span>
      </div>
      <div className="w-full h-1.5 rounded-full bg-surface-hover overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${widthPct}%`, backgroundColor: ACCENT }} />
      </div>
      <div className="flex items-center gap-2 mt-0.5 text-2xs text-text-muted">
        <span style={{ color: successRateColor(target.successRate) }}>{target.successRate}% pass</span>
        {target.maxDurationMs != null && <span>peak {formatDuration(target.maxDurationMs)}</span>}
      </div>
    </div>
  );
}

// ── Recurring error row ──────────────────────────────────────────────────────

function RecurringErrorRow({ error }: { error: RecurringError }) {
  return (
    <div
      data-error-fingerprint={error.fingerprint}
      className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-surface-hover transition-colors"
    >
      <span
        className="text-2xs font-mono px-1.5 py-0.5 rounded flex-shrink-0"
        style={{ backgroundColor: withOpacity(STATUS_ERROR, OPACITY_10), color: STATUS_ERROR }}
        title={`${error.occurrences} occurrence${error.occurrences !== 1 ? 's' : ''}`}
      >
        ×{error.occurrences}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-text truncate" title={error.message}>
          {error.errorCode ? <span className="font-mono text-text-muted">{error.errorCode} </span> : null}
          {error.pattern}
        </div>
        <div className="text-2xs text-text-muted">
          {error.category} · {error.moduleId}
        </div>
      </div>
      {error.wasResolved && (
        <CheckCircle className="w-3 h-3 flex-shrink-0" style={{ color: STATUS_SUCCESS }} aria-label="resolved" />
      )}
    </div>
  );
}
