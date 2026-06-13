import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { submitStepArtifact, CatalogNotFoundError } from '@/lib/catalog/headless';

/**
 * POST /api/catalog/step-submit — the headless "submit your work" endpoint.
 * Body: { catalogId, entityId, step, data, ueAssets? }
 *
 * Persists the produced artifact and returns the SERVER-DERIVED acceptance verdict.
 * The pof-mcp `pof_submit_artifact` tool calls this: Claude does the work, the server
 * grades it via the step's own Checker (Claude never self-grades). L3/L4 deferrals are
 * upgraded later by POST /api/pipeline-artifacts/drain (the `pof_drain_gates` tool).
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      catalogId?: unknown;
      entityId?: unknown;
      step?: unknown;
      data?: unknown;
      ueAssets?: unknown;
    };
    if (typeof body.catalogId !== 'string' || typeof body.entityId !== 'string' || typeof body.step !== 'string') {
      return apiError('catalogId, entityId, and step are required', 400);
    }
    if (body.data == null || typeof body.data !== 'object' || Array.isArray(body.data)) {
      return apiError('data (object) is required', 400);
    }
    const ueAssets = Array.isArray(body.ueAssets) ? body.ueAssets.filter((a): a is string => typeof a === 'string') : [];
    return apiSuccess(
      submitStepArtifact(body.catalogId, body.entityId, body.step, body.data as Record<string, unknown>, ueAssets),
    );
  } catch (e) {
    if (e instanceof CatalogNotFoundError) return apiError(e.message, 404);
    return apiError(e instanceof Error ? e.message : 'step-submit failed', 500);
  }
}
