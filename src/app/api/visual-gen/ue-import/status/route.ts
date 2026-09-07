import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { getUeImportJob } from '@/lib/visual-gen/ue-import-job-store';

/**
 * GET /api/visual-gen/ue-import/status?jobId=...
 *
 * Polls a UE import job.
 *
 * The collision fields are the point of this response, and they are reported as three
 * separate facts that must never be collapsed into one: what was ASKED for (`collision`),
 * what that ask was based on (`planBasis` / `shells`), and what was actually OBSERVED on
 * the imported asset (`collisionElements`, read back from `body_setup`). An asset whose
 * `body_setup` holds zero elements passes every import check and then falls through the
 * world, so "the collision call ran" is not evidence and is not reported as any.
 */
export async function GET(req: NextRequest) {
  try {
    const jobId = req.nextUrl.searchParams.get('jobId');
    if (!jobId) return apiError('jobId is required', 400);
    const job = getUeImportJob(jobId);
    if (!job) return apiError('ue-import job not found', 404);

    const r = job.result;
    return apiSuccess({
      status: job.status,
      glbPath: job.spec.glbPath,
      use: job.spec.use,
      assetPath: r?.assetPath,

      /**
       * The collision that was REQUESTED, with the reason it was chosen. Explicitly `null`
       * before the job has planned — JSON drops `undefined`, and on these fields an absent
       * KEY would be indistinguishable from a response that never carried the field at all.
       */
      collision: job.plan ?? null,
      /** Where its shell count came from: measured / declared / assumed / not-needed. */
      planBasis: job.planBasis ?? null,
      shells: job.shells ?? null,

      /**
       * Collision primitives OBSERVED on the imported mesh, read back from `body_setup`.
       * `null` means nothing counted them — which is a FAILURE when collision was
       * requested, never a silent pass. This is the field the whole route exists to
       * report honestly, so it is never allowed to vanish from the payload.
       */
      collisionElements: r?.collisionElements ?? null,

      /** Why the Tier-1 critic could not measure the mesh, when it could not. */
      critiqueUnavailable: job.critique?.unavailable,
      critiqueError: job.critique?.unavailable ? job.critique.error : undefined,

      error: job.error,
      startedAt: job.startedAt,
    });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'failed to read ue-import job', 500);
  }
}
