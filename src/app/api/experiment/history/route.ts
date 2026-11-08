import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { listExperimentRuns } from '@/lib/ue-experiment/experiment-db';

/** GET /api/experiment/history?limit=50 — past experiment runs (newest first). */
export async function GET(req: NextRequest) {
  try {
    const raw = req.nextUrl.searchParams.get('limit');
    const limit = raw === null ? 50 : Number(raw);
    if (raw !== null && (raw.trim() === '' || !Number.isInteger(limit) || limit < 1)) {
      return apiError('limit must be an integer >= 1', 400);
    }
    return apiSuccess({ runs: listExperimentRuns(limit) });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'failed to list experiment runs', 500);
  }
}
