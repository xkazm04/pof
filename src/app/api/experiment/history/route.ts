import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { listExperimentRuns } from '@/lib/ue-experiment/experiment-db';

/** GET /api/experiment/history?limit=50 — past experiment runs (newest first). */
export async function GET(req: NextRequest) {
  try {
    const limit = Number(req.nextUrl.searchParams.get('limit') ?? '50') || 50;
    return apiSuccess({ runs: listExperimentRuns(limit) });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'failed to list experiment runs', 500);
  }
}
