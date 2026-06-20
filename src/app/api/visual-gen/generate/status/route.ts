import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { getTriposrJob } from '@/lib/visual-gen/triposr-job-store';
import { getHunyuanJob } from '@/lib/visual-gen/hunyuan-job-store';

/**
 * GET /api/visual-gen/generate/status?jobId=...
 * Polls an image-to-3D job — Hunyuan3D (official) or the TripoSR fallback (resolved by
 * trying either store): { status, meshPath?, verts?, faces?, previewPath?, critique?, error? }.
 */
export async function GET(req: NextRequest) {
  try {
    const jobId = req.nextUrl.searchParams.get('jobId');
    if (!jobId) return apiError('jobId is required', 400);
    const job = getHunyuanJob(jobId) ?? getTriposrJob(jobId);
    if (!job) return apiError('generation job not found', 404);
    // TripoSR and Hunyuan results share most fields; the few that differ (device/clipMax
    // vs vramGb) are read loosely so one shape serves both providers.
    const r = job.result as {
      meshPath?: string; verts?: number; faces?: number; durationMs?: number;
      previewPath?: string; device?: string; clipMax?: number; vramGb?: number;
    } | undefined;
    return apiSuccess({
      status: job.status,
      meshPath: r?.meshPath,
      verts: r?.verts,
      faces: r?.faces,
      previewPath: r?.previewPath,
      device: r?.device,
      vramGb: r?.vramGb,
      durationMs: r?.durationMs,
      // Tier-1 quality gate (auto-run on the produced mesh).
      critique: job.critique ? { verdict: job.critique.verdict, score: job.critique.score, reasons: job.critique.reasons, metrics: job.critique.metrics } : undefined,
      // Tier-2 fidelity: CLIP cosine of NeRF renders vs the input image (TripoSR only).
      fidelity: r?.clipMax,
      error: job.error,
    });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'status check failed', 500);
  }
}
