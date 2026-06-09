import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { buildProposalPrompt } from '@/lib/one-shot/design-prompts';
import { validateProposal } from '@/lib/one-shot/validate-proposal';
import { seededEntities } from '@/lib/catalog/seed';
import { startExecution, awaitCallback } from '@/lib/claude-terminal/cli-service';
import { UI_TIMEOUTS } from '@/lib/constants';
import type { CatalogDistribution } from '@/lib/catalog/gap-analysis';

const PROJECT_PATH = process.env.POF_UE_UPROJECT ?? process.cwd();

/**
 * POST /api/one-shot/propose
 * Body: { catalogId: string; distribution: CatalogDistribution; userHint?: string }
 * Spawns a CLI execution, awaits the @@CALLBACK JSON, validates it, and returns the proposal.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Record<string, unknown>;
    const catalogId = typeof body.catalogId === 'string' ? body.catalogId : '';
    const distribution = body.distribution as CatalogDistribution | undefined;

    if (!catalogId) return apiError('catalogId is required', 400);
    if (!distribution || typeof distribution !== 'object') return apiError('distribution is required', 400);

    const userHint = typeof body.userHint === 'string' ? body.userHint : undefined;
    const prompt = buildProposalPrompt(catalogId, distribution, userHint);

    const executionId = startExecution(PROJECT_PATH, prompt);
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
    return apiError(e instanceof Error ? e.message : 'propose failed', 500);
  }
}
