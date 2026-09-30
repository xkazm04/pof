import { NextRequest } from 'next/server';
import { apiSuccess, apiError, withRoute } from '@/lib/api-utils';
import { logger } from '@/lib/logger';
import { recordTrialForServedVariant } from '@/lib/prompt-evolution/engine';
import { STATIC_VARIANT_ID } from '@/lib/prompt-evolution/dispatch-resolve';
import { resolveProgressKey } from '@/lib/checklist-progress-keys';
import { markComplete } from '@/lib/project-progress-db';
import type { SubModuleId } from '@/types/modules';

/**
 * POST — mark a checklist item as completed.
 *
 * Called by the CLI via curl after finishing a checklist task.
 * Writes directly to the project_progress DB so the UI can pick it up.
 *
 * `itemId` is VALIDATED against what the module actually declares
 * (`resolveProgressKey`): an id no checklist item and no registered auxiliary
 * surface owns is refused with 400 and a reason, because writing it would record
 * progress in a key nothing can ever read. Recorded historical orphans (e.g. the
 * materials graph's old `mt-*` node ids) are written under the real checklist id
 * instead, and any orphan already sitting in the stored blob is migrated on the
 * same write — never silently left. The mark is DATED: `Date.now()` goes into the
 * row's completion ledger (an item already done keeps its first stamp), so CLI
 * completions count toward velocity instead of reading as undated.
 *
 * This is also where the prompt-evolution A/B loop closes: the dispatch path
 * stamps `promptVariantId` (the variant it was actually served) into the
 * callback's static fields, so a completion reports the outcome of a real run
 * back to the running test that served it. Booking the trial is best-effort —
 * marking the item complete is the primary job and must never fail because the
 * experiment layer did.
 */
export const POST = withRoute(async (req: NextRequest) => {
  const { moduleId, itemId, projectPath, promptVariantId, completed, durationMs } = await req.json();

  if (!moduleId || !itemId || !projectPath) {
    return apiError('moduleId, itemId, and projectPath are required', 400);
  }

  // ── Validate the id against what the module actually declares ─────────────
  const verdict = resolveProgressKey(moduleId, itemId);
  if (verdict.kind === 'unknown') {
    logger.warn(`checklist/complete: refused ${moduleId}/${itemId} — ${verdict.reason}`);
    return apiError(verdict.reason, 400);
  }
  const storedItemId = verdict.kind === 'migrate' ? verdict.to : itemId;
  if (verdict.kind === 'migrate') logger.warn(`checklist/complete: ${verdict.note}`);
  if (verdict.kind === 'aux' && verdict.gap) {
    logger.warn(`checklist/complete: ${moduleId}/${itemId} is owned by ${verdict.owner} — ${verdict.gap}`);
  }
  if (verdict.kind === 'ungoverned') logger.warn(`checklist/complete: ${verdict.note}`);

  // Row id, legacy-spelling fold, orphan migration and the dated mark are the
  // one ledger module's job — one transaction, earliest completion stamp wins.
  const migratedKeys = markComplete(projectPath, moduleId, storedItemId, Date.now());
  if (migratedKeys.length > 0) {
    logger.warn(`checklist/complete: migrated orphan progress keys — ${migratedKeys.join('; ')}`);
  }

  // ── Close the A/B loop ────────────────────────────────────────────────────
  // A run served the static registry prompt (or no variant at all) is not a
  // trial of anything, so only a real variant id books one.
  let trialRecorded = false;
  if (typeof promptVariantId === 'string' && promptVariantId && promptVariantId !== STATIC_VARIANT_ID) {
    try {
      const trial = recordTrialForServedVariant(
        moduleId as SubModuleId,
        storedItemId,
        promptVariantId,
        completed !== false,
        typeof durationMs === 'number' ? durationMs : 0,
      );
      trialRecorded = trial !== null;
    } catch (e) {
      logger.warn('checklist/complete: could not record A/B trial', e);
    }
  }

  return apiSuccess({
    moduleId,
    // The id actually written. Differs from `requestedItemId` only for a
    // recorded orphan, and the caller is told so rather than left guessing.
    itemId: storedItemId,
    requestedItemId: itemId,
    completed: true,
    trialRecorded,
    migratedKeys,
  });
}, 'Failed to mark checklist item');
