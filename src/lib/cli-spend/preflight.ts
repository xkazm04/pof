/**
 * Pre-flight guardrail engine (pure).
 *
 * Classifies CLI task types that are known to be expensive — full-editor "live"
 * runs (procgen, scatter, Mixamo import, character setup, audio import, GAS
 * codegen, recipe generation) and broad multi-pass scans (module scan, feature
 * review) — and, given the current budget status, decides whether to warn the
 * user *before* launching. No I/O here: the API layer fetches the budget +
 * historical estimate and feeds them in, so the decision is unit-testable.
 */

import type { TaskTypeEstimate } from '@/types/cli-spend';
import { formatUsd } from './format';

/**
 * Task types that are resource-intensive to run. Two families:
 *  - "live editor" runs that spawn the full UE editor (minutes of wall-clock,
 *    many tool turns), and
 *  - broad scans that read large swathes of the codebase across multiple passes.
 */
export const EXPENSIVE_TASK_TYPES: ReadonlySet<string> = new Set<string>([
  // live editor runs
  'procgen-dungeon',
  'biome-scatter',
  'mixamo-import',
  'character-setup',
  'audio-import',
  'generate-gas-effects',
  'generate',
  // broad scans
  'module-scan',
  'feature-review',
]);

/** Friendly labels for task types (used in the dashboard + the guard dialog). */
export const TASK_TYPE_LABELS: Record<string, string> = {
  checklist: 'Checklist run',
  'quick-action': 'Quick action',
  'ask-claude': 'Ask Claude',
  'feature-fix': 'Feature fix',
  'feature-review': 'Feature review',
  'module-scan': 'Module scan',
  'wbp-starter': 'Widget BP starter',
  'procgen-dungeon': 'Procedural dungeon',
  'biome-scatter': 'Biome scatter',
  'mixamo-import': 'Mixamo import',
  'character-setup': 'Character setup',
  'audio-import': 'Audio import',
  generate: 'Recipe generation',
  'evaluate-track': 'Track evaluation',
  'draft-ability-spec': 'Draft ability spec',
  'generate-gas-effects': 'GAS effect codegen',
  interactive: 'Interactive prompt',
};

export function isExpensiveTaskType(taskType: string): boolean {
  return EXPENSIVE_TASK_TYPES.has(taskType);
}

export function taskTypeLabel(taskType: string): string {
  return TASK_TYPE_LABELS[taskType] ?? taskType;
}

/** Budget facts the guard needs — a projection of `BudgetStatus`. */
export interface PreflightBudget {
  dailyExceeded: boolean;
  monthlyExceeded: boolean;
  dailyRemainingUsd: number | null;
  monthlyRemainingUsd: number | null;
}

export interface PreflightInput {
  taskType: string;
  /** Historical cost estimate for this task type, if any runs exist. */
  estimate?: TaskTypeEstimate | null;
  /** Current budget status, if a budget is configured. */
  budget?: PreflightBudget | null;
}

export interface PreflightVerdict {
  taskType: string;
  label: string;
  expensive: boolean;
  /** Estimated cost of this run from history, or null if no samples. */
  estimatedCostUsd: number | null;
  sampleSize: number;
  budgetExceeded: boolean;
  /** True when the UI should interrupt with a confirmation before launching. */
  warn: boolean;
  reasons: string[];
  severity: 'info' | 'warning' | 'danger';
}

/**
 * Decide whether to warn before launching a task.
 *
 * We `warn` (interrupt with a confirm) only under genuine budget pressure — a
 * budget is already exceeded, or this expensive run's estimate would blow the
 * remaining daily/monthly allowance. With no budget configured, nothing is
 * blocked; the dashboard still flags expensive task types informationally.
 */
export function evaluatePreflight(input: PreflightInput): PreflightVerdict {
  const expensive = isExpensiveTaskType(input.taskType);
  const sampleSize = input.estimate?.runs ?? 0;
  const estimatedCostUsd = input.estimate && input.estimate.runs > 0 ? input.estimate.avgCostUsd : null;
  const b = input.budget ?? null;
  const budgetExceeded = !!b && (b.dailyExceeded || b.monthlyExceeded);

  const reasons: string[] = [];
  if (expensive) {
    reasons.push(`${taskTypeLabel(input.taskType)} is a resource-intensive task type.`);
  }
  if (estimatedCostUsd != null) {
    reasons.push(`Past runs averaged ${formatUsd(estimatedCostUsd)} each (${sampleSize} run${sampleSize === 1 ? '' : 's'}).`);
  }

  let exceedsRemaining = false;
  if (b && estimatedCostUsd != null) {
    if (b.dailyRemainingUsd != null && estimatedCostUsd > b.dailyRemainingUsd) {
      exceedsRemaining = true;
      reasons.push(`Estimated cost exceeds today's remaining budget (${formatUsd(Math.max(0, b.dailyRemainingUsd))} left).`);
    } else if (b.monthlyRemainingUsd != null && estimatedCostUsd > b.monthlyRemainingUsd) {
      exceedsRemaining = true;
      reasons.push(`Estimated cost exceeds this month's remaining budget (${formatUsd(Math.max(0, b.monthlyRemainingUsd))} left).`);
    }
  }

  if (budgetExceeded) {
    reasons.push(b!.dailyExceeded ? 'Your daily budget is already exceeded.' : 'Your monthly budget is already exceeded.');
  }

  const warn = budgetExceeded || (expensive && exceedsRemaining);
  const severity: PreflightVerdict['severity'] = budgetExceeded ? 'danger' : warn ? 'warning' : 'info';

  return {
    taskType: input.taskType,
    label: taskTypeLabel(input.taskType),
    expensive,
    estimatedCostUsd,
    sampleSize,
    budgetExceeded,
    warn,
    reasons,
    severity,
  };
}
