import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { countAllChecklists } from '@/lib/checklist-progress';
import { progressRowId, readProgress } from '@/lib/project-progress-db';

interface RecentProjectRow {
  id: string;
  project_name: string;
  project_path: string;
  ue_version: string;
  checklist_json: string;
  last_opened_at: string;
}

/**
 * Read all recent projects (sorted by last opened) and shape them for the
 * client. Shared by GET and by the save/touch POST actions so a mutation can
 * return the freshened list directly — sparing the client a follow-up GET.
 *
 * The % comes from the project's REAL progress row (joined on the one row id,
 * legacy spellings folded — `@/lib/project-progress-db`), counted by the app's own
 * rule (`countAllChecklists`: declared checklist items only, so an orphan key can
 * never inflate it). `recent_projects.checklist_json` — the client's snapshot at
 * switch time — is only the fallback for a project with no progress row at all.
 */
function loadRecentProjects(db: ReturnType<typeof getDb>) {
  const rows = db.prepare(
    'SELECT id, project_name, project_path, ue_version, checklist_json, last_opened_at FROM recent_projects ORDER BY last_opened_at DESC LIMIT 20'
  ).all() as RecentProjectRow[];

  return rows.map((row) => {
    const progress = readProgress(row.project_path, { quiet: true });
    let checklist: Record<string, Record<string, boolean>> = progress.checklistProgress;
    if (!progress.exists) {
      try {
        checklist = JSON.parse(row.checklist_json || '{}');
      } catch {
        checklist = {};
      }
    }
    const { done, total } = countAllChecklists(checklist);
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
}

/** GET — return all recent projects sorted by last opened */
export async function GET() {
  try {
    const db = getDb();
    return apiSuccess(loadRecentProjects(db));
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

      // A path already listed keeps the id it was listed under (the client touches /
      // removes by that id, and project_path is UNIQUE); a new one takes the progress
      // row id, so the two tables share one key per project.
      const listed = db.prepare('SELECT id FROM recent_projects WHERE project_path = ?').get(projectPath) as
        | { id: string }
        | undefined;
      const id = listed?.id ?? progressRowId(projectPath);
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

      // Return the freshened list so the client can update state without a follow-up GET.
      return apiSuccess({ id, projects: loadRecentProjects(db) });
    }

    if (action === 'touch') {
      const { projectId: pid } = body;
      if (!pid) return apiError('projectId required', 400);
      db.prepare("UPDATE recent_projects SET last_opened_at = datetime('now') WHERE id = ?").run(pid);
      // Return the freshened list so the client can update state without a follow-up GET.
      return apiSuccess({ touched: true, projects: loadRecentProjects(db) });
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
