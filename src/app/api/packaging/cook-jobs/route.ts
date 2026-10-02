import { NextRequest } from 'next/server';
import { apiSuccess, apiError, withRoute } from '@/lib/api-utils';
import {
  activeCookJob, getCookJob, cancelCookJob, cookJobEventStream, COOK_SSE_HEADERS,
} from '@/lib/packaging/cook-jobs';

/**
 * The cook job registry over HTTP (see `src/lib/packaging/cook-jobs.ts`). A cook is
 * started by `POST /api/packaging/execute` (interactive) or the nightly runner; this
 * route only reads, streams and cancels.
 *
 * GET `?projectPath=<path>` answers `{ job }`: the ACTIVE job holding that project
 *   (interactive or nightly), or `{ job: null }`. A settled job is not active, so a
 *   fresh page never replays an old cook as if it were new.
 * GET `?jobId=<id>` answers `{ job }` for that job, settled or not (kept for a short
 *   TTL after settling), or `{ job: null }`: how a client whose stream dropped learns
 *   whether the cook is still running instead of guessing.
 * GET `?attach=<id>&from=<seq>` streams the job as SSE: replay from `seq`, then live,
 *   closing when the job settles. Disconnecting detaches; it never cancels.
 * DELETE `?jobId=<id>` cancels (aborts the executor, which kills the UAT process
 *   tree; the job records the cook as cancelled). Unknown id: 404.
 */
export const GET = withRoute(async (req: NextRequest) => {
  const params = new URL(req.url).searchParams;
  const attach = params.get('attach')?.trim();
  if (attach) {
    const from = Number(params.get('from') ?? '0');
    const stream = cookJobEventStream(attach, Number.isFinite(from) && from >= 0 ? Math.floor(from) : 0, req.signal);
    if (!stream) return apiError(`no cook job ${attach}`, 404);
    return new Response(stream, { status: 200, headers: { ...COOK_SSE_HEADERS, 'X-Cook-Job-Id': attach } });
  }
  const jobId = params.get('jobId')?.trim();
  if (jobId) return apiSuccess({ job: getCookJob(jobId) });
  const projectPath = params.get('projectPath')?.trim();
  if (!projectPath) return apiError('projectPath, jobId or attach is required', 400);
  return apiSuccess({ job: activeCookJob(projectPath) });
}, 'Failed to read cook job');

export const DELETE = withRoute(async (req: NextRequest) => {
  const jobId = new URL(req.url).searchParams.get('jobId')?.trim();
  if (!jobId) return apiError('jobId is required', 400);
  const cancelled = cancelCookJob(jobId);
  if (!cancelled.ok) return apiError(cancelled.error, 404);
  return apiSuccess({ job: cancelled.data });
}, 'Failed to cancel cook job');
