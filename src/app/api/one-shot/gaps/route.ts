import { apiSuccess, apiError } from '@/lib/api-utils';
import { analyzeCatalog } from '@/lib/catalog/gap-analysis';
import { rankCatalogGaps } from '@/lib/catalog/gap-analysis/rankGaps';
import { CATALOG_SECTIONS } from '@/lib/catalog/sections';
import { seededEntities } from '@/lib/catalog/seed';
import { DEFAULT_CANON_PROFILE } from '@/lib/catalog/canon/profiles';

/**
 * GET /api/one-shot/gaps
 * Returns: CatalogGapRanking — every catalog's measured gaps ranked by deficit, plus the
 * catalogs with no basis (`unmeasured`) and those within tolerance (`balanced`). Cheap and
 * deterministic: `analyzeCatalog` only, no LLM, scoped to the `pof` profile like /analyze, so
 * the operator sees what to add BEFORE any CLI run is spent.
 */
export async function GET() {
  try {
    const distributions = CATALOG_SECTIONS.map((s) =>
      analyzeCatalog(s.catalogId, seededEntities(s.catalogId), { profile: DEFAULT_CANON_PROFILE }));
    return apiSuccess(rankCatalogGaps(distributions));
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'gap ranking failed', 500);
  }
}
