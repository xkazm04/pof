import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { getTriposrJob } from '@/lib/visual-gen/triposr-job-store';
import { getHunyuanJob } from '@/lib/visual-gen/hunyuan-job-store';
import { getTripoJob } from '@/lib/visual-gen/tripo-job-store';
import { projectCritique } from '@/components/modules/visual-gen/asset-forge/forgeJobStatus';

/**
 * GET /api/visual-gen/generate/status?jobId=...
 * Polls a 3D-gen job — local Hunyuan3D (official) / TripoSR fallback, or cloud Tripo3D
 * (resolved by trying each store): { status, meshPath?, verts?, faces?, previewPath?,
 * critique?, error? }.
 */
export async function GET(req: NextRequest) {
  try {
    const jobId = req.nextUrl.searchParams.get('jobId');
    if (!jobId) return apiError('jobId is required', 400);
    const job = getHunyuanJob(jobId) ?? getTriposrJob(jobId) ?? getTripoJob(jobId);
    if (!job) return apiError('generation job not found', 404);
    // TripoSR and Hunyuan results share most fields; the few that differ (device/clipMax
    // vs vramGb) are read loosely so one shape serves both providers.
    const r = job.result as {
      meshPath?: string; verts?: number; faces?: number; durationMs?: number;
      previewPath?: string; device?: string; clipMax?: number; vramGb?: number;
      renderUrl?: string; formatMismatch?: string;
    } | undefined;
    // The gate axis. `attempts` is cloud-Tripo only (the local stores are single-shot),
    // but `accepted` / `ungated` / `gradedAs` are written by ALL THREE stores — the local
    // pair through `summarizeGate` + `localCritiqueDeps` — and only the first of the three
    // was projected here, so a mesh nothing graded arrived indistinguishable from one a
    // gate ran on and rejected, and the class budget in force was invisible.
    const gate = job as unknown as {
      attempts?: number; accepted?: boolean; ungated?: boolean; gateReason?: string; gradedAs?: string;
    };
    return apiSuccess({
      status: job.status,
      meshPath: r?.meshPath,
      verts: r?.verts,
      faces: r?.faces,
      previewPath: r?.previewPath,
      device: r?.device,
      vramGb: r?.vramGb,
      durationMs: r?.durationMs,
      // Tripo's own preview render of the mesh (cloud only). The Tier-1 gate is geometry
      // only and cannot see a smeared face; this is the image an aesthetic gate scores.
      renderUrl: r?.renderUrl,
      // The runner detects when the delivered container does not match the extension it
      // was written to (a quad request arrives as FBX). It was being computed and then
      // dropped here, so a .glb path holding FBX bytes reached callers with no signal.
      formatMismatch: r?.formatMismatch,
      // Tier-1 quality gate (auto-run on the produced mesh). Projected through the
      // shared discriminated shape: a critique that FAILED TO RUN travels as
      // `{ ok:false, error }` instead of an object whose every field is undefined —
      // which JSON dropped to `{}`, truthy enough to render a scorecard with no
      // verdict in it. `metrics.componentFaces` (up to 4096 numbers, a gate input no
      // client reads) is dropped here rather than shipped on every 5 s poll.
      critique: projectCritique(job.critique),
      // Tier-2 fidelity: CLIP cosine of NeRF renders vs the input image (TripoSR only).
      fidelity: r?.clipMax,
      // Paid generations spent, and whether the DELIVERED mesh cleared the gate. A job
      // can be `done` with `accepted: false` — the mesh is real but never passed, and
      // reporting status alone would hide exactly that.
      attempts: gate.attempts,
      accepted: gate.accepted,
      // Delivered with nothing having graded it. `accepted: false` alone reads as "a gate
      // looked at this and said no", which is a different — and fixable — problem.
      ungated: gate.ungated,
      gateReason: gate.gateReason,
      // What the mesh is actually graded against: the class budget, or the STATED
      // class-blind default when the submit carried no `assetClass`.
      gradedAs: gate.gradedAs,
      error: job.error,
    });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'status check failed', 500);
  }
}
