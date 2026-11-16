/**
 * API Route: /api/ue5-bridge/build-health
 *
 * GET — Return the build health & trend report for a project: success rate,
 * duration trend, slowest targets, recurring error fingerprints, and regression
 * alerts. Reads from the `headless_builds` table.
 *
 * Query params:
 *   projectPath  (required) — the UE project whose builds to analyze
 *   limit        (optional) — max builds to consider, a positive integer capped
 *                             at 1000 (default 200); anything else answers 400
 */

import { type NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { getBuildHealthReport } from '@/lib/ue5-bridge/build-health';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectPath = searchParams.get('projectPath');

    if (!projectPath) {
      return apiError('projectPath is required', 400);
    }

    const limitParam = searchParams.get('limit');
    if (limitParam !== null && (!/^\d+$/.test(limitParam) || Number(limitParam) < 1)) {
      return apiError('limit must be a positive integer', 400);
    }
    const limit = limitParam ? Math.min(1000, Number(limitParam)) : 200;

    const report = getBuildHealthReport(projectPath, { limit });
    return apiSuccess(report);
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Internal error', 500);
  }
}
