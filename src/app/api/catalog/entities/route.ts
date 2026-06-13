import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { listEntitySummaries, CatalogNotFoundError } from '@/lib/catalog/headless';

/**
 * GET /api/catalog/entities?catalogId=items → EntitySummary[]
 * Seeded entities for a catalog, with current lifecycle merged from the DB.
 * The pof-mcp `pof_list_entities` tool reads this.
 */
export async function GET(req: NextRequest) {
  try {
    const catalogId = req.nextUrl.searchParams.get('catalogId');
    if (!catalogId) return apiError('catalogId is required', 400);
    return apiSuccess(listEntitySummaries(catalogId));
  } catch (e) {
    if (e instanceof CatalogNotFoundError) return apiError(e.message, 404);
    return apiError(e instanceof Error ? e.message : 'entities GET failed', 500);
  }
}
