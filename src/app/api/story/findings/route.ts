import { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/api-utils';
import { findStoryGraphs } from '@/lib/story/story-db-conn';
import { countFindings, timeStoryValidation } from '@/lib/story/validate';

/**
 * GET /api/story/findings?graphId=&project= — the structural pass (§8) over one STORED graph.
 *
 * Read-only, so not operator-guarded (the GET convention in `api-auth.ts`). Resolution matches
 * `/api/story/graphs/[graphId]`: no match is a 404, several projects holding the id without
 * `?project=` is a 409. `hash` is the stored canonical content hash the findings are pinned to.
 * This route is a separate reader of the stored artifact, so its verdict is not a producer's
 * self-report (§8 "No gate self-certifies"). Structural findings only — no leads.
 */
export async function GET(req: NextRequest) {
  try {
    const graphId = req.nextUrl.searchParams.get('graphId');
    if (!graphId) return apiError('graphId is required', 400);
    const project = req.nextUrl.searchParams.get('project') ?? undefined;
    const rows = findStoryGraphs(graphId, project);
    if (rows.length === 0) return apiError(`story graph ${graphId} not found`, 404);
    if (rows.length > 1) {
      const projects = rows.map((r) => r.project).join(', ');
      return apiError(`graph id ${graphId} exists in several projects (${projects}); pass ?project=`, 409);
    }
    const row = rows[0];
    const { findings, durationMs } = timeStoryValidation(row.graph);
    return apiSuccess({
      graphId: row.graphId,
      project: row.project,
      hash: row.hash,
      findings,
      counts: countFindings(findings),
      durationMs: Math.round(durationMs * 100) / 100,
    });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'failed to validate story graph', 500);
  }
}
