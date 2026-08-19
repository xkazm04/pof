'use client';

import { useCallback, useEffect, useState } from 'react';
import { logger } from '@/lib/logger';
import { LoadingRow } from '@/components/ui/LoadingRow';
import { InlineErrorRetry } from '@/components/modules/shared/InlineErrorRetry';
import { StatusTag } from '@/components/ui/StatusTag';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { fetchHistory, fetchRun, deleteRun } from './client';
import type { ExperimentRunSummary, ExperimentRunDetail } from '@/lib/ue-experiment/experiment-db';

/** A judge that could not run is WARN (deferred), never the red an observed defect earns. */
const VERDICT_LEVEL = { pass: 'ok', fail: 'bad', deferred: 'warn' } as const;

/** History list + A-B compare for past experiment runs. Re-fetches when refreshKey changes. */
export function ExperimentHistory({ refreshKey = 0 }: { refreshKey?: number }) {
  const [runs, setRuns] = useState<ExperimentRunSummary[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  /** The (refresh, retry) generation whose fetch has SETTLED. `loading` is derived from it
   *  rather than set at the top of the effect — `react-hooks/set-state-in-effect` errors on
   *  the latter, and a derived flag can't drift out of sync with the request it describes. */
  const [settledKey, setSettledKey] = useState<string | null>(null);
  const [aId, setAId] = useState<string | null>(null);
  const [bId, setBId] = useState<string | null>(null);
  const [a, setA] = useState<ExperimentRunDetail | null>(null);
  const [b, setB] = useState<ExperimentRunDetail | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // The empty state ("no past runs") is only honest once a load has actually
  // succeeded — while in flight we show a spinner, and a failure explains itself
  // with a Retry instead of masquerading as "you have no history".
  const loadKey = `${refreshKey}:${retryKey}`;
  const loading = settledKey !== loadKey;

  useEffect(() => {
    let live = true;
    fetchHistory()
      .then((r) => { if (live) { setRuns(r); setLoadError(null); } })
      .catch((e) => {
        logger.error('history fetch failed', e);
        if (live) setLoadError(e instanceof Error ? e.message : 'Could not load run history.');
      })
      .finally(() => { if (live) setSettledKey(loadKey); });
    return () => { live = false; };
  }, [loadKey]);

  // Fetch detail when a slot is assigned (never clears state synchronously — the
  // compare render guards on id match, so a deselected/changed slot just stops matching).
  useEffect(() => { if (aId) fetchRun(aId).then(setA).catch(() => undefined); }, [aId]);
  useEffect(() => { if (bId) fetchRun(bId).then(setB).catch(() => undefined); }, [bId]);

  const pick = useCallback((slot: 'a' | 'b', id: string) => {
    (slot === 'a' ? setAId : setBId)((cur) => (cur === id ? null : id));
  }, []);

  const onConfirmDelete = useCallback(async () => {
    if (!pendingDelete) return;
    try {
      await deleteRun(pendingDelete);
      setDeleteError(null);
      setPendingDelete(null);
      setRetryKey((k) => k + 1); // re-list
    } catch (e) {
      // A delete that failed must SAY so — the row silently reappearing on the next load would
      // read as the app ignoring the action.
      logger.error('experiment run delete failed', e);
      setPendingDelete(null);
      setDeleteError(e instanceof Error ? e.message : 'Could not delete that run.');
    }
  }, [pendingDelete]);

  const showCompare = a && b && a.id === aId && b.id === bId;

  if (loading) return <LoadingRow label="Loading run history…" variant="inline" className="text-xs" />;
  if (loadError) return <InlineErrorRetry dense message={loadError} onRetry={() => setRetryKey((k) => k + 1)} />;
  if (runs.length === 0) return <p className="text-2xs text-text-muted">No past runs yet — run an experiment to start the history.</p>;

  return (
    <section className="space-y-3" aria-label="experiment history">
      <h2 className="text-sm font-semibold">History &amp; compare</h2>
      <p className="text-2xs text-text-muted">Pick an A and a B run to see their results side by side.</p>
      <div className="max-h-56 space-y-1 overflow-auto">
        {runs.map((r) => (
          <div key={r.id} className="flex items-center gap-2 rounded bg-surface p-2 text-xs">
            <span className={r.ok ? 'text-emerald-500' : 'text-red-500'} aria-hidden>{r.ok ? '✓' : '✗'}</span>
            <span className="sr-only">{r.ok ? 'ran' : 'failed'}</span>
            <span className="rounded bg-background px-1 text-2xs text-text-muted">{r.mode}</span>
            <span className="flex-1 truncate font-mono" title={r.label}>{r.label}</span>
            {/* Evidence state on the ROW: a run whose capture is gone says so here, rather than
                being discovered as a broken image inside the compare view. */}
            {r.captureState === 'missing' && (
              <span className="rounded bg-amber-500/10 px-1 text-2xs text-amber-500" title="The captured frame is no longer on disk — any visual verdict on this run cannot be audited.">
                capture gone
              </span>
            )}
            <span className="text-2xs text-text-muted">{Math.round(r.durationMs / 1000)}s</span>
            <button type="button" onClick={() => pick('a', r.id)} aria-pressed={aId === r.id} className={`focus-ring rounded px-1.5 ${aId === r.id ? 'bg-emerald-600 text-white' : 'bg-background text-text-muted'}`} aria-label={`Compare "${r.label}" as A`}>A</button>
            <button type="button" onClick={() => pick('b', r.id)} aria-pressed={bId === r.id} className={`focus-ring rounded px-1.5 ${bId === r.id ? 'bg-emerald-600 text-white' : 'bg-background text-text-muted'}`} aria-label={`Compare "${r.label}" as B`}>B</button>
            {/* Retention is unbounded on purpose (an old baseline stays comparable); deletion is
                explicit, and takes the capture with the row. */}
            <button
              type="button"
              onClick={() => setPendingDelete(r.id)}
              className="focus-ring rounded px-1.5 text-text-muted hover:text-red-500"
              aria-label={`Delete run "${r.label}"`}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {showCompare && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" aria-label="compare">
          <CompareColumn run={a} slot="A" />
          <CompareColumn run={b} slot="B" />
        </div>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={onConfirmDelete}
        title="Delete this run?"
        description="The run row and its captured frame are removed permanently. Experiments are otherwise kept indefinitely, so an old baseline stays available to compare against."
        confirmLabel="Delete run"
      />
      {deleteError && <InlineErrorRetry dense message={deleteError} onRetry={onConfirmDelete} />}
    </section>
  );
}

/**
 * A recorded capture that is gone. The `<img>` used to render regardless (a broken image with
 * no explanation) while the verdict text beside it kept asserting "visual: pass". The verdict is
 * NOT deleted — it is labelled unauditable, so it stops standing on its own.
 */
function MissingCaptureNote({ judged }: { judged: boolean }) {
  return (
    <p className="rounded border border-amber-500/40 bg-amber-500/5 p-1.5 text-2xs text-amber-500">
      Capture no longer on disk.
      {judged ? ' The visual verdict above is UNAUDITABLE — the frame it judged cannot be re-read.' : ''}
    </p>
  );
}

function CompareColumn({ run, slot }: { run: ExperimentRunDetail; slot: string }) {
  const s = run.observationSummary;
  return (
    <div className="space-y-2 rounded border border-border p-3 text-xs">
      <div className="flex items-center gap-2">
        <span className="rounded bg-surface px-1.5 py-0.5 font-semibold">{slot}</span>
        <span className={run.ok ? 'text-emerald-500' : 'text-red-500'}>{run.ok ? '✓ ran' : '✗ failed'}</span>
        <span className="text-text-muted">{Math.round(run.durationMs / 1000)}s</span>
      </div>
      <div className="truncate font-mono text-2xs text-text-muted" title={run.label}>{run.label}</div>
      {run.behavioralVerdict && (
        <div className="flex items-center gap-1.5">
          <span className="text-text-muted">behavior</span>
          <StatusTag level={run.behavioralVerdict.status === 'pass' ? 'ok' : 'bad'} word={run.behavioralVerdict.status} />
          <span className="truncate text-text-muted" title={run.behavioralVerdict.detail}>{run.behavioralVerdict.detail}</span>
        </div>
      )}
      {run.verdict && (
        <div className="flex items-center gap-1.5">
          <span className="text-text-muted">visual</span>
          {/* deferred = the judge never ran; it must not read as either a pass or a fail. */}
          <StatusTag level={VERDICT_LEVEL[run.verdict.status]} word={run.verdict.status} />
        </div>
      )}
      {run.verdict?.status === 'deferred' && <div className="text-2xs text-text-muted">{run.verdict.detail}</div>}
      {s && (
        <div className="text-2xs text-text-muted">samples {s.sampleCount} · maxSpeed {s.maxSpeed.toFixed(0)} · disp {s.displacement.toFixed(0)} · montage {s.montagePlayed ? 'yes' : 'no'}</div>
      )}
      {Object.keys(run.markers).length > 0 && (
        <pre className="overflow-x-auto rounded bg-surface p-1.5 font-mono text-2xs">{Object.entries(run.markers).map(([k, v]) => `${k}=${v}`).join('\n')}</pre>
      )}
      {run.captureState === 'present' && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/api/experiment/screenshot/${run.id}`} alt={`run ${slot} frame`} className="max-w-full rounded border border-border" />
      )}
      {run.captureState === 'missing' && <MissingCaptureNote judged={!!run.verdict} />}
    </div>
  );
}
