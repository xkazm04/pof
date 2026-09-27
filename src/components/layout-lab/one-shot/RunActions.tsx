'use client';

import { useOneShotJobStore } from '@/stores/oneShotJobStore';
import { failedStepCount, nextActions, remainingStepCount, type NextAction } from '@/lib/one-shot/next-actions';
import type { LabTheme } from '../theme';
import { LabButton } from '../steps/controls';

interface Props {
  t: LabTheme;
  onAction: (a: NextAction) => void;
}

/**
 * The job's forward actions for every non-idle phase (from the pure `nextActions`): Cancel
 * while in flight; Resume / Retry failed / Start over once a run has stopped — so no phase
 * of the one-shot panel is a dead end. A stopped run names why it stopped.
 */
export function RunActions({ t, onAction }: Props) {
  const phase = useOneShotJobStore((s) => s.phase);
  const stepResults = useOneShotJobStore((s) => s.stepResults);
  const draftEntityId = useOneShotJobStore((s) => s.draftEntityId);
  const totalSteps = useOneShotJobStore((s) => s.totalSteps);
  const failureReason = useOneShotJobStore((s) => s.failureReason);

  const state = { phase, stepResults, draftEntityId, totalSteps, failureReason };
  const actions = nextActions(state).filter((a) => a !== 'start');
  if (actions.length === 0) return null;

  const failed = failedStepCount(state);
  const label = (a: NextAction): string => {
    switch (a) {
      case 'cancel': return 'Cancel';
      case 'resume': return remainingStepCount(state) === null ? 'Resume' : `Resume from step ${stepResults.length + 1}`;
      case 'retryFailed': return `Retry ${failed} failed step${failed === 1 ? '' : 's'}`;
      default: return 'Start over';
    }
  };

  return (
    <div style={{ marginTop: 16 }}>
      {phase === 'failed' && failureReason && (
        <div className={t.fontMono} style={{ fontSize: 12, color: t.bad, marginBottom: 8 }}>
          Stopped: {failureReason}
        </div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {actions.map((a) => (
          <LabButton key={a} t={t} testId={`one-shot-action-${a}`} onClick={() => onAction(a)}>
            {label(a)}
          </LabButton>
        ))}
      </div>
    </div>
  );
}
