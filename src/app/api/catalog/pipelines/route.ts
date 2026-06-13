import { apiSuccess, apiError } from '@/lib/api-utils';
import { listCatalogSummaries } from '@/lib/catalog/headless';

/**
 * GET /api/catalog/pipelines → CatalogSummary[]
 * Every catalog the lab knows, with its ordered Produce steps + seeded entity count.
 * The pof-mcp `pof_list_catalogs` / `pof_get_pipeline` tools read this.
 */
export async function GET() {
  try {
    return apiSuccess(listCatalogSummaries());
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'pipelines GET failed', 500);
  }
}
