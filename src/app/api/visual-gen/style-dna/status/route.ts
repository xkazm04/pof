import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { getStyleDnaJob } from '@/lib/visual-gen/style-dna-job-store';

/**
 * GET /api/visual-gen/style-dna/status?jobId=...
 *
 * Polls a distillation started by POST /api/visual-gen/style-dna. Mirrors
 * `view-gate/status` so the forge has one polling shape rather than two.
 *
 * A job that cannot be found is a 404, never a `running` — an unknown id reported as
 * still-working is a spinner that never ends, which is the exact failure the job rail
 * exists to remove.
 */
export async function GET(req: NextRequest) {
  try {
    // `new URL(req.url)` rather than `req.nextUrl` — identical result, and it keeps the route
    // callable with a plain Request so the polling contract is unit-testable without Next.
    const jobId = new URL(req.url).searchParams.get('jobId');
    if (!jobId) return apiError('jobId is required', 400);
    const job = getStyleDnaJob(jobId);
    if (!job) return apiError('style-dna job not found', 404);

    return apiSuccess({
      status: job.status,
      imageCount: job.imageCount,
      elapsedMs: Date.now() - job.startedAt,
      ...(job.profile ? { profile: job.profile } : {}),
      ...(job.raw !== undefined ? { raw: job.raw } : {}),
      ...(job.error ? { error: job.error } : {}),
    });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'failed to read style-dna job', 500);
  }
}
