import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { listArtifacts, upsertArtifact } from '@/lib/pipeline-artifacts-db';
import { artifactUpsertSchema } from '@/lib/catalog/artifact-validation';

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

/** POST /api/pipeline-artifacts — the produce @@CALLBACK target. Upserts one step's artifact. */
export async function POST(req: NextRequest) {
  try {
    const parsed = artifactUpsertSchema.safeParse(await req.json());
    if (!parsed.success) return apiError('Invalid artifact payload', 400, parsed.error.issues);
    return apiSuccess(upsertArtifact({
      catalogId: parsed.data.catalogId,
      entityId: parsed.data.entityId,
      step: parsed.data.step,
      data: parsed.data.data,
      ueAssets: parsed.data.ueAssets,
      status: parsed.data.status,
      tier: parsed.data.tier,
      reason: parsed.data.reason,
    }));
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'Artifacts POST failed', 500);
  }
}
