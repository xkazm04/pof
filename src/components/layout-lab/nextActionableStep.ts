/**
 * Per-entity "what next" pick for {@link NextStepCoach}.
 *
 * The ORDER is not decided here — it comes from the ONE shared ladder in
 * `coachLadder.ts` (`fail > drift > pending > deferred > unproduced`), the same
 * function the cross-catalog `GlobalCoach` uses. That is the whole point: both
 * coaches are mounted over the same entity at the same time, so they must never
 * name different steps. This module only adds the per-entity PRESENTATION on top
 * of the shared pick (an action word and a plain-language hint).
 *
 * It is a no-truth-source-needed presentation helper — it just reads the derived
 * per-step status array Baseline computes, plus the optional drift map.
 */

import { pickLadderIssue, type CoachPriority } from './coachLadder';
import type { StepDrift } from './hooks/useEntityArtifacts';
import { coachActionFor, ladderStatusOf, type CoachCta } from './coachSettlement';
import { settlementOf, type Settlement, type SettleSpec, type SettleVerdict } from '@/lib/catalog/stepSettlement';

export type StepStatus = 'pass' | 'fail' | 'deferred' | 'pending' | 'unproduced';

export interface NextActionableStep {
  step: string;
  index: number;
  /** The step's own display status (a `drift` pick still reports pass/fail here). */
  status: StepStatus;
  /** Which rung of the shared ladder surfaced this step. */
  priority: CoachPriority;
  /** Human action word for the coach banner ("Fix" / "Start here" / "Run live test"). */
  actionWord: string;
  /** One-sentence plain-language hint (built from the verdict's own reason when one is known). */
  plainHint: string;
  /** The primary button: jump to the step, or drain its live gate. */
  cta: CoachCta;
  /** The act that settles the pick (`settlementOf`) — present only when its verdict is known. */
  settlement?: Settlement;
}

/** Per-entity phrasing for each ladder rung. `index === 0` gets the friendlier
 *  "Start here" for the two not-yet-finished rungs (nothing precedes it). */
function present(priority: CoachPriority, index: number): { actionWord: string; plainHint: string } {
  // No verdict known → the rung's own copy (the pre-settlement wording, kept for verdict-free callers).
  switch (priority) {
    case 'fail':
      return { actionWord: 'Fix', plainHint: 'This step ran but did not pass — open it to see what to change.' };
    case 'drift':
      return { actionWord: 'Review', plainHint: 'The local and server verdicts disagree here — reconcile them before trusting the rest.' };
    case 'deferred':
      return { actionWord: 'Run live test', plainHint: 'Waiting on a live Unreal run — use “Run deferred gates” to send it.' };
    case 'pending':
      return { actionWord: index === 0 ? 'Start here' : 'Do next', plainHint: 'This step is produced — its acceptance is still resolving.' };
    case 'unproduced':
      return { actionWord: index === 0 ? 'Start here' : 'Do next', plainHint: 'This step has not been produced yet.' };
  }
}

export function pickNextActionableStep(
  steps: string[],
  statusByStep: (step: string, index: number) => StepStatus,
  /** Steps whose local verdict contradicts the server's. Optional — absent → the
   *  `drift` rung is empty and the ladder behaves exactly as it does without it. */
  driftByStep?: ReadonlyMap<string, StepDrift> | ReadonlySet<string>,
  /** The step's verdict (status/tier/reason). Optional — absent → today's picks and copy; present →
   *  the ladder skips rows nothing can settle (as the MCP loop does) and the pick names its act. */
  verdictOf?: (step: string) => SettleVerdict | null | undefined,
  specOf?: (step: string) => SettleSpec | undefined,
): NextActionableStep | null {
  const ranked = verdictOf
    ? (s: string, i: number) => ladderStatusOf(statusByStep(s, i), verdictOf(s), specOf?.(s))
    : statusByStep;
  const issue = pickLadderIssue(steps, ranked, driftByStep);
  if (!issue) return null;
  const status = statusByStep(issue.step, issue.index);
  const verdict = issue.priority === 'drift' ? null : verdictOf?.(issue.step);
  const settlement = verdict ? settlementOf(verdict, specOf?.(issue.step)) : null;
  const base = { step: issue.step, index: issue.index, status, priority: issue.priority };
  if (settlement) return { ...base, ...coachActionFor(settlement, verdict?.reason), settlement };
  return { ...base, ...present(issue.priority, issue.index), cta: issue.priority === 'deferred' ? 'drain' : 'jump' };
}
