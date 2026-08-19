import { NextRequest } from 'next/server';
import { getAllModuleAggregates, getProjectScopeReport, normalizeProjectId } from '@/lib/feature-matrix-db';
import { apiSuccess, withRoute } from '@/lib/api-utils';

/**
 * Per-module roll-up of the feature matrix. Read through the ONE shared client
 * path (`useModuleAggregates`), so a single Evaluator mount runs this query once
 * rather than once per dashboard.
 *
 * Scoped to the project the caller names (`projectId` / `projectPath`). A caller
 * that names none gets the unattributed legacy rows only — never a silent
 * project-wide total — and `scope` states exactly that.
 */
export const GET = withRoute(async (request: NextRequest) => {
  const params = request.nextUrl.searchParams;
  const projectId = normalizeProjectId(params.get('projectId') ?? params.get('projectPath'));
  const modules = getAllModuleAggregates(projectId);
  return apiSuccess({ modules, scope: getProjectScopeReport(projectId) });
}, 'Failed to read aggregates');
