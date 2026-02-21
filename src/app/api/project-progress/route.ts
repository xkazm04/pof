import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { getDb } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/api-utils';

interface ProgressRow {
  project_id: string;
  checklist_json: string;
  health_json: string;
  verification_json: string;
  history_json: string;
  updated_at: string;
}

function projectId(projectPath: string): string {
  return crypto
    .createHash('sha256')
    .update(projectPath.toLowerCase().replace(/\\/g, '/'))
    .digest('hex')
    .slice(0, 16);
}

/** GET — load module progress for a project by path */
export async function GET(req: NextRequest) {
  try {
    const projectPath = req.nextUrl.searchParams.get('path');
    if (!projectPath) {
      return apiError('path query parameter is required', 400);
    }

    const db = getDb();
    const id = projectId(projectPath);
    const row = db
      .prepare('SELECT * FROM project_progress WHERE project_id = ?')
      .get(id) as ProgressRow | undefined;

    if (!row) {
      return apiSuccess({
        checklistProgress: {},
        moduleHealth: {},
        checklistVerification: {},
        moduleHistory: {},
      });
    }

    return apiSuccess({
      checklistProgress: JSON.parse(row.checklist_json),
      moduleHealth: JSON.parse(row.health_json),
      checklistVerification: JSON.parse(row.verification_json),
      moduleHistory: JSON.parse(row.history_json),
    });
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Failed to load progress');
  }
}

/** POST — save module progress for a project */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectPath, checklistProgress, moduleHealth, checklistVerification, moduleHistory } = body;

    if (!projectPath) {
      return apiError('projectPath is required', 400);
    }

    const db = getDb();
    const id = projectId(projectPath);

    db.prepare(`
      INSERT INTO project_progress (project_id, checklist_json, health_json, verification_json, history_json, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(project_id) DO UPDATE SET
        checklist_json = excluded.checklist_json,
        health_json = excluded.health_json,
        verification_json = excluded.verification_json,
        history_json = excluded.history_json,
        updated_at = datetime('now')
    `).run(
      id,
      JSON.stringify(checklistProgress ?? {}),
      JSON.stringify(moduleHealth ?? {}),
      JSON.stringify(checklistVerification ?? {}),
      JSON.stringify(moduleHistory ?? {}),
    );

    return apiSuccess({ saved: true });
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Failed to save progress');
  }
}
