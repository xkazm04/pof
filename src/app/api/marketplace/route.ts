import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { partitionFeatureMatrix, generateRecommendations } from '@/lib/marketplace/recommendation-engine';
import { generateIntegration } from '@/lib/marketplace/integration-generator';
import { ASSET_CATALOG } from '@/lib/marketplace/asset-catalog';
import { FEATURE_STATUSES, type FeatureStatus } from '@/types/feature-matrix';

/** A caller-supplied gap filter, keeping only real statuses; undefined → engine default. */
function parseStatusFilter(raw: unknown): FeatureStatus[] | undefined {
  const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(',') : null;
  if (!list) return undefined;
  const known = list.filter((v): v is FeatureStatus => (FEATURE_STATUSES as readonly unknown[]).includes(v));
  return known.length > 0 ? known : undefined;
}

/** Gaps (missing|partial by default) + unreviewed features, then recommendations for the gaps. */
function recommend(statusMap: Map<string, string>, moduleId: string | undefined, statusFilter: FeatureStatus[] | undefined) {
  const { gaps, unreviewed } = partitionFeatureMatrix(statusMap, moduleId, statusFilter);
  return generateRecommendations(gaps, ASSET_CATALOG, unreviewed);
}

/**
 * GET /api/marketplace?moduleId=arpg-combat&status=missing,partial
 * Returns asset recommendations based on feature gaps (default gap filter:
 * missing,partial; unknown features are returned as `unreviewed`).
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const moduleId = searchParams.get('moduleId') ?? undefined;
    const statusFilter = parseStatusFilter(searchParams.get('status'));

    // No status map on a GET: every feature is unreviewed (not a gap) unless the
    // caller explicitly filters 'unknown' in. Clients with statuses POST them.
    return apiSuccess(recommend(new Map(), moduleId, statusFilter));
  } catch (err) {
    return apiError(
      err instanceof Error ? err.message : 'Failed to generate recommendations',
      500,
    );
  }
}

/**
 * POST /api/marketplace
 * Body: { action: 'recommend', statusMap, moduleId?, statusFilter? } → gaps are
 *   statusMap's missing|partial features (or statusFilter's), `unreviewed` the rest
 *   with no verdict, grouped by module
 *    or { action: 'integrate', assetId, moduleId, projectName, apiMacro, existingClasses }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === 'recommend') {
      const { statusMap: rawMap, moduleId, statusFilter } = body;

      // Reconstruct status map (the engine reads an unrecognised status as 'unknown')
      const statusMap = new Map<string, string>();
      if (rawMap && typeof rawMap === 'object') {
        for (const [key, val] of Object.entries(rawMap)) {
          if (typeof val === 'string') statusMap.set(key, val);
        }
      }

      return apiSuccess(recommend(statusMap, moduleId, parseStatusFilter(statusFilter)));
    }

    if (action === 'integrate') {
      const { assetId, moduleId, projectName, apiMacro, existingClasses } = body;

      if (!assetId || !moduleId || !projectName) {
        return apiError('assetId, moduleId, and projectName are required', 400);
      }

      const integration = generateIntegration(
        assetId,
        moduleId,
        projectName,
        apiMacro ?? `${projectName.toUpperCase()}_API`,
        existingClasses ?? [],
      );

      if (!integration) {
        return apiError(`Asset not found: ${assetId}`, 404);
      }

      return apiSuccess({ integration });
    }

    return apiError(`Unknown action: ${action}`, 400);
  } catch (err) {
    return apiError(
      err instanceof Error ? err.message : 'Marketplace API error',
      500,
    );
  }
}
