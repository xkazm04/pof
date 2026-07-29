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

import {
  buildTaskPrompt,
  STATIC_VARIANT_ID,
  type CLITask,
  type ChecklistTask,
  type GenerateTask,
  type EvaluateTrackTask,
} from '@/lib/cli-task';
import { taskVariantBody } from '@/lib/cli-task-handlers';
import type { ProjectContext } from '@/lib/prompt-context';
import { tryApiFetch } from '@/lib/api-utils';
import { logger } from '@/lib/logger';
import type { ServedVariant } from '@/types/prompt-evolution';

/** The sentinel recorded when a run used the static registry prompt (declared in
 *  `cli-task` so the task handlers can read it without importing this resolver). */
export { STATIC_VARIANT_ID };

/** Options shared by the resolve + compose entry points. */
export interface DispatchResolveOptions {
  /**
   * Capture the served prompt as the item's baseline (v1) variant when the item
   * has none. Only the REAL dispatch path sets this — a preview must never
   * mutate the evolution DB just by being opened.
   */
  seed?: boolean;
}

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
  // Recipe-driven dispatches — the ONLY path whose output the judge fleet scores, so
  // this is where an A/B can be settled by something better than a self-reported
  // success flag. The synthetic key ENDS WITH THE ENTITY ID on purpose: a recipe step
  // prompt embeds that entity's own spec (name, tag, attribute rows), so a variant
  // seeded for one entity must never be served to another — that would dispatch the
  // wrong entity's specification under the right-looking key.
  if (task.type === 'generate') {
    const gt = task as GenerateTask;
    return { moduleId: task.moduleId, checklistItemId: `${gt.entity.catalogId}::${gt.step}::${gt.entity.id}` };
  }
  if (task.type === 'evaluate-track') {
    const et = task as EvaluateTrackTask;
    return { moduleId: task.moduleId, checklistItemId: `${et.entity.catalogId}::track:${et.trackId}::${et.entity.id}` };
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
  opts: DispatchResolveOptions = {},
): Promise<{ prompt: string; variantId: string }> {
  const key = variantKeyForTask(task);
  if (!key) return { prompt: task.prompt, variantId: STATIC_VARIANT_ID };

  const res = await tryApiFetch<ServedVariant | null>('/api/prompt-evolution', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'resolve-dispatch-variant', ...key }),
  });

  if (!res.ok || !res.data) {
    // Nothing adopted → this run IS the baseline. Record it (fire-and-forget)
    // so the item has a v1 to challenge; this run still dispatches the static
    // prompt, byte-for-byte what we seeded.
    if (opts.seed) seedBaseline(key, task.prompt);
    return { prompt: task.prompt, variantId: STATIC_VARIANT_ID };
  }
  return { prompt: res.data.variant.prompt, variantId: res.data.variant.id };
}

/**
 * Fire-and-forget baseline capture. Deliberately NOT awaited: dispatch latency
 * must not pay for the seed write, and a failed seed is never allowed to block
 * or fail a run (the loop simply stays unfueled until the next dispatch).
 */
function seedBaseline(
  key: { moduleId: CLITask['moduleId']; checklistItemId: string },
  prompt: string,
): void {
  void tryApiFetch<unknown>('/api/prompt-evolution', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'seed-baseline-variant', ...key, prompt }),
  }).then((r) => {
    if (!r.ok) logger.debug(`[prompt-evolution] baseline seed skipped: ${r.error}`);
  });
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
  opts: DispatchResolveOptions = {},
): Promise<{ prompt: string; variantId: string }> {
  // Materialize the variant-able body first. `checklist` already carries its text on
  // `task.prompt`; the recipe-driven types compose theirs inside the handler, so
  // without this the baseline seed would capture an EMPTY prompt and a served variant
  // would be silently ignored. With no variant resolved the body is exactly what the
  // handler would have recomputed, so the static path is byte-identical.
  const body = taskVariantBody(task, ctx);
  const withBody: CLITask = body === task.prompt ? task : { ...task, prompt: body };
  const { prompt, variantId } = await resolveActivePrompt(withBody, opts);
  const resolvedTask: CLITask = { ...task, prompt, promptVariantId: variantId };
  return { prompt: buildTaskPrompt(resolvedTask, ctx), variantId };
}
