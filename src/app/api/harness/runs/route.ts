/**
 * GET /api/harness/runs                       → recent runs (default 50)
 * GET /api/harness/runs?limit=200&project=... → filter + bigger window
 */

import { NextRequest } from 'next/server';
import { apiSuccess } from '@/lib/api-utils';
import { listRuns } from '@/lib/harness-runs-db';

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const limitParam = sp.get('limit');
  const project = sp.get('project');
  const limit = limitParam ? Number.parseInt(limitParam, 10) : undefined;
  const runs = listRuns({
    ...(Number.isFinite(limit ?? NaN) ? { limit: limit as number } : {}),
    ...(project ? { projectPath: project } : {}),
  });
  return apiSuccess({ runs });
}
