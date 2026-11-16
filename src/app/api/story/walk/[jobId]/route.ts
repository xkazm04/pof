import { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/api-utils';
import { getWalkJob } from '@/lib/story/walk-jobs';

type Ctx = { params: Promise<{ jobId: string }> };

/**
 * GET /api/story/walk/:jobId — a walk job's state: `{state: queued|running|done|failed,
 * progress: {done, total}, report?, error?, durationMs?}`. The report's findings are LEADS (state
 * altitude, each with `{seed, engine, samples, state, path}`), never proven defects. Read-only, so
 * not operator-guarded. Jobs live in memory: an unknown or evicted id is a 404.
 */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { jobId } = await params;
  const job = getWalkJob(jobId);
  if (!job) return apiError(`walk job ${jobId} not found`, 404);
  return apiSuccess({
    jobId: job.id,
    graphId: job.graphId,
    project: job.project,
    state: job.state,
    progress: job.progress,
    report: job.report,
    error: job.error,
    durationMs: job.durationMs,
  });
}
