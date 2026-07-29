/**
 * What a live CLI dispatch is actually going to run on, and what it has historically cost.
 *
 * The lab's live-produce switch told the operator only that the next click "spends model
 * budget" — true, but it named neither the model, the effort, nor a number. Both halves of
 * the answer already existed and were simply never joined: `model-policy.ts` decides the
 * `{model, effort}` for a dispatch's task class, and `cli-spend-db.getTaskTypeEstimate`
 * knows what runs of that task type have actually cost.
 *
 * Two honesty rules are load-bearing here and are enforced by the copy, not left to the
 * caller: an UNPINNED dispatch (no policy class maps to the task type) must say so rather
 * than imply a governed model, and a task type with NO recorded runs must say it has no
 * history rather than render `$0.00` — a fabricated zero is the worst possible cost
 * estimate, because it reads as "free".
 */

import { formatUsd } from './format';
import type { ClaudeModel, Effort, TaskClass } from '@/lib/model-policy';
import type { TaskTypeEstimate } from '@/types/cli-spend';

/**
 * The dispatch task type of the lab's live CLI produce (`POST /api/one-shot/step`,
 * `mode:'cli'`). Named once here because three places must agree on it: the route that
 * spawns with it, `taskClassForDispatchType` that maps it to a policy class, and the
 * Produce panel that asks what that dispatch will cost. A typo in any one of them would
 * silently return the pipeline to running unpinned and unpriced.
 */
export const ONE_SHOT_STEP_TASK_TYPE = 'one-shot-step';

export interface DispatchPlan {
  taskType: string;
  /** Friendly task-type name (`taskTypeLabel`). */
  label: string;
  /** The policy class governing this dispatch, or null when none maps to it. */
  taskClass: TaskClass | null;
  /** null when the spawn is unpinned — it inherits the session's model. */
  model: ClaudeModel | null;
  effort: Effort | null;
  /** Historical cost for this task type, or null when nothing has run yet. */
  estimate: TaskTypeEstimate | null;
}

export interface DispatchPlanCopy {
  /** One sentence naming the model + effort, or saying the spawn is unpinned. */
  model: string;
  /** One sentence pricing the dispatch, or saying there is no history to price it with. */
  cost: string;
  /** Is a model-policy class actually governing this dispatch? */
  pinned: boolean;
  /** Is the cost sentence backed by real recorded runs? */
  priced: boolean;
}

/** Turn a plan into copy that can be shown at the point of produce. */
export function describeDispatchPlan(p: DispatchPlan): DispatchPlanCopy {
  const pinned = !!(p.taskClass && p.model && p.effort);
  const priced = !!p.estimate && p.estimate.runs > 0;

  const model = pinned
    ? `${p.model} · ${p.effort} effort — pinned by model policy (${p.taskClass}).`
    : 'No model policy covers this dispatch — it runs on the session’s default model, unpinned.';

  const cost = priced
    ? `~${formatUsd(p.estimate!.avgCostUsd)} based on ${p.estimate!.runs} past ` +
      // One run is a data point, not an average; saying "1 runs" would also be wrong.
      (p.estimate!.runs === 1 ? 'run.' : 'runs.')
    : 'No cost history yet for this task type — the first run is the estimate.';

  return { model, cost, pinned, priced };
}
