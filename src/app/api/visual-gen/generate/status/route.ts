import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { getTriposrJob } from '@/lib/visual-gen/triposr-job-store';

/**
 * GET /api/visual-gen/generate/status?jobId=...
 * Polls a TripoSR generation job: { status, meshPath?, verts?, faces?, device?, error? }.
 */
export async function GET(req: NextRequest) {
  try {
    const jobId = req.nextUrl.searchParams.get('jobId');
    if (!jobId) return apiError('jobId is required', 400);
    const job = getTriposrJob(jobId);
    if (!job) return apiError('generation job not found', 404);
    return apiSuccess({
      status: job.status,
      meshPath: job.result?.meshPath,
      verts: job.result?.verts,
      faces: job.result?.faces,
      device: job.result?.device,
      durationMs: job.result?.durationMs,
      // Tier-1 quality gate (auto-run on the produced mesh).
      critique: job.critique ? { verdict: job.critique.verdict, score: job.critique.score, reasons: job.critique.reasons, metrics: job.critique.metrics } : undefined,
      // Tier-2 fidelity: CLIP cosine of NeRF renders vs the input image (0–1).
      fidelity: job.result?.clipMax,
      error: job.error,
    });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'status check failed', 500);
  }
}
