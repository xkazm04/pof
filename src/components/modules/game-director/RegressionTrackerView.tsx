'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertOctagon, AlertTriangle, Info, CheckCircle2,
  RefreshCw, ChevronDown, ChevronRight, X, Shield, Loader2,
  TrendingUp, TrendingDown, Bug, ArrowRight, Eye,
} from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { apiFetch } from '@/lib/api-utils';
import type { PlaytestSession, FindingSeverity, FindingCategory } from '@/types/game-director';
import type {
  FindingFingerprint,
  FingerprintOccurrence,
  RegressionAlert,
  RegressionReport,
} from '@/types/regression-tracker';
import {
  ACCENT_ORANGE, STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, STATUS_INFO, STATUS_BLOCKER,
  OPACITY_8, OPACITY_10, OPACITY_12, OPACITY_15, OPACITY_20,
} from '@/lib/chart-colors';

const ACCENT = ACCENT_ORANGE;

// ─── Severity helpers ─────────────────────────────────────────────────────────

const SEVERITY_STYLES: Record<FindingSeverity, { icon: typeof AlertOctagon; color: string; bg: string }> = {
  critical: { icon: AlertOctagon, color: STATUS_ERROR, bg: `${STATUS_ERROR}${OPACITY_12}` },
  high: { icon: AlertTriangle, color: STATUS_BLOCKER, bg: `${STATUS_BLOCKER}${OPACITY_12}` },
  medium: { icon: Info, color: STATUS_WARNING, bg: `${STATUS_WARNING}${OPACITY_12}` },
  low: { icon: Info, color: STATUS_INFO, bg: `${STATUS_INFO}${OPACITY_12}` },
  positive: { icon: CheckCircle2, color: STATUS_SUCCESS, bg: `${STATUS_SUCCESS}${OPACITY_12}` },
};

const STATUS_STYLES: Record<string, { color: string; bg: string; label: string }> = {
  open: { color: STATUS_BLOCKER, bg: `${STATUS_BLOCKER}${OPACITY_15}`, label: 'Open' },
  fixed: { color: STATUS_SUCCESS, bg: `${STATUS_SUCCESS}${OPACITY_15}`, label: 'Fixed' },
  regressed: { color: STATUS_ERROR, bg: `${STATUS_ERROR}${OPACITY_15}`, label: 'Regressed' },
  resolved: { color: STATUS_INFO, bg: `${STATUS_INFO}${OPACITY_15}`, label: 'Resolved' },
};

const EMPTY_SESSIONS: PlaytestSession[] = [];

// ─── Main view ────────────────────────────────────────────────────────────────

type SubTab = 'dashboard' | 'fingerprints' | 'alerts';

export function RegressionTrackerView() {
  const [subTab, setSubTab] = useState<SubTab>('dashboard');
  const [sessions, setSessions] = useState<PlaytestSession[]>(EMPTY_SESSIONS);
  const [fingerprints, setFingerprints] = useState<FindingFingerprint[]>([]);
  const [alerts, setAlerts] = useState<RegressionAlert[]>([]);
  const [stats, setStats] = useState<{
    totalTracked: number; openCount: number; fixedCount: number;
    regressedCount: number; resolvedCount: number; activeAlerts: number; regressionRate: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [lastReport, setLastReport] = useState<RegressionReport | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [fpData, alertData, statData, sessData] = await Promise.all([
        apiFetch<FindingFingerprint[]>('/api/regression-tracker?action=fingerprints'),
        apiFetch<RegressionAlert[]>('/api/regression-tracker?action=alerts'),
        apiFetch<{ totalTracked: number; openCount: number; fixedCount: number; regressedCount: number; resolvedCount: number; activeAlerts: number; regressionRate: number }>('/api/regression-tracker?action=stats'),
        apiFetch<PlaytestSession[]>('/api/regression-tracker?action=sessions'),
      ]);
      setFingerprints(fpData);
      setAlerts(alertData);
      setStats(statData);
      setSessions(sessData);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const handleProcess = useCallback(async () => {
    if (!selectedSessionId) return;
    setProcessing(true);
    try {
      const report = await apiFetch<RegressionReport>('/api/regression-tracker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'process-session', sessionId: selectedSessionId }),
      });
      setLastReport(report);
      await refresh();
    } catch { /* ignore */ }
    setProcessing(false);
  }, [selectedSessionId, refresh]);

  const handleDismiss = useCallback(async (alertId: string) => {
    await apiFetch('/api/regression-tracker', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'dismiss', alertId }),
    });
    await refresh();
  }, [refresh]);

  const handleResolve = useCallback(async (fpId: string) => {
    await apiFetch('/api/regression-tracker', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'resolve', fingerprintId: fpId }),
    });
    await refresh();
  }, [refresh]);

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center h-64 text-text-muted">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Loading regression data...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Process session bar */}
      <SurfaceCard level={1}>
        <div className="p-4">
          <div className="flex items-center gap-3">
            <Bug className="w-4 h-4" style={{ color: ACCENT }} />
            <span className="text-xs font-semibold text-text">Analyze Session for Regressions</span>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <select
              value={selectedSessionId}
              onChange={(e) => setSelectedSessionId(e.target.value)}
              className="flex-1 bg-background border border-border rounded-md px-3 py-1.5 text-xs text-text outline-none focus:border-border-bright"
            >
              <option value="">Select a completed session...</option>
              {sessions.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({new Date(s.createdAt).toLocaleDateString()})</option>
              ))}
            </select>
            <button
              onClick={handleProcess}
              disabled={!selectedSessionId || processing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors disabled:opacity-40"
              style={{ backgroundColor: `${ACCENT}20`, color: ACCENT, border: `1px solid ${ACCENT}30` }}
            >
              {processing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              {processing ? 'Processing...' : 'Analyze'}
            </button>
          </div>
        </div>
      </SurfaceCard>

      {/* Sub-tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        {([
          ['dashboard', 'Dashboard'],
          ['fingerprints', 'Tracked Issues'],
          ['alerts', 'Regression Alerts'],
        ] as [SubTab, string][]).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setSubTab(id)}
            className={`px-3 py-1.5 text-xs font-medium transition-colors relative ${
              subTab === id ? 'text-text' : 'text-text-muted hover:text-text'
            }`}
          >
            {label}
            {id === 'alerts' && alerts.filter(a => !a.dismissed).length > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold"
                style={{ backgroundColor: STATUS_ERROR, color: '#fff' }}>
                {alerts.filter(a => !a.dismissed).length}
              </span>
            )}
            {subTab === id && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t" style={{ backgroundColor: ACCENT }} />
            )}
          </button>
        ))}
      </div>

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
  stats: { totalTracked: number; openCount: number; fixedCount: number; regressedCount: number; resolvedCount: number; activeAlerts: number; regressionRate: number } | null;
  lastReport: RegressionReport | null;
  fingerprints: FindingFingerprint[];
}) {
  if (!stats) return null;

  const ratePercent = Math.round(stats.regressionRate * 100);

  // Top offenders: fingerprints with most regressions
  const topOffenders = useMemo(
    () => [...fingerprints].filter(f => f.regressionCount > 0).sort((a, b) => b.regressionCount - a.regressionCount).slice(0, 5),
    [fingerprints],
  );

  return (
    <div className="space-y-4">
      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Tracked Issues" value={stats.totalTracked} icon={Bug} color={ACCENT} />
        <StatCard label="Open" value={stats.openCount} icon={AlertTriangle} color={STATUS_BLOCKER} />
        <StatCard label="Regressed" value={stats.regressedCount} icon={TrendingDown} color={STATUS_ERROR} />
        <StatCard label="Fixed" value={stats.fixedCount + stats.resolvedCount} icon={CheckCircle2} color={STATUS_SUCCESS} />
      </div>

      {/* Regression rate bar */}
      <SurfaceCard level={2}>
        <div className="p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-2xs font-medium text-text-muted">Regression Rate</span>
            <span className="text-xs font-bold" style={{ color: ratePercent > 20 ? STATUS_ERROR : ratePercent > 10 ? STATUS_WARNING : STATUS_SUCCESS }}>
              {ratePercent}%
            </span>
          </div>
          <div className="h-1.5 bg-border/40 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(ratePercent, 100)}%`,
                backgroundColor: ratePercent > 20 ? STATUS_ERROR : ratePercent > 10 ? STATUS_WARNING : STATUS_SUCCESS,
              }}
            />
          </div>
        </div>
      </SurfaceCard>

      {/* Active alerts */}
      {stats.activeAlerts > 0 && (
        <SurfaceCard level={2}>
          <div className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <AlertOctagon className="w-3.5 h-3.5 text-[#f87171]" />
              <span className="text-xs font-semibold text-[#f87171]">
                {stats.activeAlerts} Active Regression Alert{stats.activeAlerts > 1 ? 's' : ''}
              </span>
            </div>
            <p className="text-2xs text-text-muted">
              Issues that were previously fixed have reappeared. Check the Alerts tab for details.
            </p>
          </div>
        </SurfaceCard>
      )}

      {/* Top offenders */}
      {topOffenders.length > 0 && (
        <SurfaceCard level={2}>
          <div className="p-3">
            <span className="text-xs font-semibold text-text">Chronic Regressions</span>
            <p className="text-2xs text-text-muted mb-3">Issues that keep coming back after being fixed</p>
            <div className="space-y-2">
              {topOffenders.map(fp => {
                const sev = SEVERITY_STYLES[fp.peakSeverity];
                const status = STATUS_STYLES[fp.status];
                return (
                  <div key={fp.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-background">
                    <sev.icon className="w-3 h-3 flex-shrink-0" style={{ color: sev.color }} />
                    <span className="text-2xs text-text flex-1 truncate">{fp.titleStem}</span>
                    <span className="text-2xs font-mono px-1.5 py-0.5 rounded"
                      style={{ color: STATUS_ERROR, backgroundColor: `${STATUS_ERROR}${OPACITY_12}` }}>
                      {fp.regressionCount}x regressed
                    </span>
                    <span className="text-2xs font-medium px-1.5 py-0.5 rounded"
                      style={{ color: status.color, backgroundColor: status.bg }}>
                      {status.label}
                    </span>
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
          <span className="text-xs font-semibold text-text">
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
            <span className="text-2xs font-semibold text-[#f87171]">Regressions Detected:</span>
            {report.regressions.map(alert => (
              <div key={alert.id} className="flex items-center gap-2 text-2xs px-2 py-1 rounded bg-[#f8717108] border border-[#f8717115]">
                <AlertOctagon className="w-3 h-3 text-[#f87171] flex-shrink-0" />
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

  const filtered = useMemo(() => {
    if (filter === 'all') return fingerprints;
    return fingerprints.filter(fp => fp.status === filter);
  }, [fingerprints, filter]);

  const loadOccurrences = useCallback(async (fpId: string) => {
    if (expandedId === fpId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(fpId);
    setLoadingOcc(true);
    try {
      const occData = await apiFetch<FingerprintOccurrence[]>(`/api/regression-tracker?action=occurrences&fpId=${fpId}`);
      setOccurrences(occData);
    } catch { /* ignore */ }
    setLoadingOcc(false);
  }, [expandedId]);

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
            className={`px-2.5 py-1 rounded-full text-2xs font-medium transition-colors ${
              filter === s ? 'text-white' : 'text-text-muted hover:text-text bg-surface-hover/50'
            }`}
            style={filter === s ? {
              backgroundColor: s === 'all' ? ACCENT : (STATUS_STYLES[s]?.color ?? ACCENT),
            } : undefined}
          >
            {s === 'all' ? 'All' : STATUS_STYLES[s]?.label ?? s} ({statusCounts[s] ?? 0})
          </button>
        ))}
      </div>

      {/* Fingerprint list */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-text-muted text-xs">
          No tracked issues{filter !== 'all' ? ` with status "${filter}"` : ''}. Process a completed session to start tracking.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(fp => {
            const sev = SEVERITY_STYLES[fp.peakSeverity];
            const status = STATUS_STYLES[fp.status];
            const SevIcon = sev.icon;
            const isExpanded = expandedId === fp.id;

            return (
              <SurfaceCard key={fp.id} level={2}>
                <button
                  onClick={() => loadOccurrences(fp.id)}
                  className="w-full text-left px-3 py-2.5 flex items-center gap-2.5 hover:bg-surface-hover/30 transition-colors"
                >
                  {isExpanded
                    ? <ChevronDown className="w-3 h-3 text-text-muted flex-shrink-0" />
                    : <ChevronRight className="w-3 h-3 text-text-muted flex-shrink-0" />
                  }
                  <SevIcon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: sev.color }} />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium text-text block truncate">{fp.titleStem}</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-2xs text-text-muted">{fp.category}</span>
                      {fp.relatedModule && (
                        <span className="text-2xs text-text-muted">{fp.relatedModule}</span>
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
                    <span className="text-2xs font-medium px-1.5 py-0.5 rounded"
                      style={{ color: status.color, backgroundColor: status.bg }}>
                      {status.label}
                    </span>
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
                        ) : (
                          <>
                            <div className="flex items-center justify-between">
                              <span className="text-2xs font-semibold text-text-muted">Occurrence History</span>
                              {(fp.status === 'open' || fp.status === 'regressed') && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); onResolve(fp.id); }}
                                  className="text-2xs px-2 py-0.5 rounded text-[#4ade80] bg-[#4ade8012] hover:bg-[#4ade8020] transition-colors"
                                >
                                  Mark Resolved
                                </button>
                              )}
                            </div>
                            {occurrences.map(occ => {
                              const occSev = SEVERITY_STYLES[occ.severity];
                              return (
                                <div key={`${occ.sessionId}-${occ.findingId}`} className="flex items-start gap-2 px-2 py-1.5 rounded bg-background text-2xs">
                                  <occSev.icon className="w-3 h-3 mt-0.5 flex-shrink-0" style={{ color: occSev.color }} />
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
        <div className="text-center py-12 text-text-muted text-xs">
          No regression alerts. Process sessions to detect regressions.
        </div>
      ) : (
        <>
          {active.length === 0 ? (
            <SurfaceCard level={2}>
              <div className="p-4 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#4ade80]" />
                <span className="text-xs font-medium text-[#4ade80]">All clear — no active regression alerts</span>
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
                className="flex items-center gap-1.5 text-2xs text-text-muted hover:text-text transition-colors"
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
  const sev = SEVERITY_STYLES[alert.severity];
  const SevIcon = sev.icon;

  return (
    <SurfaceCard level={2}>
      <div className="p-3">
        <div className="flex items-start gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
            style={{ backgroundColor: sev.bg }}>
            <SevIcon className="w-3.5 h-3.5" style={{ color: sev.color }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-text truncate">{alert.title}</span>
              <span className="text-2xs font-bold uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0"
                style={{ color: sev.color, backgroundColor: sev.bg }}>
                {alert.severity}
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-2xs text-text-muted">
              <span>{alert.category}</span>
              <span className="text-border">|</span>
              <span className="font-medium text-[#f87171]">
                Regressed after {alert.buildGap} build{alert.buildGap !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-2 text-2xs">
              <span className="text-[#4ade80] bg-[#4ade8010] px-1.5 py-0.5 rounded">
                Fixed: {alert.fixedInSessionName || 'Unknown'}
              </span>
              <ArrowRight className="w-3 h-3 text-text-muted" />
              <span className="text-[#f87171] bg-[#f8717110] px-1.5 py-0.5 rounded">
                Reappeared: {alert.reappearedInSessionName || 'Unknown'}
              </span>
            </div>
          </div>
          {!alert.dismissed && (
            <button
              onClick={() => onDismiss(alert.id)}
              className="p-1 rounded text-text-muted hover:text-text hover:bg-surface-hover transition-colors flex-shrink-0"
              title="Dismiss alert"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </SurfaceCard>
  );
}

// ─── Shared stat components ───────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: typeof Bug; color: string }) {
  return (
    <SurfaceCard level={2}>
      <div className="p-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}15` }}>
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
        <div>
          <div className="text-lg font-bold text-text">{value}</div>
          <div className="text-2xs text-text-muted">{label}</div>
        </div>
      </div>
    </SurfaceCard>
  );
}

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="px-2.5 py-2 rounded-md bg-background text-center">
      <div className="text-sm font-bold" style={{ color }}>{value}</div>
      <div className="text-2xs text-text-muted mt-0.5">{label}</div>
    </div>
  );
}
