import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { getDb } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { migrateProgressBlob, describeMigrations } from '@/lib/checklist-progress-keys';
import { logger } from '@/lib/logger';

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

    // Orphan progress keys (ids that belong to no declared checklist item — e.g.
    // the materials graph's retired `mt-*` node ids) are projected onto the real
    // checklist id on the way out, so the UI counts progress that was previously
    // written where nothing could read it. Read-only: the migration is PERSISTED
    // by /api/checklist/complete on the next write, not by this GET.
    const { progress: checklistProgress, migrations } = migrateProgressBlob(
      JSON.parse(row.checklist_json),
    );
    if (migrations.length > 0) {
      logger.warn(
        `project-progress: projected orphan progress keys — ${describeMigrations(migrations).join('; ')}`,
      );
    }

    return apiSuccess({
      checklistProgress,
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

    // Merge the checklist over the stored blob instead of overwriting it. The CLI marks
    // items complete out-of-band via /api/checklist/complete; a blind whole-document write
    // from the client's (possibly stale) snapshot would silently drop those completions.
    // Keys the client doesn't send are preserved; keys it does send win.
    //
    // Health / verification / history overwrite — but ONLY when the client actually
    // sends something. An absent or EMPTY blob is never a meaningful "clear these"
    // intent (nothing in the app deletes accumulated health/verification/history), and
    // the client legitimately holds an empty store whenever its progress was just
    // dropped on a project switch or a failed load. Overwriting on empty turned that
    // into silent destruction of the row's derived data.
    //
    // Read + write run in one transaction so the merge can't race a concurrent writer.
    const isNonEmptyObject = (v: unknown): v is Record<string, unknown> =>
      !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length > 0;

    const save = db.transaction(() => {
      const existing = db
        .prepare(
          'SELECT checklist_json, health_json, verification_json, history_json FROM project_progress WHERE project_id = ?',
        )
        .get(id) as Omit<ProgressRow, 'project_id' | 'updated_at'> | undefined;
      const stored: Record<string, Record<string, boolean>> = existing ? JSON.parse(existing.checklist_json) : {};
      const incoming: Record<string, Record<string, boolean>> = checklistProgress ?? {};
      const mergedChecklist: Record<string, Record<string, boolean>> = { ...stored };
      for (const [mod, items] of Object.entries(incoming)) {
        mergedChecklist[mod] = { ...(stored[mod] ?? {}), ...(items ?? {}) };
      }

      const keepOrReplace = (incomingBlob: unknown, storedJson: string | undefined): string =>
        isNonEmptyObject(incomingBlob) ? JSON.stringify(incomingBlob) : (storedJson ?? '{}');

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
        JSON.stringify(mergedChecklist),
        keepOrReplace(moduleHealth, existing?.health_json),
        keepOrReplace(checklistVerification, existing?.verification_json),
        keepOrReplace(moduleHistory, existing?.history_json),
      );
    });
    save();

    return apiSuccess({ saved: true });
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Failed to save progress');
  }
}
