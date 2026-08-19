import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { getExperimentRun, deleteExperimentRun } from '@/lib/ue-experiment/experiment-db';

/** GET /api/experiment/runs/:id — a persisted run's full detail (for A-B compare). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const run = getExperimentRun(id);
    if (!run) return apiError('experiment run not found', 404);
    return apiSuccess(run);
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'failed to read experiment run', 500);
  }
}

/**
 * DELETE /api/experiment/runs/:id — remove one run and its capture.
 *
 * Experiment retention is unbounded by design (a run is one row + one PNG, and the point of the
 * history is that an old baseline is still there to compare against). This is the explicit,
 * user-driven counterpart to that decision — the reason `deleteExperimentRun` exists.
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!deleteExperimentRun(id)) return apiError('experiment run not found', 404);
    return apiSuccess({ id, deleted: true });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'failed to delete experiment run', 500);
  }
}
