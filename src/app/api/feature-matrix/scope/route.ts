import { NextRequest } from 'next/server';
import { getProjectScopeReport, normalizeProjectId } from '@/lib/feature-matrix-db';
import { apiSuccess, withRoute } from '@/lib/api-utils';

/**
 * GET /api/feature-matrix/scope?projectId=…[&moduleId=…]
 *
 * The "REPORT, don't migrate" half of project scoping. `project_id` existed on
 * `feature_matrix` / `review_snapshots` for a long time while nothing read or wrote
 * it, so every historical row carries `''` — unattributable to any of the projects
 * that produced it. This endpoint COUNTS that contamination (unattributed rows,
 * rows owned by other projects, how many distinct projects are represented) so the
 * operator can see it before anyone attempts the UNIQUE-key migration or a backfill.
 *
 * It is pure reporting: it never adopts a row, backfills an id, or moves a status.
 */
export const GET = withRoute(async (request: NextRequest) => {
  const params = request.nextUrl.searchParams;
  const projectId = normalizeProjectId(params.get('projectId') ?? params.get('projectPath'));
  const moduleId = params.get('moduleId') ?? undefined;
  return apiSuccess(getProjectScopeReport(projectId, moduleId));
}, 'Failed to read project scope');
