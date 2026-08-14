import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { getMeshFinishJob } from '@/lib/visual-gen/mesh-finish-job-store';

/**
 * GET /api/visual-gen/mesh-finish/status?jobId=...
 *
 * Polls a retopo/UV/bake job. Every field that can be absent is reported as absent
 * rather than defaulted: a skipped unwrap carries its reason, a cull that could not see
 * between shells carries its limit, and a requested bake that was refused is listed
 * instead of silently dropped — a partial result must never read as a complete one.
 */
export async function GET(req: NextRequest) {
  try {
    const jobId = req.nextUrl.searchParams.get('jobId');
    if (!jobId) return apiError('jobId is required', 400);
    const job = getMeshFinishJob(jobId);
    if (!job) return apiError('mesh-finish job not found', 404);

    const r = job.result;
    return apiSuccess({
      status: job.status,
      meshPath: r?.meshPath,
      facesIn: r?.facesIn,
      facesOut: r?.facesOut,
      /** The budget this run was asked to hit, so a caller can compare it to facesOut. */
      targetFaces: job.spec.targetFaces,
      sizeMB: r?.sizeMB,
      uvUnwrapped: r?.uvUnwrapped,
      unwrapSkippedReason: r?.unwrapSkippedReason,
      normalMapPath: r?.normalMapPath,
      aoMapPath: r?.aoMapPath,
      facesCulled: r?.facesCulled,
      cullLimitReason: r?.cullLimitReason,
      durationMs: r?.durationMs,
      // Tier-1 geometry gate on the finished low-poly, including whether the delivered
      // mesh honoured `targetFaces` (not merely the class ceiling).
      critique: job.critique
        ? {
            verdict: job.critique.verdict,
            score: job.critique.score,
            reasons: job.critique.reasons,
            metrics: job.critique.metrics,
            budget: job.critique.budget,
          }
        : undefined,
      error: job.error,
    });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'status check failed', 500);
  }
}
