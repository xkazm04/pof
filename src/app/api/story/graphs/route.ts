import { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/api-utils';
import { requireOperator } from '@/lib/api-auth';
import { storyGraphSchema } from '@/lib/story/schema';
import { findUnknownKinds, formatStoryIssues } from '@/lib/story/importer';
import { storyContentHash } from '@/lib/story/canonical';
import { listStoryGraphs, saveStoryGraph } from '@/lib/story/story-db-conn';
import type { StoryGraph } from '@/lib/story/types';

/** GET /api/story/graphs[?project=] — stored graph summaries (no bodies). */
export async function GET(req: NextRequest) {
  try {
    const project = req.nextUrl.searchParams.get('project') ?? undefined;
    return apiSuccess(listStoryGraphs(project));
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'failed to list story graphs', 500);
  }
}

/**
 * POST /api/story/graphs — import one `pof.storygraph/1` document (the request body).
 *
 * Validated with `storyGraphSchema`; a `variables` block that cannot be read refuses the whole
 * document (400). An unknown node/edge kind is accepted, stored as written, and listed in
 * `unknownKinds`. A declared `contentHash` that does not match the content is refused. Revision
 * is monotonic per `(project, graphId)`: an older revision, or a re-used revision number with
 * different content, is a 409.
 */
export async function POST(req: NextRequest) {
  const denied = requireOperator(req);
  if (denied) return denied;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError('request body must be a JSON storygraph document', 400);
  }
  const parsed = storyGraphSchema.safeParse(body);
  if (!parsed.success) return apiError(formatStoryIssues(parsed.error), 400);
  try {
    const graph = parsed.data as unknown as StoryGraph;
    const hash = await storyContentHash(graph);
    if (graph.contentHash !== undefined && graph.contentHash !== hash) {
      return apiError(`declared contentHash ${graph.contentHash} does not match the content (${hash})`, 400);
    }
    const unknownKinds = findUnknownKinds(graph);
    const saved = saveStoryGraph(graph, hash, unknownKinds);
    if (!saved.ok) return apiError(saved.error.message, 409);
    return apiSuccess(
      { status: saved.data.status, graph: saved.data.summary, unknownKinds },
      saved.data.status === 'created' ? 201 : 200,
    );
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'failed to import story graph', 500);
  }
}
