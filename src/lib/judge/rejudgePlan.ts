/**
 * Rejudge plan: what re-judging would cost, BEFORE any Opus draw is spent (pure).
 *
 * A standing chip says a verdict is STALE or SUPERSEDED, but the decision to re-judge is made
 * blind: each draw is a real CLI spawn and the only aggregate figure used to be the after-the-
 * fact `summarizeJudgeSpend`. This planner reuses {@link judgeSkipDecision} (the harness's own
 * skip rule, so the preview can never disagree with the run) and adds what the operator needs to
 * decide: a reason bucket per step, a priority, a per-task-type price, and the prefix of the
 * plan that fits the remaining budget.
 *
 * Honesty rules, same as the spend report:
 *  - A task type with no cost estimate is NOT priced at 0. Its entries are counted in
 *    `unestimated` and the total is flagged `totalIsFloor`.
 *  - An entry whose price is unknown cannot be proven affordable, so it ends the budget prefix.
 *  - Nothing here reads a database or writes anything; callers pass facts in.
 */

import { judgeSkipDecision, type PriorVerdict, type SkipBucket } from './fleetPlan';
import { judgeSpendCeiling, judgeTaskType, type JudgeTaskType } from './spendMeter';
import type { DeliverableClass } from './dimensions';
import type { PreflightBudget } from '@/lib/cli-spend/preflight';

/**
 * Key a stored verdict the way `judge_verdicts`' primary key does. Unlike `fleetPlan.verdictKey`
 * (one catalog per harness pass) this includes the catalog, because a preview spans catalogs and
 * two of them can share an entity id and step name.
 */
export function planPriorKey(catalogId: string, entityId: string, step: string, judge: string): string {
  return `${catalogId} ${entityId} ${step} ${judge}`;
}

/** The `judge_verdicts.judge` class a deliverable class's verdict is stored under. */
export function judgeClassOf(cls: DeliverableClass): 'llm-panel' | 'vlm' {
  return cls === 'text-config' ? 'llm-panel' : 'vlm';
}

export interface PlanStep {
  catalogId: string;
  entityId: string;
  step: string;
  cls: DeliverableClass;
  /** The artifact payload on record (what `stepContentHash` reads). */
  data: Record<string, unknown> | undefined | null;
}

/** Why a planned step is planned. `unchanged` never appears here: those steps are skipped. */
export type PlanBucket = Exclude<SkipBucket, 'unchanged'>;

export interface PlanEntry {
  catalogId: string;
  entityId: string;
  step: string;
  cls: DeliverableClass;
  taskType: JudgeTaskType;
  reason: string;
  bucket: PlanBucket;
  /** Lower runs first. See {@link PRIORITY}. */
  priority: number;
  /** Estimated USD for this entry, or null when its task type has no estimate. */
  estimateUsd: number | null;
}

export interface SkippedStep {
  catalogId: string;
  entityId: string;
  step: string;
  reason: string;
}

export interface TaskTypeRollup {
  count: number;
  estimatedUsd: number;
  /** Entries of this type that could not be priced. */
  unestimated: number;
}

export interface RejudgePlan {
  entries: PlanEntry[];
  skipped: SkippedStep[];
  byTaskType: Partial<Record<JudgeTaskType, TaskTypeRollup>>;
  estimatedUsd: number;
  /** Entries with no price. Not free: the total is a floor while this is > 0. */
  unestimated: number;
  totalIsFloor: boolean;
  /** The budget headroom the prefix was cut at; null when no budget is configured. */
  ceilingUsd: number | null;
  /** The affordable prefix of `entries`, in priority order. */
  fitsBudget: PlanEntry[];
  overBudget: PlanEntry[];
  fitsUsd: number;
}

/**
 * Run order. A standing FAIL on content that has since changed is the verdict most likely wrong
 * today, so it is re-judged first; never-judged steps have no standing at all; a rubric bump
 * only re-grades passes that were fine under the old bar, so it goes last.
 */
export const PRIORITY = { failChanged: 0, never: 1, content: 2, scheme: 3, rubric: 4, forced: 5 } as const;

function priorityOf(bucket: PlanBucket, prior: PriorVerdict | undefined): number {
  if (bucket === 'content') return prior?.verdict === 'fail' ? PRIORITY.failChanged : PRIORITY.content;
  return PRIORITY[bucket];
}

const round = (n: number): number => Math.round(n * 1e6) / 1e6;

export function rejudgePlan(input: {
  steps: readonly PlanStep[];
  /** Stored verdicts keyed by {@link planPriorKey}(catalogId, entityId, step, judge class). */
  priors: ReadonlyMap<string, PriorVerdict>;
  rubricVersion: number;
  /** Average USD per draw for each judge task type; null/absent = no estimate. */
  estimates?: Partial<Record<JudgeTaskType, number | null>>;
  budget?: PreflightBudget | null;
  force?: boolean;
}): RejudgePlan {
  const estimates = input.estimates ?? {};
  const entries: PlanEntry[] = [];
  const skipped: SkippedStep[] = [];

  for (const s of input.steps) {
    const prior = input.priors.get(planPriorKey(s.catalogId, s.entityId, s.step, judgeClassOf(s.cls)));
    const d = judgeSkipDecision({ data: s.data, prior, rubricVersion: input.rubricVersion, force: input.force });
    if (d.skip || d.bucket === 'unchanged') {
      skipped.push({ catalogId: s.catalogId, entityId: s.entityId, step: s.step, reason: d.reason });
      continue;
    }
    const taskType = judgeTaskType(s.cls);
    const est = estimates[taskType];
    entries.push({
      catalogId: s.catalogId, entityId: s.entityId, step: s.step, cls: s.cls, taskType,
      reason: d.reason,
      bucket: d.bucket,
      priority: priorityOf(d.bucket, prior),
      estimateUsd: typeof est === 'number' && Number.isFinite(est) ? est : null,
    });
  }
  // Array#sort is stable: equal priorities keep input order.
  entries.sort((a, b) => a.priority - b.priority);

  const byTaskType: RejudgePlan['byTaskType'] = {};
  let estimatedUsd = 0, unestimated = 0;
  for (const e of entries) {
    const r = (byTaskType[e.taskType] ??= { count: 0, estimatedUsd: 0, unestimated: 0 });
    r.count++;
    if (e.estimateUsd === null) { r.unestimated++; unestimated++; }
    else { r.estimatedUsd = round(r.estimatedUsd + e.estimateUsd); estimatedUsd += e.estimateUsd; }
  }

  const ceilingUsd = judgeSpendCeiling(input.budget);
  let cut = entries.length;
  if (ceilingUsd !== null) {
    let running = 0;
    cut = 0;
    for (const e of entries) {
      if (e.estimateUsd === null || running + e.estimateUsd > ceilingUsd + 1e-9) break;
      running += e.estimateUsd;
      cut++;
    }
  }
  const fitsBudget = entries.slice(0, cut);
  const fitsUsd = fitsBudget.reduce((sum, e) => sum + (e.estimateUsd ?? 0), 0);

  return {
    entries, skipped, byTaskType,
    estimatedUsd: round(estimatedUsd),
    unestimated,
    totalIsFloor: unestimated > 0,
    ceilingUsd,
    fitsBudget,
    overBudget: entries.slice(cut),
    fitsUsd: round(fitsUsd),
  };
}
