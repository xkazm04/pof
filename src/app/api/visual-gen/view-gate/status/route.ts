import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { getViewGateJob } from '@/lib/visual-gen/view-gate-job-store';

/**
 * GET /api/visual-gen/view-gate/status?jobId=...
 *
 * Polls a render-gate job. A member that could not be rendered or judged is reported
 * WITH its reason and WITHOUT a verdict — never dropped, because a shortened member list
 * reads as a kit that was fully inspected. The kit grade keeps its `advisory` flag and
 * its calibration caveat wherever it is read.
 */
export async function GET(req: NextRequest) {
  try {
    const jobId = req.nextUrl.searchParams.get('jobId');
    if (!jobId) return apiError('jobId is required', 400);
    const job = getViewGateJob(jobId);
    if (!job) return apiError('view-gate job not found', 404);

    return apiSuccess({
      status: job.status,
      /** Aggregate over members: fail > unmeasured > warn > pass. */
      verdict: job.verdict,
      members: job.members.map((m) => ({
        name: m.name,
        meshPath: m.meshPath,
        views: m.render?.views ?? [],
        viewsPlanReason: m.render?.viewsPlanReason,
        renderMs: m.render?.durationMs,
        gate: m.gate
          ? {
              verdict: m.gate.verdict,
              reason: m.gate.reason,
              worst: m.gate.worst,
              views: m.gate.views,
              unjudged: m.gate.unjudged,
            }
          : undefined,
        error: m.error,
      })),
      kit: job.kit,
      error: job.error,
      startedAt: job.startedAt,
    });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'status check failed', 500);
  }
}
