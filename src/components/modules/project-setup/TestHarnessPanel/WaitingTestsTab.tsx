'use client';

import { useCallback, useEffect, useState } from 'react';
import { Hourglass, Loader2, Play, RotateCcw } from 'lucide-react';
import { tryApiFetch } from '@/lib/api-utils';
import { STATUS_ERROR, STATUS_SUCCESS, STATUS_WARNING, ACCENT_VIOLET } from '@/lib/chart-colors';
import type { GateJob } from '@/lib/test-gate-runner/types';
import {
  WAITING_TESTS_URL, groupWaitingTests, runWaitingTest, describeRunOutcome,
  type WaitingTests, type WaitingRunOutcome,
} from './waitingTests';

function outcomeColor(o: WaitingRunOutcome): string {
  if (o.kind === 'busy' || o.kind === 'lease-error') return STATUS_WARNING;
  if (o.kind !== 'settled') return STATUS_ERROR;
  if (o.outcome.failed > 0) return STATUS_ERROR;
  return o.outcome.settled > 0 ? STATUS_SUCCESS : STATUS_WARNING;
}

/**
 * The UE automation tests deferred L3 gates are waiting on, ranked by how many gates one
 * run would settle. Loads when the tab opens; nothing touches the UE bridge until a row's
 * Run is clicked (lease check -> run the one test -> settle its gates, see waitingTests.ts).
 */
export function WaitingTestsTab() {
  const [data, setData] = useState<WaitingTests | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [running, setRunning] = useState<string | null>(null);
  // The last run's outcome lives above the list: a settle refreshes the queue and the row may leave it.
  const [lastRun, setLastRun] = useState<{ testName: string; outcome: WaitingRunOutcome } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void tryApiFetch<GateJob[]>(WAITING_TESTS_URL).then((r) => {
      if (cancelled) return;
      if (r.ok) { setData(groupWaitingTests(r.data)); setLoadError(null); } else setLoadError(r.error);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [reloadKey]);

  // Loading is raised by whoever asks for the reload (never set synchronously inside the effect).
  const reload = useCallback(() => { setLoading(true); setReloadKey((k) => k + 1); }, []);

  const run = useCallback(async (testName: string) => {
    setRunning(testName);
    const outcome = await runWaitingTest(testName);
    setLastRun({ testName, outcome });
    setRunning(null);
    // A settle changes the queue — refresh so the number the operator decided on visibly drops.
    if (outcome.kind === 'settled' && outcome.outcome.settled > 0) reload();
  }, [reload]);

  const totalGates = data?.tests.reduce((n, t) => n + t.gates, 0) ?? 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-text-muted">
          {data
            ? `${data.tests.length} test${data.tests.length !== 1 ? 's' : ''} · ${totalGates} deferred L3 gate${totalGates !== 1 ? 's' : ''} waiting${data.unnamed ? ` · ${data.unnamed} name no test` : ''}`
            : 'UE tests your deferred gates wait on'}
        </span>
        <button
          className="flex items-center gap-1 text-xs text-text-muted hover:text-text disabled:opacity-40"
          disabled={loading || running !== null}
          onClick={reload}
        >
          <RotateCcw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {lastRun && (
        <p className="text-2xs" role="status" style={{ color: outcomeColor(lastRun.outcome) }}>
          <span className="font-mono">{lastRun.testName}</span>: {describeRunOutcome(lastRun.outcome)}
        </p>
      )}

      {loadError && (
        <p className="text-xs" style={{ color: STATUS_ERROR }}>Could not load the deferred queue: {loadError}</p>
      )}

      {data && data.tests.length === 0 && !loading && (
        <div className="text-center py-8 text-xs text-text-muted">
          <Hourglass className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p>No deferred L3 gate is waiting on a named UE test.</p>
        </div>
      )}

      {data && data.tests.length > 0 && (
        <ul className="divide-y divide-border rounded border border-border">
          {data.tests.map((t) => {
            const isThis = running === t.testName;
            return (
              <li key={t.testName} className="px-3 py-2">
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-mono text-text truncate" title={t.testName}>{t.testName}</div>
                    <div className="text-2xs text-text-muted truncate">
                      {t.gates} gate{t.gates !== 1 ? 's' : ''} · {t.catalogs.length} catalog{t.catalogs.length !== 1 ? 's' : ''} ({t.catalogs.join(', ')})
                    </div>
                  </div>
                  <button
                    aria-label={`Run ${t.testName}`}
                    className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border border-border hover:bg-surface-hover disabled:opacity-40"
                    style={{ color: ACCENT_VIOLET }}
                    disabled={running !== null}
                    onClick={() => void run(t.testName)}
                  >
                    {isThis ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                    {isThis ? 'Running…' : 'Run + settle'}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
