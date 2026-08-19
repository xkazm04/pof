import { NextRequest } from 'next/server';
import { getAllFeatureStatuses, getProjectScopeReport, normalizeProjectId } from '@/lib/feature-matrix-db';
import { apiSuccess, apiError } from '@/lib/api-utils';

/**
 * The cross-module status table every dependency/constellation/NBA view reads.
 *
 * It used to be a genuinely global `SELECT … FROM feature_matrix` with no WHERE,
 * which is how project B's checklist got scored against project A's scan rows. It
 * is now scoped to the project the caller names, and the returned `scope` says how
 * many rows were unattributed, how many belong to other projects, and — when no
 * project was named — that the answer is the legacy set rather than everything.
 */
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const projectId = normalizeProjectId(params.get('projectId') ?? params.get('projectPath'));
    const statuses = getAllFeatureStatuses(projectId);
    return apiSuccess({ statuses, scope: getProjectScopeReport(projectId) });
  } catch (error) {
    console.error('All statuses GET error:', error);
    return apiError(error instanceof Error ? error.message : 'Failed to read statuses', 500);
  }
}
