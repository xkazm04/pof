/**
 * GET /api/harness/runs/diff?a=<runId>&b=<runId>
 *
 * Compares two runs and returns aggregate deltas (pass-rate, cost, duration,
 * sessions) + per-area improvements/regressions. `a` is the base, `b` is the
 * head (the run you want to evaluate).
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { getRun } from '@/lib/harness-runs-db';
import { diffRuns } from '@/lib/harness/run-diff';

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const aId = sp.get('a');
  const bId = sp.get('b');
  if (!aId || !bId) return apiError('Both `a` and `b` run ids are required', 400);
  if (aId === bId) return apiError('`a` and `b` must be different runs', 400);

  const a = getRun(aId);
  if (!a) return apiError(`Run not found: ${aId}`, 404);
  const b = getRun(bId);
  if (!b) return apiError(`Run not found: ${bId}`, 404);

  return apiSuccess(diffRuns(a, b));
}
