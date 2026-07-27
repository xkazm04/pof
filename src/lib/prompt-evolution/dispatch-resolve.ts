/**
 * Dispatch-time resolution of the active prompt-evolution variant.
 *
 * The versioning subsystem (variants in SQLite, adopt/restore of an `active`
 * flag) is connected to the runtime here: before a CLI task's prompt is built,
 * the dispatch path asks which variant is adopted for its (module, checklist
 * item) key and swaps in that variant's text. With no adopted variant — or on
 * any API error — it falls back to the task's static registry prompt, so a run
 * is never blocked by the evolution layer.
 *
 * Both the real dispatch (`useModuleCLI.execute`) and the pre-dispatch preview
 * (`TaskPromptInspector`) go through {@link composeTaskDispatch}, so the string
 * shown in the inspector is byte-identical to the one that dispatches for the
 * same task + project context.
 */

import { buildTaskPrompt, type CLITask, type ChecklistTask } from '@/lib/cli-task';
import type { ProjectContext } from '@/lib/prompt-context';
import { tryApiFetch } from '@/lib/api-utils';
import type { ServedVariant } from '@/types/prompt-evolution';

/** The sentinel recorded when a run used the static registry prompt. */
export const STATIC_VARIANT_ID = 'static';

/**
 * The (module, checklist-item) key a task resolves a variant against, or `null`
 * when the task type has no per-item prompt key (quick actions, scans, python
 * tasks, …) and therefore always uses its static prompt.
 */
export function variantKeyForTask(
  task: CLITask,
): { moduleId: CLITask['moduleId']; checklistItemId: string } | null {
  if (task.type === 'checklist') {
    const ct = task as ChecklistTask;
    if (ct.itemId) return { moduleId: task.moduleId, checklistItemId: ct.itemId };
  }
  return null;
}

/**
 * Resolve the prompt this task should dispatch with. Returns the served
 * variant's text + its id, or the task's static prompt +
 * {@link STATIC_VARIANT_ID} when there is nothing adopted or the lookup fails.
 *
 * When a **running A/B test** covers the (module, item) key, the server picks an
 * arm epsilon-greedily and that arm's id is what comes back — so the id stamped
 * onto the callback is the variant that actually ran, and the completion POST
 * can book the trial against it. With no running test this is the unchanged
 * adopted-variant lookup.
 */
export async function resolveActivePrompt(
  task: CLITask,
): Promise<{ prompt: string; variantId: string }> {
  const key = variantKeyForTask(task);
  if (!key) return { prompt: task.prompt, variantId: STATIC_VARIANT_ID };

  const res = await tryApiFetch<ServedVariant | null>('/api/prompt-evolution', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'resolve-dispatch-variant', ...key }),
  });

  if (!res.ok || !res.data) return { prompt: task.prompt, variantId: STATIC_VARIANT_ID };
  return { prompt: res.data.variant.prompt, variantId: res.data.variant.id };
}

/**
 * Resolve the active variant, then build the fully composed prompt exactly as it
 * will dispatch. The resolved variant id is stamped onto the task so the
 * callback payload records which variant ran. Used by both the dispatch path and
 * the preview so they never drift.
 */
export async function composeTaskDispatch(
  task: CLITask,
  ctx: ProjectContext,
): Promise<{ prompt: string; variantId: string }> {
  const { prompt, variantId } = await resolveActivePrompt(task);
  const resolvedTask: CLITask = { ...task, prompt, promptVariantId: variantId };
  return { prompt: buildTaskPrompt(resolvedTask, ctx), variantId };
}
