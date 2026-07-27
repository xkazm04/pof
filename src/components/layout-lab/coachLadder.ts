/**
 * ONE priority ladder for every "what should I do next?" coach in the lab.
 *
 * Two coaches are mounted over the same entity at the same time — the per-entity
 * {@link NextStepCoach} (in the work canvas) and the cross-catalog
 * {@link GlobalCoach} (above the Baseline view). They used to run two DIFFERENT
 * ladders, so the same entity could be told to do two different things:
 *
 *   - `pickNextActionableStep` (old): fail > (unproduced | pending, by index) > deferred
 *   - `pickEntityIssue` (old):        fail > drift > pending > deferred > unproduced
 *
 * ### The unified order — and why
 *
 * `fail` › `drift` › `pending` › `deferred` › `unproduced`
 *
 * 1. **fail** — a failed gate blocks everything downstream; fixing it is always the
 *    highest-value move.
 * 2. **drift** — the local and server verdicts genuinely disagree. Until it is
 *    reconciled, every OTHER status on this entity is suspect, so it outranks all
 *    work. (The old per-entity ladder simply had no place for drift and therefore
 *    silently coached against a status it could not trust.)
 * 3. **pending** — produced, acceptance still resolving: real in-flight work.
 * 4. **deferred** — produced, waiting on a live Unreal run. Below `pending` because
 *    it is not locally actionable (it needs a drain), but ABOVE `unproduced`
 *    because the work exists and only needs to be finished.
 * 5. **unproduced** — nothing has ever run here. Ranked LAST on purpose: finishing
 *    started work always beats starting something new, and this is also the honest
 *    replacement for the old lifecycle-fraction pseudo-progress, so it must never
 *    read as work-in-flight.
 *
 * The order is data (`COACH_LADDER`), not control flow, so a change here changes
 * BOTH coaches at once — they cannot drift apart again.
 */

import type { StepDisplayStatus, StepDrift } from './hooks/useEntityArtifacts';

export type CoachPriority = 'fail' | 'drift' | 'pending' | 'deferred' | 'unproduced';

/** The single documented ladder, most urgent first. */
export const COACH_LADDER: readonly CoachPriority[] = ['fail', 'drift', 'pending', 'deferred', 'unproduced'] as const;

/** Lower rank = more urgent. Derived from {@link COACH_LADDER} so there is one source. */
export const COACH_PRIORITY_RANK: Record<CoachPriority, number> = COACH_LADDER.reduce(
  (acc, p, i) => { acc[p] = i; return acc; },
  {} as Record<CoachPriority, number>,
);

export interface CoachHint {
  /** Color+glyph status token (glyph is the primary, colorblind-safe signal). */
  glyph: string;
  /** Imperative verb for the row ("Fix" / "Review" / "Produce" / "Run live test"). */
  actionWord: string;
  /** One plain-language sentence explaining why this step surfaced. */
  hint: string;
}

export const COACH_HINT: Record<CoachPriority, CoachHint> = {
  fail: { glyph: '✕', actionWord: 'Fix', hint: 'a gate failed here — open it to see what to change' },
  drift: { glyph: '≠', actionWord: 'Review', hint: 'the local and server verdicts disagree — reconcile them' },
  pending: { glyph: '○', actionWord: 'Produce', hint: 'this step is produced — its acceptance is still resolving' },
  deferred: { glyph: '⏸', actionWord: 'Run live test', hint: 'waiting on a live Unreal run — drain its gate' },
  unproduced: { glyph: '·', actionWord: 'Start', hint: 'not produced yet — nothing has run here' },
};

/** One rung of the ladder resolved against a concrete entity. */
export interface LadderIssue {
  step: string;
  index: number;
  priority: CoachPriority;
}

/**
 * Walk {@link COACH_LADDER} rung by rung and return the FIRST step (by pipeline
 * index) matching the most urgent rung present — or `null` when the entity has
 * nothing actionable left.
 *
 * `driftByStep` is optional so a caller with no server comparison (a plain
 * status-only view) keeps working: absent → the `drift` rung is simply empty.
 */
export function pickLadderIssue(
  steps: string[],
  statusByStep: (step: string, i: number) => StepDisplayStatus,
  driftByStep?: ReadonlyMap<string, StepDrift> | ReadonlySet<string>,
): LadderIssue | null {
  const isDrift = (step: string) => !!driftByStep?.has(step);
  for (const priority of COACH_LADDER) {
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const hit = priority === 'drift' ? isDrift(step) : statusByStep(step, i) === priority;
      if (hit) return { step, index: i, priority };
    }
  }
  return null;
}
