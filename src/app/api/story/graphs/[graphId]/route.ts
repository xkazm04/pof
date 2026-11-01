import { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/api-utils';
import { requireOperator } from '@/lib/api-auth';
import { deleteStoryGraph, findStoryGraphs, type StoredStoryGraph } from '@/lib/story/story-db-conn';

type Ctx = { params: Promise<{ graphId: string }> };
type Resolved = { ok: true; row: StoredStoryGraph } | { ok: false; response: ReturnType<typeof apiError> };

/**
 * Graphs are project-scoped, so `graphId` alone may name more than one row. `?project=` narrows
 * it; without it, one match is returned and several are a 409 that names the projects.
 */
function resolve(req: NextRequest, graphId: string): Resolved {
  const project = req.nextUrl.searchParams.get('project') ?? undefined;
  const rows = findStoryGraphs(graphId, project);
  if (rows.length === 0) return { ok: false, response: apiError(`story graph ${graphId} not found`, 404) };
  if (rows.length > 1) {
    const projects = rows.map((r) => r.project).join(', ');
    return { ok: false, response: apiError(`graph id ${graphId} exists in several projects (${projects}); pass ?project=`, 409) };
  }
  return { ok: true, row: rows[0] };
}

/** GET /api/story/graphs/:graphId[?project=] — the stored summary plus the full graph. */
export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    const { graphId } = await params;
    const r = resolve(req, graphId);
    if (!r.ok) return r.response;
    return apiSuccess(r.row);
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'failed to read story graph', 500);
  }
}

/** DELETE /api/story/graphs/:graphId[?project=] — remove one stored graph. */
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const denied = requireOperator(req);
  if (denied) return denied;
  try {
    const { graphId } = await params;
    const r = resolve(req, graphId);
    if (!r.ok) return r.response;
    deleteStoryGraph(r.row.project, r.row.graphId);
    return apiSuccess({ project: r.row.project, graphId: r.row.graphId, deleted: true });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'failed to delete story graph', 500);
  }
}
