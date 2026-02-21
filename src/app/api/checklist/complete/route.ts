import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { getDb } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/api-utils';

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
 */
export async function POST(req: NextRequest) {
  try {
    const { moduleId, itemId, projectPath } = await req.json();

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

    return apiSuccess({ moduleId, itemId, completed: true });
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Failed to mark checklist item');
  }
}
