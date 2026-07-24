'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { tryApiFetch } from '@/lib/api-utils';
import { ACCENT_RED } from '@/lib/chart-colors';
import type { HarnessRunSummary } from '@/lib/harness-runs-db';
import type { RunDiff } from '@/lib/harness/run-diff';
import type { RunsResponse } from './constants';
import { CompareBar } from './CompareBar';
import { RunTable } from './RunTable';
import { DiffPanel } from './DiffPanel';

/**
 * Compact list of past harness runs with a two-row compare action. Each row
 * shows pass-rate, cost, duration, and status. The operator can pick a base
 * (A) + head (B) and surface the run-vs-run diff inline.
 */
export function HarnessRunHistory() {
  const [runs, setRuns] = useState<HarnessRunSummary[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [baseId, setBaseId] = useState<string | null>(null);
  const [headId, setHeadId] = useState<string | null>(null);
  const [diff, setDiff] = useState<RunDiff | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [diffError, setDiffError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- pre-existing
    setLoading(true);
    tryApiFetch<RunsResponse>('/api/harness/runs').then((r) => {
      if (cancelled) return;
      if (r.ok) { setRuns(r.data.runs); setError(null); }
      else setError(r.error);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [refreshTick]);

  const canCompare = baseId && headId && baseId !== headId;

  async function runCompare() {
    if (!baseId || !headId) return;
    setDiffLoading(true); setDiffError(null); setDiff(null);
    const r = await tryApiFetch<RunDiff>(`/api/harness/runs/diff?a=${encodeURIComponent(baseId)}&b=${encodeURIComponent(headId)}`);
    if (r.ok) setDiff(r.data); else setDiffError(r.error);
    setDiffLoading(false);
  }

  function pick(slot: 'A' | 'B', id: string) {
    if (slot === 'A') {
      setBaseId((prev) => (prev === id ? null : id));
    } else {
      setHeadId((prev) => (prev === id ? null : id));
    }
  }

  const empty = !loading && !error && runs && runs.length === 0;

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-text-muted text-xs">
          <span>Run history — every harness start is recorded with its plan, progress, guide and cost snapshot. Pick two runs to compare.</span>
        </div>
        <button
          type="button"
          onClick={() => setRefreshTick((t) => t + 1)}
          disabled={loading}
          aria-busy={loading}
          aria-label="Refresh run history"
          className="inline-flex items-center gap-1.5 px-2 py-1 text-xs rounded border border-border/40 text-text-muted hover:text-text focus-ring disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </header>

      <CompareBar
        baseId={baseId}
        headId={headId}
        runs={runs ?? []}
        onCompare={runCompare}
        canCompare={!!canCompare}
        loading={diffLoading}
      />

      {loading && (
        <div role="status" className="flex items-center gap-2 text-text-muted text-xs">
          <Loader2 className="w-3 h-3 animate-spin" /> Loading runs…
        </div>
      )}
      {error && (
        <div role="alert" className="flex items-center gap-2 text-xs" style={{ color: ACCENT_RED }}>
          <AlertTriangle className="w-3 h-3" /> Couldn&apos;t load run history: {error}
        </div>
      )}
      {empty && (
        <div className="text-text-muted text-xs italic">
          No runs yet — start the harness to record the first one.
        </div>
      )}

      {runs && runs.length > 0 && (
        <RunTable
          runs={runs}
          baseId={baseId}
          headId={headId}
          onPick={pick}
        />
      )}

      {diffError && (
        <div role="alert" className="flex items-center gap-2 text-xs" style={{ color: ACCENT_RED }}>
          <AlertTriangle className="w-3 h-3" /> Compare failed: {diffError}
        </div>
      )}
      {diff && <DiffPanel diff={diff} />}
    </div>
  );
}
