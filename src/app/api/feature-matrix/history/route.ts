import { NextRequest } from 'next/server';
import { getReviewHistory, getAllReviewHistory, normalizeProjectId } from '@/lib/feature-matrix-db';
import { apiSuccess, withRoute } from '@/lib/api-utils';
import type { SubModuleId } from '@/types/modules';

/**
 * Review-snapshot history — the quality trend behind the sparklines.
 *
 * Both branches return the most RECENT `limit` snapshots, oldest-first. The
 * per-module branch used to return the OLDEST N (`ORDER BY reviewed_at ASC LIMIT`),
 * so past 20 reviews a module's sparkline was frozen on ancient history while the
 * aggregate dashboard, reading the same table through the ROW_NUMBER sibling, showed
 * the current one — two views of one table that could not agree.
 */
export const GET = withRoute(async (request: NextRequest) => {
  const params = request.nextUrl.searchParams;
  const moduleId = params.get('moduleId');
  const limit = parseInt(params.get('limit') ?? '20', 10);
  const safeLimit = Number.isNaN(limit) ? 20 : Math.min(100, Math.max(1, limit));
  // Trend points are per project: a sparkline that mixed two projects' review
  // history would draw a line no single project ever walked.
  const projectId = normalizeProjectId(params.get('projectId') ?? params.get('projectPath'));

  if (moduleId) {
    const snapshots = getReviewHistory(moduleId as SubModuleId, safeLimit, projectId);
    return apiSuccess({ snapshots, projectId });
  }

  // No moduleId → return all modules' history (for aggregate dashboard)
  const history = getAllReviewHistory(safeLimit, projectId);
  return apiSuccess({ history, projectId });
}, 'Failed to read history');
