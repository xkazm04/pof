'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Hammer, RefreshCw, CheckCircle, Clock, ListChecks,
  TrendingUp, Bug, Activity, Timer,
} from 'lucide-react';
import { apiFetch } from '@/lib/api-utils';
import { formatDuration } from '@/lib/format';
import { useProjectStore } from '@/stores/projectStore';
import { KPICard } from '@/components/ui/KPICard';
import { EmptyState } from '@/components/ui/EmptyState';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { FetchError } from '../../shared/FetchError';
import { BuildDurationTrendChart } from '../BuildDurationTrendChart';
import {
  STATUS_SUCCESS, STATUS_ERROR, STATUS_INFO, STATUS_STALE, successRateColor,
} from '@/lib/chart-colors';
import type { BuildHealthReport } from '@/lib/ue5-bridge/build-health';
import { ACCENT } from './constants';
import type { BuildHealthDashboardProps } from './types';
import { RegressionBanner } from './RegressionBanner';
import { TargetRow } from './TargetRow';
import { RecurringErrorRow } from './RecurringErrorRow';

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
