import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { listArtifacts } from '@/lib/pipeline-artifacts-db';
import {
  isPreviewHydratable,
  MECHANICS_STEPS,
  PREVIEW_HYDRATABLE_CATALOGS,
} from '@/lib/preview/browser-mirror';

/**
 * GET /api/preview/hydrate?catalogId=spellbook — read-only aggregation of a catalog's
 * mechanics artifacts for the browser preview runtime (dual-execution thin slice).
 * CORS-open: the preview game runs on a different localhost origin. Read-only by design —
 * tuning goes through POST /api/preview/tune, which re-grades server-side.
 * Spec: docs/research/dual-execution-preview-spec.md
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function withCors(res: Response): Response {
  for (const [k, v] of Object.entries(CORS_HEADERS)) res.headers.set(k, v);
  return res;
}

export async function OPTIONS() {
  return withCors(new Response(null, { status: 204 }));
}

export async function GET(req: NextRequest) {
  try {
    const catalogId = req.nextUrl.searchParams.get('catalogId');
    if (!catalogId) return withCors(apiError('catalogId is required', 400));
    if (!isPreviewHydratable(catalogId)) {
      return withCors(
        apiError(
          `catalog "${catalogId}" has no preview hydration (supported: ${PREVIEW_HYDRATABLE_CATALOGS.join(', ')})`,
          404,
        ),
      );
    }

    const mechanicsSteps = new Set<string>(MECHANICS_STEPS);
    const entities: Record<string, Record<string, unknown>> = {};
    for (const a of listArtifacts(catalogId)) {
      if (!mechanicsSteps.has(a.step)) continue;
      (entities[a.entityId] ??= {})[a.step] = a.data;
    }
    return withCors(apiSuccess({ catalogId, steps: [...mechanicsSteps], entities }));
  } catch (e) {
    return withCors(apiError(e instanceof Error ? e.message : 'Preview hydrate failed', 500));
  }
}
