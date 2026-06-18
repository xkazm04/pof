import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { buildRefinePrompt } from '@/lib/one-shot/design-prompts';
import { validateProposal } from '@/lib/one-shot/validate-proposal';
import { seededEntities } from '@/lib/catalog/seed';
import { startExecution, awaitCallback } from '@/lib/claude-terminal/cli-service';
import { UI_TIMEOUTS } from '@/lib/constants';
import type { CatalogDistribution } from '@/lib/catalog/gap-analysis';
import type { OneShotProposal } from '@/stores/oneShotJobStore';

const PROJECT_PATH = process.env.POF_UE_UPROJECT ?? process.cwd();

/**
 * POST /api/one-shot/refine
 * Body: { catalogId: string; distribution: CatalogDistribution; prior: OneShotProposal; userInput: string }
 * Mirrors /propose but uses buildRefinePrompt + a prior proposal.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Record<string, unknown>;
    const catalogId = typeof body.catalogId === 'string' ? body.catalogId : '';
    const distribution = body.distribution as CatalogDistribution | undefined;
    const prior = body.prior as OneShotProposal | undefined;
    const userInput = typeof body.userInput === 'string' ? body.userInput : '';

    if (!catalogId) return apiError('catalogId is required', 400);
    if (!distribution || typeof distribution !== 'object') return apiError('distribution is required', 400);
    if (!prior || typeof prior !== 'object') return apiError('prior is required', 400);
    if (!userInput) return apiError('userInput is required', 400);

    const prompt = buildRefinePrompt(catalogId, distribution, prior, userInput);

    const executionId = startExecution(PROJECT_PATH, prompt, undefined, undefined, { enableMcp: true });
    const parsed = await awaitCallback(executionId, { timeoutMs: UI_TIMEOUTS.callbackAwaitTimeout }) as Record<string, unknown>;

    const seededIds = new Set(seededEntities(catalogId).map((e) => e.id));
    const issues = validateProposal(catalogId, parsed as { name?: string; data?: unknown }, { seededIds });

    const proposal = {
      name: (parsed.name as string) ?? '',
      data: parsed.data ?? {},
      rationale: (parsed.rationale as string) ?? '',
      issues,
    };

    return apiSuccess(proposal);
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'refine failed', 500);
  }
}
