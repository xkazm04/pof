/**
 * Bridges an implementation-plan item to the CLI task system.
 *
 * The implementation planner (`plan-generator.ts`) was a dead-end visualization —
 * it computed a topologically-sorted, impact-prioritized `PlanItem[]` but nothing
 * fed a `PlanItem` into `TaskFactory`, so "implement this plan item" had to
 * hand-roll a prompt. This maps a ready `PlanItem` onto a `feature-fix` `CLITask`
 * (the task shape that carries feature context + writes the feature-matrix status
 * back), so the plan view dispatches through the standard `useModuleCLI.execute`
 * path instead — inheriting project-context injection, the knowledge system, spend
 * preflight, and analytics for free.
 */

import type { PlanItem } from './plan-generator';
import { getModuleLabel } from './plan-generator';
import { TaskFactory, type FeatureFixTask } from '@/lib/cli-task';

/**
 * The dependency note carried into the dispatch prompt: the item's already-met
 * dependencies, so Claude builds on them instead of recreating them. '' when the
 * item has no dependencies.
 */
function dependencyNote(item: PlanItem): string {
  if (item.dependsOn.length === 0) return '';
  const lines = item.dependsOn.map((d) => `- ${d.replace('::', ' / ')}`).join('\n');
  return `\n\n### Dependencies (already implemented — build on them, do not recreate)\n${lines}`;
}

/**
 * Map a plan item to a `feature-fix` CLITask via `TaskFactory`.
 *
 * PHASE-1: single-item dispatch. Callers gate on `item.isReady` before dispatch —
 * this mapping does not itself enforce readiness (it is a pure transform), but the
 * plan view only offers the affordance on ready items.
 */
export function planItemToTask(item: PlanItem, appOrigin: string): FeatureFixTask {
  const nextSteps =
    `${item.description || `Implement the "${item.featureName}" feature.`}${dependencyNote(item)}\n\n` +
    `Implement this feature from scratch following UE5 C++ conventions. Read any existing ` +
    `related files first, then create/modify files as needed. After implementation, verify ` +
    `the build compiles successfully.`;

  return TaskFactory.featureFix(
    item.moduleId,
    {
      featureName: item.featureName,
      status: item.status,
      nextSteps,
      filePaths: [],
      qualityScore: null,
    },
    `Implement: ${getModuleLabel(item.moduleId)} / ${item.featureName}`,
    appOrigin,
  );
}
