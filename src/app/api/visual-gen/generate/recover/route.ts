import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { runnerDispatchFor, recoverRefusal } from '@/lib/visual-gen/runner-dispatch';

/**
 * POST /api/visual-gen/generate/recover  { providerId, taskId, assetClass? }
 *
 * Re-collect a PAID provider task PoF stopped watching (the server's poll window ran out,
 * or a restart dropped the in-process job) by its provider-side task id. It only polls and
 * downloads: no upload, no create, so it never pays. The 202 carries a `jobId` on the SAME
 * rail as POST /generate (poll GET /api/visual-gen/generate/status?jobId=...), and the
 * mesh is graded exactly like a fresh job of `assetClass` (stage `raw`, class thresholds,
 * the class face budget). Only a dispatch entry with `recover` (cloud Tripo) can serve it.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      providerId?: unknown; taskId?: unknown; assetClass?: unknown;
    };
    const { providerId, taskId, assetClass } = body;
    if (typeof providerId !== 'string' || typeof taskId !== 'string') {
      return apiError('Missing required fields: providerId, taskId', 400);
    }
    const recover = runnerDispatchFor(providerId)?.recover;
    if (!recover) return apiError(recoverRefusal(providerId), 400);
    const started = recover({ taskId, assetClass: typeof assetClass === 'string' ? assetClass : undefined });
    if (!started.ok) return apiError(started.error, 400);
    return apiSuccess({ jobId: started.data.jobId, provider: providerId, taskId, ...started.data.extras }, 202);
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'Failed to start recovery', 500);
  }
}
