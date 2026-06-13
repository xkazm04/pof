import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { buildStepRecipe, CatalogNotFoundError } from '@/lib/catalog/headless';
import { listRules } from '@/lib/project-rules-db';
import { CANON_SEED } from '@/lib/catalog/canon/canon-seed';

/**
 * GET /api/catalog/step-recipe?catalogId=&entityId=&step=[&direction=] → StepRecipe
 *
 * The "structure + truth" the pof-mcp `pof_get_step` tool hands to the orchestrating
 * Claude: the canon-prefixed prompt, the View, the Acceptance contract, the UE asset
 * targets, and any already-persisted artifact. Claude does the work, then submits via
 * POST /api/pipeline-artifacts (the `pof_submit_artifact` tool) for the derived verdict.
 */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const catalogId = sp.get('catalogId');
    const entityId = sp.get('entityId');
    const step = sp.get('step');
    const direction = sp.get('direction') ?? undefined;
    if (!catalogId || !entityId || !step) {
      return apiError('catalogId, entityId, and step are required', 400);
    }
    // Canon source: the project_rules table; fall back to the seed when empty so the
    // prompt still carries canon on a fresh DB (mirrors the client canon store).
    const rules = listRules();
    const canon = rules.length ? rules : CANON_SEED;
    return apiSuccess(buildStepRecipe(catalogId, entityId, step, direction, canon));
  } catch (e) {
    if (e instanceof CatalogNotFoundError) return apiError(e.message, 404);
    return apiError(e instanceof Error ? e.message : 'step-recipe GET failed', 500);
  }
}
