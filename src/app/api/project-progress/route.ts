import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { readProgress, saveProgress } from '@/lib/project-progress-db';
import { logger } from '@/lib/logger';

/**
 * GET — load module progress for a project by path.
 *
 * Orphan progress keys (ids no declared checklist item owns — e.g. the materials
 * graph's retired `mt-*` node ids) are projected onto the real checklist id, and
 * `checklistCompletedAt` carries WHEN each done item was first completed (the
 * server-held ledger). Row id, legacy-spelling fold and merge rules all live in
 * `@/lib/project-progress-db`.
 */
export async function GET(req: NextRequest) {
  try {
    const projectPath = req.nextUrl.searchParams.get('path');
    if (!projectPath) {
      return apiError('path query parameter is required', 400);
    }
    const { checklistProgress, checklistCompletedAt, moduleHealth, checklistVerification, moduleHistory } =
      readProgress(projectPath);
    return apiSuccess({ checklistProgress, checklistCompletedAt, moduleHealth, checklistVerification, moduleHistory });
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Failed to load progress');
  }
}

/**
 * POST — save module progress for a project.
 *
 * The checklist MERGES over the stored blob (the CLI marks items out-of-band via
 * /api/checklist/complete; a whole-document write from a stale client snapshot
 * would drop them): keys the client doesn't send are preserved, keys it sends win,
 * and stored orphan keys are migrated on this write. `checklistCompletedAt` unions
 * with the stored ledger (earliest stamp wins) and is pruned to done items, so an
 * un-done item loses its date. Health / verification / history are replaced only
 * when the client sends a non-empty blob — an emptied store is never a delete.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectPath, checklistProgress, checklistCompletedAt, moduleHealth, checklistVerification, moduleHistory } =
      body;

    if (!projectPath) {
      return apiError('projectPath is required', 400);
    }

    const migratedKeys = saveProgress(projectPath, {
      checklistProgress,
      checklistCompletedAt,
      moduleHealth,
      checklistVerification,
      moduleHistory,
    });
    if (migratedKeys.length > 0) {
      logger.warn(`project-progress: migrated orphan progress keys — ${migratedKeys.join('; ')}`);
    }

    return apiSuccess({ saved: true });
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Failed to save progress');
  }
}
