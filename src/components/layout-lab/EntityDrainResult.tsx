'use client';

import type { LabTheme } from '@/components/layout-lab/theme';
import { Button } from '@/components/layout-lab/ui/Button';
import { DrainFrameLinks } from '@/components/layout-lab/DrainFrameLinks';
import type { EntityDrainOutcome, EntityGateNote } from '@/components/layout-lab/entityDrainOutcome';

interface Props {
  t: LabTheme;
  outcome: EntityDrainOutcome;
  /** Open a step of THIS entity (a failing/deferred gate's jump target). */
  onJump: (index: number) => void;
  onRetry: () => void;
  onDismiss: () => void;
  /** A retry is already running — the Retry button reflects it. */
  draining?: boolean;
}

/**
 * What the per-entity coach drain actually did — rendered under `<NextStepCoach>` in the work
 * canvas. The drain used to be fire-and-forget: a lease refusal, a server error and a run where
 * no UE editor answered all ended with nothing on screen. This states the counts, each failing
 * (and still-deferred) gate's own reason one click from its step, the captured frames, and for
 * a refused / empty / failed run the reason plus the reachable remedy (Retry). Display only —
 * verdicts are still re-read from the server (the drain invalidates the artifact cache).
 */
export function EntityDrainResult({ t, outcome, onJump, onRetry, onDismiss, draining }: Props) {
  const tone = outcome.state === 'ran'
    ? (outcome.failed > 0 ? t.bad : outcome.deferred > 0 || outcome.skipped > 0 ? t.warn : t.ok)
    : outcome.state === 'refused' ? t.warn : t.bad;
  return (
    <div
      data-testid="entity-drain-result"
      data-drain-state={outcome.state}
      role="status"
      aria-live="polite"
      className={t.fontMono}
      style={{
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8,
        padding: '8px 12px', marginBottom: 16, fontSize: 13,
        borderLeft: `4px solid ${tone}`, background: t.panel, color: t.text,
      }}
    >
      <span data-testid="entity-drain-message" style={{ flex: '1 1 320px', color: tone === t.ok ? t.text : tone }}>
        {outcome.message}
      </span>
      {outcome.retryable && (
        <Button mono onClick={onRetry} disabled={draining} data-testid="entity-drain-retry"
          ariaLabel="Retry the deferred-gate drain for this entity">
          {draining ? 'Running…' : 'Retry'}
        </Button>
      )}
      <Button mono onClick={onDismiss} data-testid="entity-drain-dismiss"
        ariaLabel="Dismiss this drain result" style={{ padding: '2px 6px', fontSize: 12 }}>
        ✕ Dismiss
      </Button>
      {outcome.state === 'ran' && outcome.fails.length > 0 && (
        <GateNotes t={t} testId="entity-drain-fails" tone={t.bad} notes={outcome.fails} onJump={onJump} />
      )}
      {outcome.state === 'ran' && outcome.deferrals.length > 0 && (
        <GateNotes t={t} testId="entity-drain-deferrals" tone={t.warn} notes={outcome.deferrals} onJump={onJump} />
      )}
      <DrainFrameLinks t={t} frames={outcome.frames} testIdPrefix="entity-drain" />
    </div>
  );
}

/** One row per gate — step, the runner's own reason, and a jump to that step when it is in the list. */
function GateNotes({ t, testId, tone, notes, onJump }: {
  t: LabTheme; testId: string; tone: string; notes: EntityGateNote[]; onJump: (index: number) => void;
}) {
  return (
    <ul data-testid={testId} style={{ listStyle: 'none', margin: 0, padding: 0, flexBasis: '100%', display: 'flex', flexDirection: 'column', gap: 4 }}>
      {notes.map((n) => (
        <li key={n.step} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: tone }}>
          <span style={{ color: t.inkDeep, fontWeight: 600 }}>{n.step}</span>
          <span style={{ flex: 1 }}>— {n.reason}</span>
          {n.index !== null && (
            <Button mono onClick={() => onJump(n.index!)} data-testid="entity-drain-open-step"
              ariaLabel={`Open step ${n.step}`} style={{ padding: '2px 6px', fontSize: 12 }}>
              Open step →
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}
