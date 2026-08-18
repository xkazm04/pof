import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { listArtifacts } from '@/lib/pipeline-artifacts-db';
import { toStepSummary } from '@/components/layout-lab/stepSummary';

/**
 * GET /api/pipeline-artifacts/summary?catalogId=items[&entityId=item-1] → StepSummary[]
 *
 * The blob-free read of the SAME rows `GET /api/pipeline-artifacts` serves: status, tier,
 * reason, write time and two content hashes per `(entity, step)` — no `data`, no `ueAssets`.
 *
 * It exists for the whole-project readers. The lab's cross-catalog coach fetches EVERY
 * registered catalog on first paint to rank a top-5 list; against the real
 * `~/.pof/pof.db` (817 artifacts / 33 catalogs) the full route answers that with 7.41 MB
 * of produce bodies, this one with 134 KB. Nothing is derived here that the full route does
 * not already hold — it is a projection (`toStepSummary`), not a second source of truth, and
 * anything that GRADES still goes through `resolveStepAcceptance` on the reader's side.
 *
 * `entityId` narrows it the same way the full route does, so a caller that wants one
 * entity's verdicts without its blobs has the same shape available.
 */
export async function GET(req: NextRequest) {
  try {
    const catalogId = req.nextUrl.searchParams.get('catalogId');
    const entityId = req.nextUrl.searchParams.get('entityId') ?? undefined;
    if (!catalogId) return apiError('catalogId is required', 400);
    return apiSuccess(listArtifacts(catalogId, entityId).map(toStepSummary));
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'Artifact summary GET failed', 500);
  }
}
