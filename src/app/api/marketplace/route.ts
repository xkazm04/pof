import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { buildFeatureGaps, generateRecommendations } from '@/lib/marketplace/recommendation-engine';
import { generateIntegration } from '@/lib/marketplace/integration-generator';
import type { FeatureStatus } from '@/types/feature-matrix';

/**
 * GET /api/marketplace?moduleId=arpg-combat&status=missing,partial
 * Returns asset recommendations based on feature gaps.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const moduleId = searchParams.get('moduleId') ?? undefined;
    const statusParam = searchParams.get('status');
    const statusFilter = statusParam
      ? (statusParam.split(',') as FeatureStatus[])
      : ['missing', 'partial', 'unknown'] as FeatureStatus[];

    // Build feature gaps from definitions (status comes from client-side feature matrix)
    // For the API, we treat all features as "unknown" unless the client provides status
    const statusMap = new Map<string, FeatureStatus>();
    const gaps = buildFeatureGaps(statusMap, moduleId, statusFilter);
    const result = generateRecommendations(gaps);

    return apiSuccess(result);
  } catch (err) {
    return apiError(
      err instanceof Error ? err.message : 'Failed to generate recommendations',
      500,
    );
  }
}

/**
 * POST /api/marketplace
 * Body: { action: 'recommend', statusMap, moduleId?, statusFilter? }
 *    or { action: 'integrate', assetId, moduleId, projectName, apiMacro, existingClasses }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === 'recommend') {
      const { statusMap: rawMap, moduleId, statusFilter } = body;

      // Reconstruct status map
      const statusMap = new Map<string, FeatureStatus>();
      if (rawMap && typeof rawMap === 'object') {
        for (const [key, val] of Object.entries(rawMap)) {
          statusMap.set(key, val as FeatureStatus);
        }
      }

      const gaps = buildFeatureGaps(
        statusMap,
        moduleId,
        statusFilter ?? ['missing', 'partial', 'unknown'],
      );
      const result = generateRecommendations(gaps);
      return apiSuccess(result);
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
