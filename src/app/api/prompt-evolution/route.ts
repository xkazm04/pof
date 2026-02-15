import { type NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import {
  createVariant,
  mutateVariant,
  getVariantsForItem,
  getVariantsForModule,
  startABTest,
  recordTestTrial,
  concludeTest,
  getActiveTests,
  getAllTests,
  clusterModulePrompts,
  getEvolutionStats,
  generateSuggestions,
  getBestVariant,
  optimizePrompt,
} from '@/lib/prompt-evolution/engine';
import { getModuleSessions, getModuleStats } from '@/lib/session-analytics-db';
import type { PromptEvolutionRequest } from '@/types/prompt-evolution';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as PromptEvolutionRequest;
    const { action } = body;

    switch (action) {
      // ── Variants ──────────────────────────────────────────────
      case 'get-variants': {
        if (!body.moduleId) return apiError('moduleId required', 400);
        const variants = body.checklistItemId
          ? getVariantsForItem(body.moduleId, body.checklistItemId)
          : getVariantsForModule(body.moduleId);
        return apiSuccess(variants);
      }

      case 'create-variant': {
        if (!body.moduleId || !body.checklistItemId || !body.prompt) {
          return apiError('moduleId, checklistItemId, and prompt required', 400);
        }
        const variant = createVariant(
          body.moduleId,
          body.checklistItemId,
          body.prompt,
          'user-edit',
        );
        return apiSuccess(variant);
      }

      case 'mutate-variant': {
        if (!body.variantId || !body.mutationType) {
          return apiError('variantId and mutationType required', 400);
        }
        const mutated = mutateVariant(body.variantId, body.mutationType);
        if (!mutated) return apiError('Variant not found', 404);
        return apiSuccess(mutated);
      }

      // ── A/B Testing ───────────────────────────────────────────
      case 'start-ab-test': {
        if (!body.moduleId || !body.checklistItemId || !body.variantId || !body.testId) {
          return apiError('moduleId, checklistItemId, variantId (A), and testId (B) required', 400);
        }
        const test = startABTest(body.moduleId, body.checklistItemId, body.variantId, body.testId);
        return apiSuccess(test);
      }

      case 'record-trial': {
        if (!body.testId || !body.variantId || body.success === undefined) {
          return apiError('testId, variantId (A|B), and success required', 400);
        }
        const slot = body.variantId as 'A' | 'B';
        const result = recordTestTrial(body.testId, slot, body.success, body.durationMs ?? 0);
        if (!result) return apiError('Test not found or not running', 404);
        return apiSuccess(result);
      }

      case 'conclude-test': {
        if (!body.testId) return apiError('testId required', 400);
        const concluded = concludeTest(body.testId);
        if (!concluded) return apiError('Test not found', 404);
        return apiSuccess(concluded);
      }

      // ── Clustering ────────────────────────────────────────────
      case 'cluster-prompts': {
        if (!body.moduleId) return apiError('moduleId required', 400);
        const sessions = getModuleSessions(body.moduleId);
        const clusters = clusterModulePrompts(sessions);
        return apiSuccess(clusters);
      }

      // ── Stats & Suggestions ───────────────────────────────────
      case 'get-stats': {
        const stats = getEvolutionStats();
        return apiSuccess(stats);
      }

      case 'get-suggestions': {
        if (!body.moduleId) return apiError('moduleId required', 400);
        const sessions = getModuleSessions(body.moduleId);
        const suggestions = generateSuggestions(body.moduleId, sessions);
        return apiSuccess(suggestions);
      }

      case 'get-best-variant': {
        if (!body.moduleId || !body.checklistItemId) {
          return apiError('moduleId and checklistItemId required', 400);
        }
        const best = getBestVariant(body.moduleId, body.checklistItemId);
        return apiSuccess(best);
      }

      // ── Prompt Optimizer ────────────────────────────────────────
      case 'optimize-prompt': {
        if (!body.moduleId || !body.prompt) {
          return apiError('moduleId and prompt required', 400);
        }
        const optSessions = getModuleSessions(body.moduleId);
        const optStats = getModuleStats(body.moduleId);
        const optResult = optimizePrompt(body.prompt, body.moduleId, optSessions, optStats);
        return apiSuccess(optResult);
      }

      default:
        return apiError(`Unknown action: ${action}`, 400);
    }
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Internal error', 500);
  }
}
