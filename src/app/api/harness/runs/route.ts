/**
 * GET /api/harness/runs                       → recent runs (default 50)
 * GET /api/harness/runs?limit=200&project=... → filter + bigger window
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { listRuns } from '@/lib/harness-runs-db';

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const limitParam = sp.get('limit');
  const project = sp.get('project');
  const limit = limitParam === null ? undefined : Number(limitParam);
  if (limitParam !== null && (limitParam.trim() === '' || !Number.isInteger(limit) || (limit as number) < 1)) {
    return apiError('limit must be an integer >= 1', 400);
  }
  const runs = listRuns({
    ...(limit !== undefined ? { limit } : {}),
    ...(project ? { projectPath: project } : {}),
  });
  return apiSuccess({ runs });
}
