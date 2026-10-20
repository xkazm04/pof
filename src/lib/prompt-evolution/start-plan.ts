import type { ABTest, PromptVariant } from '@/types/prompt-evolution';
import { type Result, ok, err } from '@/types/result';

/**
 * One start-a-test planner. Every entry point that begins an A/B test (the
 * Variants tab, the Optimizer's save-challenger, History's challenge) applies the
 * same item-scoped rules before anything is written: one live test per item, no
 * identical prompts, both arms on the same item, and the incumbent (active)
 * variant is always arm A so click order cannot decide the arms.
 */

/** The item-scoped blocks every entry point shares. */
export type PairBlock =
  | { kind: 'identical-prompt'; message: string }
  | { kind: 'test-running'; testId: string; message: string };

export type StartBlock =
  | { kind: 'same-variant'; message: string }
  | { kind: 'unknown-variant'; message: string }
  | { kind: 'cross-item'; message: string }
  | PairBlock;

export interface StartPlan {
  moduleId: PromptVariant['moduleId'];
  checklistItemId: string;
  /** Arm A: the active (incumbent) variant when one of the pair is active, else the first argument. */
  aId: string;
  bId: string;
  variantA: PromptVariant;
  variantB: PromptVariant;
}

export interface StartInput {
  variants: readonly PromptVariant[];
  /** Tests the caller knows about; only running ones on this item block. */
  runningTests: readonly ABTest[];
  aId: string;
  bId: string;
}

export const IDENTICAL_PROMPT_MESSAGE =
  'This version’s prompt is identical to the current one — a test could only measure noise.';
export const TEST_RUNNING_MESSAGE =
  'An A/B test is already running on this item. Conclude it before starting another — one live test per item keeps its trials honest.';

/** The block rules shared by every entry point, once the pair is known to be two distinct versions of one item. */
export function checkPairBlocks(
  prompts: { a: string; b: string },
  scope: { moduleId: string; checklistItemId: string },
  runningTests: readonly ABTest[],
): PairBlock | null {
  if (prompts.a === prompts.b) {
    return { kind: 'identical-prompt', message: IDENTICAL_PROMPT_MESSAGE };
  }
  const running = runningTests.find(
    (t) => t.status === 'running' && t.moduleId === scope.moduleId && t.checklistItemId === scope.checklistItemId,
  );
  if (running) {
    return { kind: 'test-running', testId: running.id, message: TEST_RUNNING_MESSAGE };
  }
  return null;
}

export function planStart(input: StartInput): Result<StartPlan, StartBlock> {
  const { variants, runningTests, aId, bId } = input;
  if (aId === bId) {
    return err({ kind: 'same-variant', message: 'Pick two different versions — a test needs two arms.' });
  }
  const first = variants.find((v) => v.id === aId);
  const second = variants.find((v) => v.id === bId);
  if (!first || !second) {
    return err({ kind: 'unknown-variant', message: 'One of those versions is not loaded for this item.' });
  }
  if (first.checklistItemId !== second.checklistItemId || first.moduleId !== second.moduleId) {
    return err({ kind: 'cross-item', message: 'Both versions must belong to the same checklist item.' });
  }
  const block = checkPairBlocks(
    { a: first.prompt, b: second.prompt },
    { moduleId: first.moduleId, checklistItemId: first.checklistItemId },
    runningTests,
  );
  if (block) return err(block);

  // The incumbent is always arm A.
  const swap = second.active && !first.active;
  const variantA = swap ? second : first;
  const variantB = swap ? first : second;
  return ok({
    moduleId: first.moduleId,
    checklistItemId: first.checklistItemId,
    aId: variantA.id,
    bId: variantB.id,
    variantA,
    variantB,
  });
}
