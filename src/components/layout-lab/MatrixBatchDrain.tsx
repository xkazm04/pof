'use client';

import { drainFrameLabel, drainFrameUrl } from '@/lib/test-gate-runner/frameUrl';
import type { LabTheme } from './theme';
import { Button } from './ui/Button';
import type { BatchGateNote } from './batchDrainModel';
import type { BatchDrainState, BatchEntity } from './hooks/useBatchDrain';

interface Props {
  t: LabTheme;
  /** Entities in this catalog that currently have ≥1 deferred gate. */
  deferredEntities: BatchEntity[];
  state: BatchDrainState;
  onStart: () => void;
  onCancel: () => void;
  /** Dismiss the finished run's summary — without it the last run pins in the header forever. */
  onDismiss: () => void;
}

/**
 * Matrix header action: drain every deferred gate across a whole catalog in one click.
 * The button only appears when the catalog has ≥1 deferred artifact. The whole set is
 * drained in ONE request (one editor boot for every gate), so while running it shows a
 * single-boot progress note; when done it reports the flips (deferred → pass/fail) with
 * per-step fail AND deferral reasons, any locked/errored entities, and links to every
 * rendered L4 frame the run captured (so a human can judge the render, which is the whole
 * reason the runner hoists them) — no silent skips. The finished summary
 * is DISMISSIBLE (and the next run replaces it), so a stale run can't masquerade as current
 * state. Cancel is honest AND legible: the click flips a visible REQUESTED state, the panel
 * states in the open what cancel can and cannot stop (the in-flight boot can't be interrupted;
 * only the retry after a lease conflict can be skipped), and when the run resolves it reports
 * which of the two actually happened — including "nothing left to skip".
 * The batch request + lease handling lives in `useBatchDrain`.
 */
export function MatrixBatchDrain({ t, deferredEntities, state, onStart, onCancel, onDismiss }: Props) {
  const { running, cancelRequested, cancelEffect, summary, total } = state;
  // Hide entirely when there's nothing to drain and no run to report.
  if (deferredEntities.length === 0 && !running && !summary) return null;

  return (
    <div
      data-testid="batch-drain"
      className={t.fontMono}
      style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontSize: 13, color: t.muted }}
    >
      {running ? (
        <>
          <span data-testid="batch-drain-progress" aria-live="polite" style={{ color: t.text }}>
            Draining {total} set{total > 1 ? 's' : ''} in one editor boot…
          </span>
          {/* Cancel now has a REQUESTED state. The click used to flip nothing at all — the ref it
              set is only read around the 409 retry — so an operator watching a headless UE boot
              had no way to tell the request had landed. It still cannot abort the boot; it says so. */}
          <Button mono onClick={onCancel} data-testid="batch-drain-cancel"
            disabled={cancelRequested}
            style={cancelRequested ? { opacity: 0.65, cursor: 'default', color: t.warn } : undefined}
            ariaLabel={cancelRequested
              ? 'Cancel requested — the running editor boot cannot be interrupted; the retry will be skipped'
              : "Cancel batch drain (skips the retry only — the running boot can't be interrupted)"}
            title="The batch runs in one editor boot and can't be interrupted mid-run; this only skips the retry after a lease conflict.">
            {cancelRequested ? '⏳ Cancel requested' : 'Cancel'}
          </Button>
          {/* What cancel CAN and CANNOT stop, in the open — not only in a hover title. */}
          <span data-testid="batch-drain-cancel-scope" role="status" aria-live="polite"
            style={{ flexBasis: '100%', fontSize: 12, color: cancelRequested ? t.warn : t.muted }}>
            {cancelRequested
              ? 'Cancel requested. The editor boot already running cannot be interrupted — it will finish. What the cancel does stop is the automatic retry after a lease conflict.'
              : "Cancel can't interrupt the running editor boot; it only skips the automatic retry after a lease conflict."}
          </span>
        </>
      ) : (
        deferredEntities.length > 0 && (
          <Button
            mono
            variant="accent"
            onClick={onStart}
            data-testid="batch-drain-start"
            ariaLabel={`Drain deferred gates for ${deferredEntities.length} entit${deferredEntities.length > 1 ? 'ies' : 'y'}`}
          >
            ⏵ Drain {deferredEntities.length} deferred set{deferredEntities.length > 1 ? 's' : ''}
          </Button>
        )
      )}

      {/* What the cancel ACTUALLY achieved. A cancel that arrived after the batch's only
          attempt had resolved stopped nothing — saying "cancelled" there would credit the
          click with an interruption that never happened. */}
      {!running && cancelEffect && (
        <span data-testid="batch-drain-cancel-outcome" role="status" aria-live="polite"
          style={{ flexBasis: '100%', fontSize: 12, color: t.warn }}>
          {cancelEffect === 'skipped-retry'
            ? 'Cancel took effect: the retry after the lease conflict was skipped. The editor boot that was already running still finished.'
            : 'Cancel had nothing left to skip — the batch had already spent its single attempt, so the run completed as it would have anyway.'}
        </span>
      )}

      {/* Summary of flips — visible during (live counts) and after the run. */}
      {summary && (
        <span data-testid="batch-drain-summary" role="status" aria-live="polite" style={{ display: 'inline-flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ color: summary.passed ? t.ok : t.muted }}>{summary.passed} passed</span>
          <span style={{ color: summary.failed ? t.bad : t.muted }}>{summary.failed} failed</span>
          {/* deferred ≠ skipped. A DEFERRED gate ran and could not decide (judge outage, test
              planned but not registered); a SKIPPED gate never ran at all. Labelling skipped
              gates "still deferred" hid both facts behind one wrong word. */}
          {summary.deferred > 0 && (
            <span style={{ color: t.warn }} title="Ran but could not decide — judge outage, or the test is planned but not registered in UE">
              {summary.deferred} deferred
            </span>
          )}
          {summary.skipped > 0 && (
            <span title="Never ran — no available executor, no test name, or the run limit was reached">
              {summary.skipped} skipped
            </span>
          )}
          {summary.entitiesLocked > 0 && <span style={{ color: t.warn }} title="Skipped — another drain held the lease after a retry">{summary.entitiesLocked} locked</span>}
          {summary.entitiesLocked > 0 && (
            <span data-testid="batch-drain-locked-hint" style={{ color: t.muted, flexBasis: '100%', fontSize: 12 }}>
              Lease held by another session — see the runner chip in the header.
            </span>
          )}
          {summary.entitiesErrored > 0 && <span style={{ color: t.bad }} title="Drain request errored">{summary.entitiesErrored} errored</span>}
          {/* Dismiss — a finished run's counters used to pin in the header forever, so a stale
              summary read as the CURRENT state of the catalog. The next run clears it too. */}
          {!running && (
            <Button mono onClick={onDismiss} data-testid="batch-drain-dismiss"
              ariaLabel="Dismiss this drain summary"
              title="Dismiss this drain summary (the next run clears it too)."
              style={{ padding: '2px 6px', fontSize: 12 }}>
              ✕ Dismiss
            </Button>
          )}
        </span>
      )}

      {/* Per-step fail reasons — the checker's own words, never hidden. */}
      {!running && summary && summary.fails.length > 0 && (
        <ReasonList t={t} testId="batch-drain-fails" tone={t.bad} notes={summary.fails} />
      )}

      {/* Per-step DEFERRAL reasons — a gate that ran and couldn't decide owes an explanation
          just as much as a fail does; these used to be dropped entirely. */}
      {!running && summary && summary.deferrals.length > 0 && (
        <ReasonList t={t} testId="batch-drain-deferrals" tone={t.warn} notes={summary.deferrals} />
      )}

      {/* Captured L4 frames — the runner hoists these so a human LOOKS; make them openable. */}
      {!running && summary && summary.screenshots.length > 0 && (
        <div data-testid="batch-drain-frames" style={{ flexBasis: '100%', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 12, color: t.muted }}>
            {summary.screenshots.length} captured frame{summary.screenshots.length > 1 ? 's' : ''} — open one and judge the render yourself:
          </span>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {summary.screenshots.map((shot) => {
              const label = drainFrameLabel(shot);
              return (
                <li key={shot}>
                  <a href={drainFrameUrl(shot)} target="_blank" rel="noreferrer"
                    data-testid="batch-drain-frame-link" title={shot}
                    className="focus-ring"
                    style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: t.ink, textDecoration: 'none' }}>
                    <img src={drainFrameUrl(shot)} alt={`Captured gate frame ${label}`}
                      loading="lazy" width={128} height={72}
                      style={{ width: 128, height: 72, objectFit: 'cover', border: `1px solid ${t.line}`, borderRadius: t.glass ? 4 : 0, background: t.panel }} />
                    <span style={{ maxWidth: 128, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

/** One reason row per gate — entity · step — the runner's own words. Shared by the fail
 *  and deferral lists so both are surfaced identically (only the tone differs). */
function ReasonList({ t, testId, tone, notes }: { t: LabTheme; testId: string; tone: string; notes: BatchGateNote[] }) {
  return (
    <ul data-testid={testId} style={{ listStyle: 'none', margin: 0, padding: 0, flexBasis: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
      {notes.map((n) => (
        <li key={`${n.entityId}:${n.step}`} style={{ fontSize: 12, color: tone }}>
          <span style={{ color: t.inkDeep, fontWeight: 600 }}>{n.entityName}</span>
          <span style={{ color: t.muted }}> · {n.step} — </span>
          {n.reason}
        </li>
      ))}
    </ul>
  );
}
