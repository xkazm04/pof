import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { listRevisions, getRevision, upsertArtifact } from '@/lib/pipeline-artifacts-db';
import { gradeArtifact } from '@/lib/catalog/headless';

/**
 * GET /api/pipeline-artifacts/revisions?catalogId&entityId&step
 *   → the step's superseded versions, newest first.
 *
 * POST /api/pipeline-artifacts/revisions  { revisionId }
 *   → restore that version as the live artifact.
 *
 * The restore is deliberately NOT a raw copy of the archived row. It re-runs the step's own
 * Checker over the archived `data` through the same `gradeArtifact` the produce POST uses,
 * for two reasons: an archived verdict can be stale (the checker may have been tightened
 * since that version was written), and trusting a stored `status` would re-open exactly the
 * fabricated-pass hole the POST route closed by server-grading every submission.
 *
 * A restore is itself an ordinary content-changing upsert, so the version it replaces is
 * archived in turn — reverting is undoable.
 */
export async function GET(req: NextRequest) {
  try {
    const p = req.nextUrl.searchParams;
    const catalogId = p.get('catalogId');
    const entityId = p.get('entityId');
    const step = p.get('step');
    if (!catalogId || !entityId || !step) {
      return apiError('catalogId, entityId and step are all required', 400);
    }
    return apiSuccess(listRevisions(catalogId, entityId, step));
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'Revisions GET failed', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { revisionId?: unknown };
    const revisionId = Number(body.revisionId);
    if (!Number.isInteger(revisionId) || revisionId <= 0) {
      return apiError('revisionId (a positive integer) is required', 400);
    }

    const rev = getRevision(revisionId);
    if (!rev) return apiError(`revision ${revisionId} not found`, 404);

    // Re-grade rather than restoring the archived verdict (see the route doc).
    const { graded, raw } = gradeArtifact(rev.catalogId, rev.step, rev.data, rev.entityId);
    const restored = upsertArtifact({
      catalogId: rev.catalogId,
      entityId: rev.entityId,
      step: rev.step,
      data: rev.data,
      ueAssets: rev.ueAssets,
      status: graded ? (raw?.status ?? 'pending') : rev.status,
      tier: graded ? (raw?.tier ?? 'L0') : rev.tier,
      reason: graded
        ? (raw?.reason ?? (raw ? undefined : 'unverified: acceptance check did not resolve'))
        : rev.reason,
    });

    return apiSuccess({
      artifact: restored,
      /** True when the restored status came from a fresh checker run rather than the archive. */
      regraded: graded,
      /** Surfaced so the UI can say a restore did not bring back the verdict it displayed. */
      archivedStatus: rev.status,
    });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'Revision restore failed', 500);
  }
}
