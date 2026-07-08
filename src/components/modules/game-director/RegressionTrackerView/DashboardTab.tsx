'use client';

import { useMemo } from 'react';
import {
  AlertOctagon, AlertTriangle, CheckCircle2,
  Shield, TrendingDown, Bug,
} from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { MeterBar } from '@/components/ui/MeterBar';
import { MetricCard } from '@/components/ui/MetricCard';
import type {
  FindingFingerprint,
  RegressionReport,
  RegressionStats,
} from '@/types/regression-tracker';
import {
  STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, STATUS_BLOCKER,
  OPACITY_8, OPACITY_12, OPACITY_15,
} from '@/lib/chart-colors';
import { SEVERITY_TOKENS, REGRESSION_STATUS_TOKENS } from '@/lib/game-director-styles';
import { StatusChip } from '@/components/ui/StatusChip';
import { ACCENT } from './constants';

// ─── Dashboard Tab ────────────────────────────────────────────────────────────

export function DashboardTab({
  stats,
  lastReport,
  fingerprints,
}: {
  stats: RegressionStats | null;
  lastReport: RegressionReport | null;
  fingerprints: FindingFingerprint[];
}) {
  // Top offenders: fingerprints with most regressions
  const topOffenders = useMemo(
    () => [...fingerprints].filter(f => f.regressionCount > 0).sort((a, b) => b.regressionCount - a.regressionCount).slice(0, 5),
    [fingerprints],
  );

  if (!stats) return null;

  const ratePercent = Math.round(stats.regressionRate * 100);
  // Higher regression rate is worse: red >20%, amber >10%, green below. Shared by
  // the percentage label and the meter fill so they never drift apart.
  const rateColor = (pct: number): string =>
    pct > 20 ? STATUS_ERROR : pct > 10 ? STATUS_WARNING : STATUS_SUCCESS;

  return (
    <div className="space-y-4">
      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard layout="horizontal" label="Tracked Issues" value={stats.totalTracked} icon={Bug} accent={ACCENT} />
        <MetricCard layout="horizontal" label="Open" value={stats.openCount} icon={AlertTriangle} accent={STATUS_BLOCKER} />
        <MetricCard layout="horizontal" label="Regressed" value={stats.regressedCount} icon={TrendingDown} accent={STATUS_ERROR} />
        <MetricCard layout="horizontal" label="Fixed" value={stats.fixedCount + stats.resolvedCount} icon={CheckCircle2} accent={STATUS_SUCCESS} />
      </div>

      {/* Regression rate bar */}
      <SurfaceCard level={2}>
        <div className="p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-2xs font-medium text-text-muted">Regression Rate</span>
            <span className="text-xs font-bold" style={{ color: rateColor(ratePercent) }}>
              {ratePercent}%
            </span>
          </div>
          <MeterBar
            value={ratePercent}
            color={rateColor}
            ariaLabel="Regression rate"
            valueText={`${ratePercent}%`}
          />
        </div>
      </SurfaceCard>

      {/* Active alerts */}
      {stats.activeAlerts > 0 && (
        <SurfaceCard level={2}>
          <div className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <AlertOctagon className="w-3.5 h-3.5" style={{ color: STATUS_ERROR }} />
              <span className="text-sm font-semibold" style={{ color: STATUS_ERROR }}>
                {stats.activeAlerts} Active Regression Alert{stats.activeAlerts > 1 ? 's' : ''}
              </span>
            </div>
            <p className="text-xs text-text-muted">
              Issues that were previously fixed have reappeared. Check the Alerts tab for details.
            </p>
          </div>
        </SurfaceCard>
      )}

      {/* Top offenders */}
      {topOffenders.length > 0 && (
        <SurfaceCard level={2}>
          <div className="p-3">
            <span className="text-sm font-semibold text-text">Chronic Regressions</span>
            <p className="text-xs text-text-muted mb-3">Issues that keep coming back after being fixed</p>
            <div className="space-y-2">
              {topOffenders.map(fp => {
                const sev = SEVERITY_TOKENS[fp.peakSeverity];
                const SevIcon = sev.icon;
                return (
                  <div key={fp.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-background">
                    <SevIcon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: sev.color }} />
                    <span className="text-sm text-text flex-1 truncate">{fp.titleStem}</span>
                    <span className="text-2xs font-mono px-1.5 py-0.5 rounded"
                      style={{ color: STATUS_ERROR, backgroundColor: `${STATUS_ERROR}${OPACITY_12}` }}>
                      {fp.regressionCount}x regressed
                    </span>
                    <StatusChip token={REGRESSION_STATUS_TOKENS[fp.status]} />
                  </div>
                );
              })}
            </div>
          </div>
        </SurfaceCard>
      )}

      {/* Last report summary */}
      {lastReport && <ReportSummary report={lastReport} />}
    </div>
  );
}

// ─── Report Summary ───────────────────────────────────────────────────────────

function ReportSummary({ report }: { report: RegressionReport }) {
  return (
    <SurfaceCard level={2}>
      <div className="p-3">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-3.5 h-3.5" style={{ color: ACCENT }} />
          <span className="text-sm font-semibold text-text">
            Report: {report.sessionName}
          </span>
          <span className="text-2xs text-text-muted ml-auto">
            {new Date(report.generatedAt).toLocaleString()}
          </span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          <MiniStat label="New Issues" value={report.newFindings.length} color={STATUS_WARNING} />
          <MiniStat label="Regressions" value={report.regressions.length} color={STATUS_ERROR} />
          <MiniStat label="Persistent" value={report.persistent.length} color={STATUS_BLOCKER} />
          <MiniStat label="Newly Fixed" value={report.newlyFixed.length} color={STATUS_SUCCESS} />
        </div>

        {report.regressions.length > 0 && (
          <div className="mt-3 space-y-1.5">
            <span className="text-2xs font-semibold" style={{ color: STATUS_ERROR }}>Regressions Detected:</span>
            {report.regressions.map(alert => (
              <div key={alert.id} className="flex items-center gap-2 text-2xs px-2 py-1 rounded"
                style={{ backgroundColor: `${STATUS_ERROR}${OPACITY_8}`, border: `1px solid ${STATUS_ERROR}${OPACITY_15}` }}>
                <AlertOctagon className="w-3 h-3 flex-shrink-0" style={{ color: STATUS_ERROR }} />
                <span className="text-text truncate flex-1">{alert.title}</span>
                <span className="text-text-muted flex-shrink-0">{alert.buildGap} build{alert.buildGap !== 1 ? 's' : ''} gap</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </SurfaceCard>
  );
}

// ─── Shared stat components ───────────────────────────────────────────────────

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="px-2.5 py-2 rounded-md bg-background text-center">
      <div className="text-sm font-bold" style={{ color }}>{value}</div>
      <div className="text-2xs text-text-muted mt-0.5">{label}</div>
    </div>
  );
}
