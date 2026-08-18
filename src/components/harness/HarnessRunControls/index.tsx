'use client';

import { useCallback, useState } from 'react';
import { Play, Pause, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { LoadingRow } from '@/components/ui/LoadingRow';
import { MicroLabel } from '@/components/ui/MicroLabel';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { InlineErrorRetry } from '@/components/modules/shared/InlineErrorRetry';
import { useSuspendableEffect } from '@/hooks/useSuspend';
import { tryApiFetch } from '@/lib/api-utils';
import { UI_TIMEOUTS } from '@/lib/constants';
import { STATUS_SUCCESS } from '@/lib/chart-colors';
import { useProjectStore } from '@/stores/projectStore';
import { RunStatePanel } from './RunStatePanel';
import { StartForm } from './StartForm';
import {
  startGuard, pauseGuard, resumeGuard, buildStartBody, PAUSE_PROCESS_CAVEAT, type ControlGuard,
} from './controlGuards';
import { EMPTY_START_FORM, type HarnessStatusResponse, type StartFormValues } from './types';

type Action = 'start' | 'pause' | 'resume';

interface Attempt { action: Action; body: Record<string, unknown> }

/** A disabled control always says why, in text — a `title` on a disabled button is not reachable. */
function GuardNote({ guard, testId }: { guard: ControlGuard; testId: string }) {
  if (guard.enabled || !guard.reason) return null;
  return (
    <p role="note" data-testid={testId} className="mt-1 max-w-prose">
      <MicroLabel tone="muted">{guard.reason}</MicroLabel>
    </p>
  );
}

/**
 * Operator controls for the autonomous harness — start, pause and resume over the
 * EXISTING `/api/harness` route (the same one the MCP tools proxy), plus the live
 * run state while a run is in flight. No engine logic is duplicated here: every
 * button is one POST the route already implements.
 *
 * Three honesty rules the panel keeps:
 *   1. A control the API would refuse is DISABLED with the refusal spelled out
 *      (see `controlGuards`), never a button that silently 409s.
 *   2. When the status read itself fails, every control is disabled — the panel
 *      refuses to guess a run state it cannot see.
 *   3. A pause refused because the run lives on another server process reports the
 *      known cross-process defect verbatim instead of papering over it.
 */
export function HarnessRunControls() {
  const [status, setStatus] = useState<HarnessStatusResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [form, setForm] = useState<StartFormValues>(EMPTY_START_FORM);
  const [pending, setPending] = useState<Action | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [lastAttempt, setLastAttempt] = useState<Attempt | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [confirmStart, setConfirmStart] = useState(false);

  const runInFlight = status?.status === 'running';

  // Suspend-safe polling: a hidden panel stops polling entirely, and an idle
  // server is polled on the slow cadence — the fast one is only for a live run.
  useSuspendableEffect(() => {
    let alive = true;
    const tick = async () => {
      const r = await tryApiFetch<HarnessStatusResponse>('/api/harness');
      if (!alive) return;
      if (r.ok) { setStatus(r.data); setLoadError(null); } else { setLoadError(r.error); }
      setLoading(false);
    };
    void tick();
    const id = setInterval(() => void tick(), runInFlight ? UI_TIMEOUTS.pollInterval : UI_TIMEOUTS.schedulePoll);
    return () => { alive = false; clearInterval(id); };
  }, [runInFlight, refreshKey]);

  const dispatch = useCallback(async (attempt: Attempt) => {
    setPending(attempt.action);
    setActionError(null);
    setNote(null);
    setLastAttempt(attempt);
    const r = await tryApiFetch<{ status: string; message?: string }>('/api/harness', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(attempt.body),
    });
    setPending(null);
    if (r.ok) {
      setNote(r.data.message ?? r.data.status);
      setRefreshKey((k) => k + 1);
      return;
    }
    // A pause refused as "not running" while the status read says running is the
    // known cross-process defect — name it rather than leaving a bare 409.
    setActionError(
      attempt.action === 'pause' && /not running/i.test(r.error)
        ? `${r.error}. ${PAUSE_PROCESS_CAVEAT}`
        : r.error,
    );
  }, []);

  const useCurrentProject = useCallback(() => {
    // Read on click (not during render) so the persisted store can't desync SSR.
    const p = useProjectStore.getState();
    setForm((f) => ({ ...f, projectPath: p.projectPath, projectName: p.projectName, ueVersion: p.ueVersion }));
  }, []);

  if (loading) return <LoadingRow label="Reading harness status…" />;

  const runStatus = status?.status ?? 'idle';
  const blind: ControlGuard | null = status
    ? null
    : { enabled: false, reason: 'Harness status is unreadable — controls stay disabled until GET /api/harness answers.' };
  const start = blind ?? startGuard(runStatus, form);
  const pause = blind ?? pauseGuard(runStatus);
  const resume = blind ?? resumeGuard(runStatus, form.statePath);
  const rehydrating = !blind && 'mode' in resume && resume.mode === 'rehydrate';

  return (
    <section aria-label="Harness run controls" className="space-y-3">
      {loadError && (
        <InlineErrorRetry message={`Status read failed: ${loadError}`} onRetry={() => setRefreshKey((k) => k + 1)} />
      )}
      {actionError && (
        <InlineErrorRetry
          message={actionError}
          onRetry={() => { if (lastAttempt) void dispatch(lastAttempt); }}
          onDismiss={() => setActionError(null)}
        />
      )}
      {note && (
        <p role="status" data-testid="harness-action-note" className="text-xs" style={{ color: STATUS_SUCCESS }}>
          {note}
        </p>
      )}

      {status && <RunStatePanel status={status} />}

      <SurfaceCard level={1} className="p-3 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm" variant="outline" leftIcon={<Pause className="w-3.5 h-3.5" />}
            disabled={!pause.enabled} loading={pending === 'pause'} loadingLabel="Pausing…"
            data-testid="harness-pause"
            onClick={() => void dispatch({ action: 'pause', body: { action: 'pause' } })}
          >
            Pause
          </Button>
          <Button
            size="sm" variant="outline" leftIcon={<RotateCw className="w-3.5 h-3.5" />}
            disabled={!resume.enabled} loading={pending === 'resume'} loadingLabel="Resuming…"
            data-testid="harness-resume"
            onClick={() => void dispatch({
              action: 'resume',
              body: { action: 'resume', ...(form.statePath.trim() ? { statePath: form.statePath.trim() } : {}) },
            })}
          >
            {rehydrating ? 'Resume (rehydrate from disk)' : 'Resume'}
          </Button>
        </div>
        <GuardNote guard={pause} testId="harness-pause-reason" />
        <GuardNote guard={resume} testId="harness-resume-reason" />
        {pause.enabled && (
          <p data-testid="harness-pause-caveat" className="max-w-prose">
            <MicroLabel tone="muted">{PAUSE_PROCESS_CAVEAT}</MicroLabel>
          </p>
        )}
      </SurfaceCard>

      <SurfaceCard level={1} className="p-3 space-y-3">
        <h2 className="text-xs font-mono uppercase tracking-[0.15em] text-text">Start a run</h2>
        <StartForm
          values={form}
          onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
          onUseCurrentProject={useCurrentProject}
          disabled={pending !== null}
        />
        <div>
          <Button
            size="md" intent="primary" leftIcon={<Play className="w-3.5 h-3.5" />}
            disabled={!start.enabled} loading={pending === 'start'} loadingLabel="Starting…"
            data-testid="harness-start"
            onClick={() => setConfirmStart(true)}
          >
            Start run
          </Button>
          <GuardNote guard={start} testId="harness-start-reason" />
        </div>
      </SurfaceCard>

      <ConfirmDialog
        open={confirmStart}
        onClose={() => setConfirmStart(false)}
        onConfirm={() => void dispatch({ action: 'start', body: buildStartBody(form) })}
        title="Start an autonomous run?"
        destructive={false}
        confirmLabel="Yes, start the run"
        description={
          <>
            The harness will spawn Claude CLI sessions against{' '}
            <span className="font-mono text-text">{form.projectPath || '—'}</span> and spend real money —{' '}
            {form.unlimited
              ? 'with NO spend cap at all.'
              : form.budgetUsd.trim()
                ? `capped at $${form.budgetUsd.trim()}.`
                : 'capped at the default budget the route applies.'}{' '}
            A start pointed at an existing state path resumes that run rather than forking a new one.
          </>
        }
      />
    </section>
  );
}
