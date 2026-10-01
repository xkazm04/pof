/**
 * The one-shot job's forward actions, as a pure function of its state — so no phase is a dead
 * end: idle can start, every in-flight phase can be cancelled, and every terminal phase can be
 * resumed (a draft with unrecorded steps), retried (failed steps) or started over.
 */
import { IN_FLIGHT_PHASES, type OneShotJobState } from '@/stores/oneShotJobStore';

export type NextAction = 'start' | 'cancel' | 'resume' | 'retryFailed' | 'startOver';

export type NextActionsInput = Pick<OneShotJobState, 'phase'> &
  Partial<Pick<OneShotJobState, 'stepResults' | 'draftEntityId' | 'totalSteps' | 'failureReason'>>;

export function failedStepCount(s: NextActionsInput): number {
  return (s.stepResults ?? []).filter((r) => r.outcome === 'fail').length;
}

/** Unrecorded steps of the run; `null` when the total is unknown (an older persisted job). */
export function remainingStepCount(s: NextActionsInput): number | null {
  if (!s.totalSteps) return null;
  return Math.max(0, s.totalSteps - (s.stepResults ?? []).length);
}

export function nextActions(s: NextActionsInput): NextAction[] {
  if (s.phase === 'idle') return ['start'];
  if (IN_FLIGHT_PHASES.includes(s.phase)) return ['cancel'];
  if (s.phase === 'analyzed') return ['startOver'];
  const out: NextAction[] = [];
  const remaining = remainingStepCount(s);
  // Only an interrupted run resumes; a completed run recorded every step it had.
  if (s.phase === 'failed' && s.draftEntityId && remaining !== 0) out.push('resume');
  if (s.draftEntityId && failedStepCount(s) > 0) out.push('retryFailed');
  out.push('startOver');
  return out;
}
