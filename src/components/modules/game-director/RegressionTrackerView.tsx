'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertOctagon, AlertTriangle, CheckCircle2,
  RefreshCw, ChevronDown, ChevronRight, X, Shield, Loader2,
  TrendingDown, Bug, ArrowRight, Eye,
} from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { MeterBar } from '@/components/ui/MeterBar';
import { MetricCard } from '@/components/ui/MetricCard';
import { TabBar, type TabItem } from '@/components/ui/TabBar';
import { apiFetch } from '@/lib/api-utils';
import { useIsMounted } from '@/hooks/useIsMounted';
import type { PlaytestSession } from '@/types/game-director';
import type { RegressionStatus } from '@/types/regression-tracker';
import type {
  FindingFingerprint,
  FingerprintOccurrence,
  RegressionAlert,
  RegressionReport,
  RegressionStats,
} from '@/types/regression-tracker';
import {
  ACCENT_ORANGE, STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, STATUS_BLOCKER,
  OPACITY_8, OPACITY_10, OPACITY_12, OPACITY_15, OPACITY_20,
} from '@/lib/chart-colors';
import { SEVERITY_TOKENS, REGRESSION_STATUS_TOKENS } from '@/lib/game-director-styles';
import { SeverityBadge } from '@/components/ui/SeverityBadge';
import { StatusChip } from '@/components/ui/StatusChip';
import { EmptyState } from '@/components/ui/EmptyState';
import { FetchError } from '../shared/FetchError';
import { InlineErrorRetry } from '../shared/InlineErrorRetry';

const ACCENT = ACCENT_ORANGE;

const EMPTY_SESSIONS: PlaytestSession[] = [];

// ─── Main view ────────────────────────────────────────────────────────────────

type SubTab = 'dashboard' | 'fingerprints' | 'alerts';

/** A regression action that failed and can be retried from the inline error banner. */
type FailedAction =
  | { kind: 'analyze'; sessionId: string }
  | { kind: 'dismiss'; alertId: string }
  | { kind: 'resolve'; fingerprintId: string };

export function RegressionTrackerView() {
  const [subTab, setSubTab] = useState<SubTab>('dashboard');
  const [sessions, setSessions] = useState<PlaytestSession[]>(EMPTY_SESSIONS);
  const [fingerprints, setFingerprints] = useState<FindingFingerprint[]>([]);
  const [alerts, setAlerts] = useState<RegressionAlert[]>([]);
  const [stats, setStats] = useState<RegressionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [lastReport, setLastReport] = useState<RegressionReport | null>(null);
  const [actionError, setActionError] = useState<{ message: string; action: FailedAction } | null>(null);
  const isMounted = useIsMounted();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [fpData, alertData, statData, sessData] = await Promise.all([
        apiFetch<FindingFingerprint[]>('/api/regression-tracker?action=fingerprints'),
        apiFetch<RegressionAlert[]>('/api/regression-tracker?action=alerts'),
        apiFetch<RegressionStats>('/api/regression-tracker?action=stats'),
        apiFetch<PlaytestSession[]>('/api/regression-tracker?action=sessions'),
      ]);
      if (!isMounted()) return;
      setFingerprints(fpData);
      setAlerts(alertData);
      setStats(statData);
      setSessions(sessData);
    } catch (err) {
      if (!isMounted()) return;
      setError(err instanceof Error ? err.message : 'Failed to load regression data');
    } finally {
      if (isMounted()) setLoading(false);
    }
  }, [isMounted]);

  useEffect(() => { void refresh(); }, [refresh]);

  const handleProcess = useCallback(async (sessionId: string) => {
    if (!sessionId) return;
    setProcessing(true);
    setActionError(null);
    try {
      const report = await apiFetch<RegressionReport>('/api/regression-tracker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'process-session', sessionId }),
      });
      if (!isMounted()) return;
      setLastReport(report);
      await refresh();
    } catch (err) {
      if (!isMounted()) return;
      setActionError({
        message: err instanceof Error ? err.message : 'Failed to analyze session for regressions',
        action: { kind: 'analyze', sessionId },
      });
    } finally {
      if (isMounted()) setProcessing(false);
    }
  }, [refresh, isMounted]);

  const handleDismiss = useCallback(async (alertId: string) => {
    setActionError(null);
    try {
      await apiFetch('/api/regression-tracker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'dismiss', alertId }),
      });
      if (!isMounted()) return;
      await refresh();
    } catch (err) {
      if (!isMounted()) return;
      setActionError({
        message: err instanceof Error ? err.message : 'Failed to dismiss alert',
        action: { kind: 'dismiss', alertId },
      });
    }
  }, [refresh, isMounted]);

  const handleResolve = useCallback(async (fpId: string) => {
    setActionError(null);
    try {
      await apiFetch('/api/regression-tracker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resolve', fingerprintId: fpId }),
      });
      if (!isMounted()) return;
      await refresh();
    } catch (err) {
      if (!isMounted()) return;
      setActionError({
        message: err instanceof Error ? err.message : 'Failed to mark issue resolved',
        action: { kind: 'resolve', fingerprintId: fpId },
      });
    }
  }, [refresh, isMounted]);

  const retryAction = useCallback((action: FailedAction) => {
    switch (action.kind) {
      case 'analyze': void handleProcess(action.sessionId); break;
      case 'dismiss': void handleDismiss(action.alertId); break;
      case 'resolve': void handleResolve(action.fingerprintId); break;
    }
  }, [handleProcess, handleDismiss, handleResolve]);

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center h-64 text-text-muted">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Loading regression data...
      </div>
    );
  }

  if (error && !stats) {
    return <FetchError message={error} onRetry={refresh} />;
  }

  const activeAlertCount = alerts.filter(a => !a.dismissed).length;
  const tabs: TabItem<SubTab>[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'fingerprints', label: 'Tracked Issues' },
    {
      id: 'alerts',
      label: 'Regression Alerts',
      badge: activeAlertCount > 0 ? {
        count: activeAlertCount,
        color: STATUS_ERROR,
        label: `${activeAlertCount} active regression alert${activeAlertCount !== 1 ? 's' : ''}`,
      } : undefined,
    },
  ];

  return (
    <div className="space-y-5">
      {/* Process session bar */}
      <SurfaceCard level={1}>
        <div className="p-4">
          <div className="flex items-center gap-3">
            <Bug className="w-4 h-4" style={{ color: ACCENT }} />
            <span className="text-sm font-semibold text-text">Analyze Session for Regressions</span>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <select
              value={selectedSessionId}
              onChange={(e) => setSelectedSessionId(e.target.value)}
              aria-label="Select session to analyze"
              className="focus-ring-inset flex-1 bg-background border border-border rounded-md px-3 py-1.5 text-sm text-text outline-none focus:border-border-bright"
            >
              <option value="">Select a completed session...</option>
              {sessions.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({new Date(s.createdAt).toLocaleDateString()})</option>
              ))}
            </select>
            <button
              onClick={() => void handleProcess(selectedSessionId)}
              disabled={!selectedSessionId || processing}
              className="focus-ring flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors disabled:opacity-40"
              style={{ backgroundColor: `${ACCENT}20`, color: ACCENT, border: `1px solid ${ACCENT}30` }}
            >
              {processing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              {processing ? 'Processing…' : 'Analyze'}
            </button>
          </div>
        </div>
      </SurfaceCard>

      {/* Inline error banner for failed analyze / dismiss / resolve actions */}
      {actionError && (
        <InlineErrorRetry
          message={actionError.message}
          onRetry={() => retryAction(actionError.action)}
          onDismiss={() => setActionError(null)}
        />
      )}

      {/* Sub-tabs */}
      <TabBar
        tabs={tabs}
        activeId={subTab}
        onChange={setSubTab}
        layoutId="regression-tab-indicator"
        accent={ACCENT}
        density="compact"
        ariaLabel="Regression tracker views"
      />

      {/* Tab content */}
      {subTab === 'dashboard' && (
        <DashboardTab stats={stats} lastReport={lastReport} fingerprints={fingerprints} />
      )}
      {subTab === 'fingerprints' && (
        <FingerprintsTab fingerprints={fingerprints} onResolve={handleResolve} />
      )}
      {subTab === 'alerts' && (
        <AlertsTab alerts={alerts} onDismiss={handleDismiss} />
      )}
    </div>
  );
}

// ─── Dashboard Tab ────────────────────────────────────────────────────────────

function DashboardTab({
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

// ─── Fingerprints Tab ─────────────────────────────────────────────────────────

function FingerprintsTab({
  fingerprints,
  onResolve,
}: {
  fingerprints: FindingFingerprint[];
  onResolve: (fpId: string) => void;
}) {
  const [filter, setFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [occurrences, setOccurrences] = useState<FingerprintOccurrence[]>([]);
  const [loadingOcc, setLoadingOcc] = useState(false);
  const [occError, setOccError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (filter === 'all') return fingerprints;
    return fingerprints.filter(fp => fp.status === filter);
  }, [fingerprints, filter]);

  const fetchOccurrences = useCallback(async (fpId: string) => {
    setLoadingOcc(true);
    setOccError(null);
    try {
      const occData = await apiFetch<FingerprintOccurrence[]>(`/api/regression-tracker?action=occurrences&fpId=${fpId}`);
      setOccurrences(occData);
    } catch (err) {
      setOccError(err instanceof Error ? err.message : 'Failed to load occurrence history');
      setOccurrences([]);
    } finally {
      setLoadingOcc(false);
    }
  }, []);

  const loadOccurrences = useCallback((fpId: string) => {
    if (expandedId === fpId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(fpId);
    void fetchOccurrences(fpId);
  }, [expandedId, fetchOccurrences]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: fingerprints.length, open: 0, fixed: 0, regressed: 0, resolved: 0 };
    for (const fp of fingerprints) counts[fp.status] = (counts[fp.status] ?? 0) + 1;
    return counts;
  }, [fingerprints]);

  return (
    <div className="space-y-3">
      {/* Filter chips */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {(['all', 'open', 'regressed', 'fixed', 'resolved'] as const).map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            aria-pressed={filter === s}
            className={`focus-ring px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
              filter === s ? 'text-white' : 'text-text-muted hover:text-text bg-surface-hover/50'
            }`}
            style={filter === s ? {
              backgroundColor: s === 'all' ? ACCENT : (REGRESSION_STATUS_TOKENS[s as RegressionStatus]?.color ?? ACCENT),
            } : undefined}
          >
            {s === 'all' ? 'All' : REGRESSION_STATUS_TOKENS[s as RegressionStatus]?.label ?? s} ({statusCounts[s] ?? 0})
          </button>
        ))}
      </div>

      {/* Fingerprint list */}
      {filtered.length === 0 ? (
        fingerprints.length === 0 ? (
          <EmptyState
            icon={Bug}
            iconColor={ACCENT}
            satelliteIcons={[Shield, Eye]}
            title="No tracked issues yet"
            description={`Tracked issues are unique bugs fingerprinted across multiple playtest sessions. Use the "Analyze Session" panel above to process a completed session and start tracking recurring issues.`}
          />
        ) : (
          <div className="text-center py-12 text-text-muted text-xs">
            No tracked issues with status &quot;{filter}&quot;.
          </div>
        )
      ) : (
        <div className="space-y-2">
          {filtered.map(fp => {
            const sev = SEVERITY_TOKENS[fp.peakSeverity];
            const statusToken = REGRESSION_STATUS_TOKENS[fp.status];
            const SevIcon = sev.icon;
            const isExpanded = expandedId === fp.id;

            return (
              <SurfaceCard key={fp.id} level={2}>
                <button
                  onClick={() => loadOccurrences(fp.id)}
                  aria-expanded={isExpanded}
                  className="focus-ring-inset rounded-md w-full text-left px-3 py-2.5 flex items-center gap-2.5 hover:bg-surface-hover/30 transition-colors"
                >
                  {isExpanded
                    ? <ChevronDown className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
                    : <ChevronRight className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
                  }
                  <SevIcon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: sev.color }} />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-text block truncate">{fp.titleStem}</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-text-muted">{fp.category}</span>
                      {fp.relatedModule && (
                        <span className="text-xs text-text-muted">{fp.relatedModule}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-2xs font-mono text-text-muted">{fp.occurrenceCount}x seen</span>
                    {fp.regressionCount > 0 && (
                      <span className="text-2xs font-mono px-1.5 py-0.5 rounded" style={{ color: STATUS_ERROR, backgroundColor: `${STATUS_ERROR}${OPACITY_12}` }}>
                        {fp.regressionCount}x regressed
                      </span>
                    )}
                    <StatusChip token={statusToken} />
                  </div>
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="overflow-hidden"
                    >
                      <div className="px-3 pb-3 border-t border-border/50 pt-2 space-y-2">
                        {loadingOcc ? (
                          <div className="flex items-center gap-2 text-2xs text-text-muted">
                            <Loader2 className="w-3 h-3 animate-spin" /> Loading history...
                          </div>
                        ) : occError ? (
                          <InlineErrorRetry
                            dense
                            message={`Couldn't load history: ${occError}`}
                            onRetry={() => { void fetchOccurrences(fp.id); }}
                          />
                        ) : (
                          <>
                            <div className="flex items-center justify-between">
                              <span className="text-2xs font-semibold text-text-muted">Occurrence History</span>
                              {(fp.status === 'open' || fp.status === 'regressed') && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); onResolve(fp.id); }}
                                  className="focus-ring text-xs font-medium px-2 py-0.5 rounded transition-colors"
                                  style={{ color: STATUS_SUCCESS, backgroundColor: `${STATUS_SUCCESS}${OPACITY_12}` }}
                                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = `${STATUS_SUCCESS}${OPACITY_20}`; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = `${STATUS_SUCCESS}${OPACITY_12}`; }}
                                >
                                  Mark Resolved
                                </button>
                              )}
                            </div>
                            {occurrences.map(occ => {
                              const occSev = SEVERITY_TOKENS[occ.severity];
                              const OccIcon = occSev.icon;
                              return (
                                <div key={`${occ.sessionId}-${occ.findingId}`} className="flex items-start gap-2 px-2 py-1.5 rounded bg-background text-2xs">
                                  <OccIcon className="w-3 h-3 mt-0.5 flex-shrink-0" style={{ color: occSev.color }} />
                                  <div className="flex-1 min-w-0">
                                    <span className="text-text block truncate">{occ.title}</span>
                                    {occ.suggestedFix && (
                                      <span className="text-text-muted block mt-0.5 truncate">Fix: {occ.suggestedFix}</span>
                                    )}
                                  </div>
                                  <span className="text-text-muted flex-shrink-0">
                                    {new Date(occ.createdAt).toLocaleDateString()}
                                  </span>
                                </div>
                              );
                            })}
                            {occurrences.length === 0 && (
                              <span className="text-2xs text-text-muted">No occurrence records found.</span>
                            )}
                          </>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </SurfaceCard>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Alerts Tab ───────────────────────────────────────────────────────────────

function AlertsTab({
  alerts,
  onDismiss,
}: {
  alerts: RegressionAlert[];
  onDismiss: (alertId: string) => void;
}) {
  const active = useMemo(() => alerts.filter(a => !a.dismissed), [alerts]);
  const dismissed = useMemo(() => alerts.filter(a => a.dismissed), [alerts]);
  const [showDismissed, setShowDismissed] = useState(false);

  return (
    <div className="space-y-3">
      {active.length === 0 && dismissed.length === 0 ? (
        <EmptyState
          icon={AlertOctagon}
          iconColor={ACCENT}
          satelliteIcons={[Shield, CheckCircle2]}
          title="No regression alerts"
          description="Regression alerts appear when a previously fixed bug reappears in a later playtest. Process multiple sessions over time to enable automatic regression detection."
        />
      ) : (
        <>
          {active.length === 0 ? (
            <SurfaceCard level={2}>
              <div className="p-4 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" style={{ color: STATUS_SUCCESS }} />
                <span className="text-sm font-medium" style={{ color: STATUS_SUCCESS }}>All clear — no active regression alerts</span>
              </div>
            </SurfaceCard>
          ) : (
            <div className="space-y-2">
              {active.map(alert => (
                <AlertCard key={alert.id} alert={alert} onDismiss={onDismiss} />
              ))}
            </div>
          )}

          {dismissed.length > 0 && (
            <div>
              <button
                onClick={() => setShowDismissed(!showDismissed)}
                aria-expanded={showDismissed}
                className="focus-ring rounded-sm flex items-center gap-1.5 text-xs text-text-muted hover:text-text transition-colors"
              >
                {showDismissed ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                {dismissed.length} dismissed alert{dismissed.length !== 1 ? 's' : ''}
              </button>
              {showDismissed && (
                <div className="space-y-2 mt-2 opacity-50">
                  {dismissed.map(alert => (
                    <AlertCard key={alert.id} alert={alert} onDismiss={onDismiss} />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function AlertCard({ alert, onDismiss }: { alert: RegressionAlert; onDismiss: (id: string) => void }) {
  const sev = SEVERITY_TOKENS[alert.severity];
  const SevIcon = sev.icon;
  const denseBg = `${sev.color}${OPACITY_20}`;

  return (
    <SurfaceCard level={2}>
      <div className="p-3">
        <div className="flex items-start gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
            style={{ backgroundColor: denseBg }}>
            <SevIcon className="w-3.5 h-3.5" style={{ color: sev.color }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-text truncate">{alert.title}</span>
              <SeverityBadge severity={alert.severity} density="dense" showIcon={false} upper className="flex-shrink-0" />
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-2xs text-text-muted">
              <span>{alert.category}</span>
              <span className="text-border">|</span>
              <span className="font-medium" style={{ color: STATUS_ERROR }}>
                Regressed after {alert.buildGap} build{alert.buildGap !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-2 text-2xs">
              <span className="px-1.5 py-0.5 rounded" style={{ color: STATUS_SUCCESS, backgroundColor: `${STATUS_SUCCESS}${OPACITY_10}` }}>
                Fixed: {alert.fixedInSessionName || 'Unknown'}
              </span>
              <ArrowRight className="w-3 h-3 text-text-muted" />
              <span className="px-1.5 py-0.5 rounded" style={{ color: STATUS_ERROR, backgroundColor: `${STATUS_ERROR}${OPACITY_10}` }}>
                Reappeared: {alert.reappearedInSessionName || 'Unknown'}
              </span>
            </div>
          </div>
          {!alert.dismissed && (
            <button
              onClick={() => onDismiss(alert.id)}
              aria-label="Dismiss alert"
              className="focus-ring p-1 rounded text-text-muted hover:text-text hover:bg-surface-hover transition-colors flex-shrink-0"
              title="Dismiss alert"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
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
