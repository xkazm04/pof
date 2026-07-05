import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { listArtifacts, upsertArtifact } from '@/lib/pipeline-artifacts-db';
import { artifactUpsertSchema } from '@/lib/catalog/artifact-validation';
import { gradeArtifact } from '@/lib/catalog/headless';

/** GET /api/pipeline-artifacts?catalogId=items[&entityId=item-1] → PipelineArtifact[] */
export async function GET(req: NextRequest) {
  try {
    const catalogId = req.nextUrl.searchParams.get('catalogId');
    const entityId = req.nextUrl.searchParams.get('entityId') ?? undefined;
    if (!catalogId) return apiError('catalogId is required', 400);
    return apiSuccess(listArtifacts(catalogId, entityId));
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'Artifacts GET failed', 500);
  }
}

/**
 * POST /api/pipeline-artifacts — the produce @@CALLBACK target. Upserts one step's artifact.
 *
 * Truth rule: when the step belongs to a registered pipeline, the SERVER re-grades the
 * submitted `data` with the step's own Checker and the caller's `status` is discarded —
 * a client can never persist a fabricated `pass` (nor an optimistic `?? 'pass'` default)
 * for a step the server can verify. A registered checker that fails to resolve degrades to
 * `pending`, never `pass`. Only catalogs with no server checker (bespoke Items specs, the
 * synthetic loot-filter catalog) keep the caller-supplied status. This matches the headless
 * MCP path (`submitStepArtifact`), so both write paths grade identically.
 */
export async function POST(req: NextRequest) {
  try {
    const parsed = artifactUpsertSchema.safeParse(await req.json());
    if (!parsed.success) return apiError('Invalid artifact payload', 400, parsed.error.issues);
    const p = parsed.data;

    const { graded, result } = gradeArtifact(p.catalogId, p.step, p.data);
    const status = graded ? (result?.status ?? 'pending') : p.status;
    const tier = graded ? (result?.tier ?? 'L0') : p.tier;
    const reason = graded
      ? (result?.reason ?? (result ? undefined : 'unverified: acceptance check did not resolve'))
      : p.reason;

    return apiSuccess(upsertArtifact({
      catalogId: p.catalogId,
      entityId: p.entityId,
      step: p.step,
      data: p.data,
      ueAssets: p.ueAssets,
      status,
      tier,
      reason,
    }));
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'Artifacts POST failed', 500);
  }
}
