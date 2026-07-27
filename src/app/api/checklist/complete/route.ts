import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { getDb } from '@/lib/db';
import { apiSuccess, apiError, withRoute } from '@/lib/api-utils';
import { logger } from '@/lib/logger';
import { recordTrialForServedVariant } from '@/lib/prompt-evolution/engine';
import { STATIC_VARIANT_ID } from '@/lib/prompt-evolution/dispatch-resolve';
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

  const db = getDb();
  const id = projectId(projectPath);

  // Read current checklist progress
  const row = db
    .prepare('SELECT checklist_json FROM project_progress WHERE project_id = ?')
    .get(id) as { checklist_json: string } | undefined;

  const progress: Record<string, Record<string, boolean>> = row
    ? JSON.parse(row.checklist_json)
    : {};

  // Mark item complete
  if (!progress[moduleId]) progress[moduleId] = {};
  progress[moduleId][itemId] = true;

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
        itemId,
        promptVariantId,
        completed !== false,
        typeof durationMs === 'number' ? durationMs : 0,
      );
      trialRecorded = trial !== null;
    } catch (e) {
      logger.warn('checklist/complete: could not record A/B trial', e);
    }
  }

  return apiSuccess({ moduleId, itemId, completed: true, trialRecorded });
}, 'Failed to mark checklist item');
