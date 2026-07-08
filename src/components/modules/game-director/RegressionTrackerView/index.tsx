'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw, Bug, Loader2,
} from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { TabBar, type TabItem } from '@/components/ui/TabBar';
import { apiFetch } from '@/lib/api-utils';
import { useIsMounted } from '@/hooks/useIsMounted';
import type { PlaytestSession } from '@/types/game-director';
import type {
  FindingFingerprint,
  RegressionAlert,
  RegressionReport,
  RegressionStats,
} from '@/types/regression-tracker';
import { STATUS_ERROR } from '@/lib/chart-colors';
import { FetchError } from '../../shared/FetchError';
import { InlineErrorRetry } from '../../shared/InlineErrorRetry';
import { ACCENT, EMPTY_SESSIONS } from './constants';
import type { SubTab, FailedAction } from './types';
import { DashboardTab } from './DashboardTab';
import { FingerprintsTab } from './FingerprintsTab';
import { AlertsTab } from './AlertsTab';

// ─── Main view ────────────────────────────────────────────────────────────────

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
