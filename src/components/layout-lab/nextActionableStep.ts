/**
 * Pure helper that picks the next actionable step for an entity from the same
 * artifact data PipelineRollup already derives. Priority order:
 *   1. The first FAILED step (a fix unblocks everything downstream)
 *   2. The first UNPRODUCED or PENDING step (start it / continue it) — whichever
 *      comes first by index; the label distinguishes the two honestly.
 *   3. The first DEFERRED step (waiting on Unreal — drain it)
 *   4. null when every step is `pass`
 *
 * This is a no-truth-source-needed presentation helper — it just reads the
 * derived per-step status array Baseline computes for PipelineRollup.
 */

export type StepStatus = 'pass' | 'fail' | 'deferred' | 'pending' | 'unproduced';

export interface NextActionableStep {
  step: string;
  index: number;
  status: StepStatus;
  /** Human action word for the coach banner ("Fix" / "Start" / "Run live test"). */
  actionWord: string;
  /** One-sentence plain-language hint. */
  plainHint: string;
}

export function pickNextActionableStep(
  steps: string[],
  statusByStep: (step: string, index: number) => StepStatus,
): NextActionableStep | null {
  // Pass 1: first failed step wins.
  for (let i = 0; i < steps.length; i++) {
    if (statusByStep(steps[i], i) === 'fail') {
      return {
        step: steps[i], index: i, status: 'fail',
        actionWord: 'Fix',
        plainHint: 'This step ran but did not pass — open it to see what to change.',
      };
    }
  }
  // Pass 2: first not-yet-done step — unproduced (never started) OR pending (produced,
  // acceptance still resolving), whichever comes first. The label tells them apart.
  for (let i = 0; i < steps.length; i++) {
    const st = statusByStep(steps[i], i);
    if (st === 'unproduced' || st === 'pending') {
      return {
        step: steps[i], index: i, status: st,
        actionWord: i === 0 ? 'Start here' : 'Do next',
        plainHint: st === 'unproduced'
          ? 'This step has not been produced yet.'
          : 'This step is produced — its acceptance is still resolving.',
      };
    }
  }
  // Pass 3: first deferred step.
  for (let i = 0; i < steps.length; i++) {
    if (statusByStep(steps[i], i) === 'deferred') {
      return {
        step: steps[i], index: i, status: 'deferred',
        actionWord: 'Run live test',
        plainHint: 'Waiting on a live Unreal run — use “Run deferred gates” to send it.',
      };
    }
  }
  // Every step is pass.
  return null;
}
