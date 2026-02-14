import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { getDb } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/api-utils';

interface RecentProjectRow {
  id: string;
  project_name: string;
  project_path: string;
  ue_version: string;
  checklist_json: string;
  last_opened_at: string;
}

function projectId(projectPath: string): string {
  return crypto.createHash('sha256').update(projectPath.toLowerCase().replace(/\\/g, '/')).digest('hex').slice(0, 16);
}

/** GET — return all recent projects sorted by last opened */
export async function GET() {
  try {
    const db = getDb();
    const rows = db.prepare(
      'SELECT id, project_name, project_path, ue_version, checklist_json, last_opened_at FROM recent_projects ORDER BY last_opened_at DESC LIMIT 20'
    ).all() as RecentProjectRow[];

    const projects = rows.map((row) => {
      const checklist: Record<string, Record<string, boolean>> = JSON.parse(row.checklist_json || '{}');
      let total = 0;
      let done = 0;
      for (const moduleItems of Object.values(checklist)) {
        for (const checked of Object.values(moduleItems)) {
          total++;
          if (checked) done++;
        }
      }
      return {
        id: row.id,
        projectName: row.project_name,
        projectPath: row.project_path,
        ueVersion: row.ue_version,
        lastOpenedAt: row.last_opened_at,
        checklistTotal: total,
        checklistDone: done,
      };
    });

    return apiSuccess(projects);
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Failed to load recent projects');
  }
}

/** POST — save, touch, or remove a recent project */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    const db = getDb();

    if (action === 'save') {
      const { projectName, projectPath, ueVersion, checklistProgress } = body;
      if (!projectName || !projectPath) {
        return apiError('projectName and projectPath are required', 400);
      }

      const id = projectId(projectPath);
      const checklistJson = JSON.stringify(checklistProgress ?? {});

      db.prepare(`
        INSERT INTO recent_projects (id, project_name, project_path, ue_version, checklist_json, last_opened_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(id) DO UPDATE SET
          project_name = excluded.project_name,
          ue_version = excluded.ue_version,
          checklist_json = excluded.checklist_json,
          last_opened_at = datetime('now')
      `).run(id, projectName, projectPath, ueVersion ?? '5.5', checklistJson);

      return apiSuccess({ id });
    }

    if (action === 'touch') {
      const { projectId: pid } = body;
      if (!pid) return apiError('projectId required', 400);
      db.prepare("UPDATE recent_projects SET last_opened_at = datetime('now') WHERE id = ?").run(pid);
      return apiSuccess({ touched: true });
    }

    if (action === 'remove') {
      const { projectId: pid } = body;
      if (!pid) return apiError('projectId required', 400);
      db.prepare('DELETE FROM recent_projects WHERE id = ?').run(pid);
      return apiSuccess({ removed: true });
    }

    return apiError(`Unknown action: ${action}`, 400);
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Failed to process request');
  }
}
