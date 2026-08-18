'use client';

import { useCallback, useState } from 'react';
import { Play, Square } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { LoadingRow } from '@/components/ui/LoadingRow';
import { MicroLabel } from '@/components/ui/MicroLabel';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { StatusDot } from '@/components/ui/StatusDot';
import { InlineErrorRetry } from '@/components/modules/shared/InlineErrorRetry';
import { useSuspendableEffect } from '@/hooks/useSuspend';
import { tryApiFetch } from '@/lib/api-utils';
import { UI_TIMEOUTS } from '@/lib/constants';
import { STATUS_SUCCESS, STATUS_WARNING } from '@/lib/chart-colors';
import type { WorkerStatus } from '@/lib/test-gate-runner/worker';
import type { LeaseState } from '@/lib/test-gate-runner/drain-lease';
import { WorkerSettingsForm, DEFAULT_WORKER_SETTINGS, type WorkerSettings } from './WorkerSettingsForm';
import { AUTOSTART_DEFAULT_NOTE, describeScope, startBody } from './workerCopy';

const WORKER_URL = '/api/pipeline-artifacts/drain/worker';
const LEASE_URL = '/api/pipeline-artifacts/drain/status';

function Row({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div className="min-w-0" title={title}>
      <MicroLabel as="div" uppercase>{label}</MicroLabel>
      <div className="text-xs text-text font-mono truncate">{value}</div>
    </div>
  );
}

/**
 * Operator control for the always-on drain worker — the third L3/L4 trigger that
 * was fully built and tested but had no way to reach it (no UI, no MCP tool, no
 * auto-start), leaving "three triggers" as two plus a hand-written curl.
 *
 * The panel is a control surface over the EXISTING toggle route: it starts and
 * stops the worker, and shows the state that matters where the control lives —
 * running, who started it (operator vs the opt-in boot auto-start), tick count,
 * last tick, last drain summary, and the drain LEASE. The lease is the reason the
 * worker is safe to leave on: each tick acquires the same lease an operator drain
 * takes, so a held lease makes the worker skip its tick rather than contend for
 * the non-reentrant editor. Nothing here bypasses it.
 */
export function DrainWorkerControls() {
  const [worker, setWorker] = useState<WorkerStatus | null>(null);
  const [lease, setLease] = useState<LeaseState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [settings, setSettings] = useState<WorkerSettings>(DEFAULT_WORKER_SETTINGS);
  const [pending, setPending] = useState<'start' | 'stop' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useSuspendableEffect(() => {
    let alive = true;
    const tick = async () => {
      const [w, l] = await Promise.all([
        tryApiFetch<WorkerStatus>(WORKER_URL),
        tryApiFetch<LeaseState>(LEASE_URL),
      ]);
      if (!alive) return;
      if (w.ok) { setWorker(w.data); setLoadError(null); } else { setLoadError(w.error); }
      if (l.ok) setLease(l.data);
      setLoading(false);
    };
    void tick();
    const id = setInterval(() => void tick(), UI_TIMEOUTS.runnerLeasePoll);
    return () => { alive = false; clearInterval(id); };
  }, [refreshKey]);

  const dispatch = useCallback(async (action: 'start' | 'stop', body: Record<string, unknown>) => {
    setPending(action);
    setActionError(null);
    setNote(null);
    const r = await tryApiFetch<WorkerStatus>(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setPending(null);
    if (r.ok) {
      setWorker(r.data);
      setNote(r.data.running
        ? `Worker running every ${Math.round(r.data.intervalMs / 1000)}s over ${describeScope(r.data.filter)}.`
        : 'Worker stopped — deferred L3/L4 gates now only move on an operator drain or a test-run settle.');
      setRefreshKey((k) => k + 1);
      return;
    }
    setActionError(r.error);
  }, []);

  if (loading) return <LoadingRow label="Reading drain-worker status…" />;

  const running = worker?.running === true;
  const blindReason = worker
    ? null
    : 'Worker status is unreadable — controls stay disabled until GET /api/pipeline-artifacts/drain/worker answers.';
  const stopReason = blindReason ?? (running ? null : 'The worker is not running — there is nothing to stop.');

  return (
    <section aria-label="Drain worker controls" className="space-y-3">
      {loadError && (
        <InlineErrorRetry message={`Status read failed: ${loadError}`} onRetry={() => setRefreshKey((k) => k + 1)} />
      )}
      {actionError && (
        <InlineErrorRetry
          message={actionError}
          onRetry={() => void dispatch(running ? 'stop' : 'start', running ? { action: 'stop' } : startBody(settings))}
          onDismiss={() => setActionError(null)}
        />
      )}
      {note && (
        <p role="status" data-testid="drain-worker-note" className="text-xs" style={{ color: STATUS_SUCCESS }}>
          {note}
        </p>
      )}

      <SurfaceCard
        level={2}
        className="p-3 space-y-3"
        data-testid="drain-worker-state"
        data-running={String(running)}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <StatusDot state={running ? 'progress' : 'idle'} size="md" label={running ? 'Drain worker running' : 'Drain worker stopped'} />
          <span className="text-xs font-mono uppercase tracking-[0.15em] text-text">
            {running ? 'Running' : 'Stopped'}
          </span>
          {worker?.origin && (
            <MicroLabel mono title="Who started this worker">
              started by {worker.origin === 'autostart' ? 'boot auto-start' : 'an operator'}
            </MicroLabel>
          )}
        </div>

        {worker && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Row label="Interval" value={running ? `${Math.round(worker.intervalMs / 1000)}s` : '—'} />
            <Row label="Ticks" value={String(worker.ticks)} />
            <Row
              label="Last tick"
              value={worker.lastTickAt ? worker.lastTickAt.slice(0, 19).replace('T', ' ') : 'never'}
              title={worker.lastTickAt ?? 'The worker has not completed a tick'}
            />
            <Row label="Scope" value={describeScope(worker.filter)} />
          </div>
        )}

        {worker?.lastSummary ? (
          <div data-testid="drain-worker-summary">
            <MicroLabel as="div" uppercase>Last drain</MicroLabel>
            <div className="text-xs text-text font-mono">
              ran {worker.lastSummary.ran} · passed {worker.lastSummary.passed} · failed {worker.lastSummary.failed}
              {' '}· deferred {worker.lastSummary.deferred} · skipped {worker.lastSummary.skipped}
            </div>
          </div>
        ) : (
          <MicroLabel as="p" tone="muted">
            No tick has drained anything yet — a tick with nothing deferred in scope records no summary.
          </MicroLabel>
        )}

        <div data-testid="drain-worker-lease" data-held={String(lease?.held === true)}>
          <MicroLabel as="div" uppercase>Drain lease</MicroLabel>
          {lease?.held ? (
            <p className="text-xs" style={{ color: STATUS_WARNING }}>
              Held by <span className="font-mono">{lease.scope}</span> since{' '}
              <span className="font-mono">{lease.since?.slice(0, 19).replace('T', ' ')}</span> — the worker will SKIP its
              next tick rather than contend for the non-reentrant editor.
            </p>
          ) : (
            <p className="text-xs text-text-muted">
              Free. Each tick takes this same lease before draining, so the worker and an operator drain can never boot
              the editor at once.
            </p>
          )}
        </div>
      </SurfaceCard>

      <SurfaceCard level={1} className="p-3 space-y-3">
        <h2 className="text-xs font-mono uppercase tracking-[0.15em] text-text">Worker settings</h2>
        <WorkerSettingsForm values={settings} onChange={(p) => setSettings((s) => ({ ...s, ...p }))} disabled={pending !== null} />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm" intent="primary" leftIcon={<Play className="w-3.5 h-3.5" />}
            disabled={blindReason !== null} loading={pending === 'start'} loadingLabel="Starting…"
            data-testid="drain-worker-start"
            onClick={() => void dispatch('start', startBody(settings))}
          >
            {running ? 'Apply & restart' : 'Start worker'}
          </Button>
          <Button
            size="sm" variant="outline" leftIcon={<Square className="w-3.5 h-3.5" />}
            disabled={stopReason !== null} loading={pending === 'stop'} loadingLabel="Stopping…"
            data-testid="drain-worker-stop"
            onClick={() => void dispatch('stop', { action: 'stop' })}
          >
            Stop worker
          </Button>
        </div>
        {stopReason && (
          <p role="note" data-testid="drain-worker-stop-reason" className="max-w-prose">
            <MicroLabel tone="muted">{stopReason}</MicroLabel>
          </p>
        )}
        {settings.executor === 'spawn' && (
          <p role="note" data-testid="drain-worker-spawn-note" className="max-w-prose">
            <MicroLabel tone="muted">
              `spawn` boots a headless editor for L3 gates and is gated separately (allowSpawn + POF_UE_EDITOR_CMD /
              POF_UE_UPROJECT). This toggle does not grant that permission — without it every job is skipped as
              unavailable.
            </MicroLabel>
          </p>
        )}
        <p className="max-w-prose" data-testid="drain-worker-autostart-note">
          <MicroLabel tone="muted">{AUTOSTART_DEFAULT_NOTE}</MicroLabel>
        </p>
      </SurfaceCard>
    </section>
  );
}
