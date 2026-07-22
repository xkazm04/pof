import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { upsertArtifact } from '@/lib/pipeline-artifacts-db';
import { artifactUpsertSchema } from '@/lib/catalog/artifact-validation';
import { gradeArtifact } from '@/lib/catalog/headless';
import { isPreviewHydratable } from '@/lib/preview/browser-mirror';

/**
 * POST /api/preview/tune — the browser preview's tuning round-trip. Accepts one step's
 * full merged `data` and upserts it through the SAME truth rule as every other write path:
 * the server re-grades with the step's own checker; the caller's status is discarded.
 * A browser session can converge on better constants but can never fabricate a pass.
 * CORS-open (different localhost origin). Spec: docs/research/dual-execution-preview-spec.md
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function withCors(res: Response): Response {
  for (const [k, v] of Object.entries(CORS_HEADERS)) res.headers.set(k, v);
  return res;
}

export async function OPTIONS() {
  return withCors(new Response(null, { status: 204 }));
}

export async function POST(req: NextRequest) {
  try {
    const parsed = artifactUpsertSchema.safeParse(await req.json());
    if (!parsed.success) return withCors(apiError('Invalid tune payload', 400, parsed.error.issues));
    const p = parsed.data;
    if (!isPreviewHydratable(p.catalogId)) {
      return withCors(apiError(`catalog "${p.catalogId}" is not preview-tunable`, 403));
    }

    const { graded, result } = gradeArtifact(p.catalogId, p.step, p.data, p.entityId);
    const status = graded ? (result?.status ?? 'pending') : p.status;
    const tier = graded ? (result?.tier ?? 'L0') : p.tier;
    const reason = graded
      ? (result?.reason ?? (result ? undefined : 'unverified: acceptance check did not resolve'))
      : p.reason;

    const saved = upsertArtifact({
      catalogId: p.catalogId,
      entityId: p.entityId,
      step: p.step,
      data: p.data,
      ueAssets: p.ueAssets,
      status,
      tier,
      reason,
    });
    return withCors(apiSuccess({ saved, regraded: graded, status, tier, reason }));
  } catch (e) {
    return withCors(apiError(e instanceof Error ? e.message : 'Preview tune failed', 500));
  }
}
