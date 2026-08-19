import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { getDb } from '@/lib/db';
import { apiSuccess, apiError, withRoute } from '@/lib/api-utils';
import { logger } from '@/lib/logger';
import { recordTrialForServedVariant } from '@/lib/prompt-evolution/engine';
import { STATIC_VARIANT_ID } from '@/lib/prompt-evolution/dispatch-resolve';
import {
  resolveProgressKey,
  migrateProgressBlob,
  describeMigrations,
} from '@/lib/checklist-progress-keys';
import type { SubModuleId } from '@/types/modules';

function projectId(projectPath: string): string {
  return crypto
    .createHash('sha256')
    .update(projectPath.toLowerCase().replace(/\\/g, '/'))
    .digest('hex')
    .slice(0, 16);
}

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
 * same write — never silently left.
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

  const db = getDb();
  const id = projectId(projectPath);

  // Read current checklist progress
  const row = db
    .prepare('SELECT checklist_json FROM project_progress WHERE project_id = ?')
    .get(id) as { checklist_json: string } | undefined;

  const stored: Record<string, Record<string, boolean>> = row
    ? JSON.parse(row.checklist_json)
    : {};

  // Any orphan key already in the blob moves to its real checklist id on this
  // write — a key nothing reads is not left sitting there just because it was
  // written before the route validated anything.
  const { progress, migrations } = migrateProgressBlob(stored);
  const migratedKeys = describeMigrations(migrations);
  if (migratedKeys.length > 0) {
    logger.warn(`checklist/complete: migrated orphan progress keys — ${migratedKeys.join('; ')}`);
  }

  // Mark item complete
  if (!progress[moduleId]) progress[moduleId] = {};
  progress[moduleId][storedItemId] = true;

  // Upsert
  db.prepare(`
    INSERT INTO project_progress (project_id, checklist_json, health_json, verification_json, history_json, updated_at)
    VALUES (?, ?, '{}', '{}', '{}', datetime('now'))
    ON CONFLICT(project_id) DO UPDATE SET
      checklist_json = excluded.checklist_json,
      updated_at = datetime('now')
  `).run(id, JSON.stringify(progress));

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
