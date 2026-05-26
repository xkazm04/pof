import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { analyzeCatalog } from '@/lib/catalog/gap-analysis';
import { seededEntities } from '@/lib/catalog/seed';

/**
 * POST /api/one-shot/analyze
 * Body: { catalogId: string; userHint?: string }
 * Returns: CatalogDistribution
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Record<string, unknown>;
    const catalogId = typeof body.catalogId === 'string' ? body.catalogId : '';
    if (!catalogId) return apiError('catalogId is required', 400);

    const entities = seededEntities(catalogId);
    const distribution = analyzeCatalog(catalogId, entities);
    return apiSuccess(distribution);
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'analyze failed', 500);
  }
}
