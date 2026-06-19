import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { getExperimentRun } from '@/lib/ue-experiment/experiment-db';

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
