import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { buildProposalPrompt } from '@/lib/one-shot/design-prompts';
import { validateProposal } from '@/lib/one-shot/validate-proposal';
import { seededEntities } from '@/lib/catalog/seed';
import { startExecution, awaitCallback } from '@/lib/claude-terminal/cli-service';
import { resolveDispatchModelChoice } from '@/lib/model-policy';
import { UI_TIMEOUTS } from '@/lib/constants';
import type { CatalogDistribution } from '@/lib/catalog/gap-analysis';
import { asGapTarget } from '@/lib/catalog/gap-analysis/rankGaps';

const PROJECT_PATH = process.env.POF_UE_UPROJECT ?? process.cwd();

/**
 * POST /api/one-shot/propose
 * Body: { catalogId: string; distribution: CatalogDistribution; userHint?: string; target?: GapTarget }
 * `target` is the gap the operator picked (GET /gaps or an under-represented bucket); the prompt
 * aims at it instead of asking the model to pick one. A malformed or foreign-catalog target is
 * refused BEFORE a CLI run is spent.
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
    const target = body.target == null ? undefined : asGapTarget(body.target);
    if (target === null) return apiError('target is malformed', 400);
    if (target && target.catalogId !== catalogId) {
      return apiError(`target is for '${target.catalogId}', not '${catalogId}'`, 400);
    }
    const prompt = buildProposalPrompt(catalogId, distribution, userHint, target);

    // Quality Program: govern this dispatch the same way one-shot-step's CLI produce
    // is governed — it was previously unpinned, spawning on whatever model the CLI
    // session defaulted to.
    const { model, effort } = resolveDispatchModelChoice({ taskType: 'one-shot-propose' });
    const executionId = startExecution(PROJECT_PATH, prompt, undefined, undefined, {
      enableMcp: true,
      ...(model ? { model } : {}),
      ...(effort ? { effort } : {}),
      attribution: { moduleId: catalogId, taskType: 'one-shot-propose', taskLabel: `Propose ${catalogId}` },
    });
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
