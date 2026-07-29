import { type NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import {
  createVariant,
  seedBaselineVariant,
  mutateVariant,
  getVariantsForItem,
  getVariantsForModule,
  getAllTests,
  startABTest,
  recordTestTrial,
  concludeTest,
  clusterModulePrompts,
  getEvolutionStats,
  generateSuggestions,
  getBestVariant,
  getActiveVariant,
  resolveDispatchVariant,
  recordTrialForServedVariant,
  getVersionHistory,
  restoreVariant,
  optimizePrompt,
} from '@/lib/prompt-evolution/engine';
import { getPromptVersionFitness } from '@/lib/prompt-evolution/judge-fitness';
import { getModuleSessions, getModuleStats } from '@/lib/session-analytics-db';
import type { PromptEvolutionRequest } from '@/types/prompt-evolution';
import type { SubModuleId } from '@/types/modules';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as PromptEvolutionRequest;
    const { action } = body;

    switch (action) {
      // ── Variants ──────────────────────────────────────────────
      case 'get-variants': {
        if (!body.moduleId) return apiError('moduleId required', 400);
        const variants = body.checklistItemId
          ? getVariantsForItem(body.moduleId as SubModuleId, body.checklistItemId)
          : getVariantsForModule(body.moduleId as SubModuleId);
        return apiSuccess(variants);
      }

      case 'create-variant': {
        if (!body.moduleId || !body.checklistItemId || !body.prompt) {
          return apiError('moduleId, checklistItemId, and prompt required', 400);
        }
        const variant = createVariant(
          body.moduleId as SubModuleId,
          body.checklistItemId,
          body.prompt,
          'user-edit',
        );
        return apiSuccess(variant);
      }

      case 'seed-baseline-variant': {
        // Auto-capture v1 for a checklist item from the prompt being served, so
        // the A/B rail has an incumbent on a fresh DB. Idempotent: an item that
        // already has versions comes back with `seeded: false` and its active
        // version untouched.
        if (!body.moduleId || !body.checklistItemId || !body.prompt) {
          return apiError('moduleId, checklistItemId, and prompt required', 400);
        }
        const seeded = seedBaselineVariant(
          body.moduleId as SubModuleId,
          body.checklistItemId,
          body.prompt,
        );
        return apiSuccess(seeded);
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
        const test = startABTest(body.moduleId as SubModuleId, body.checklistItemId, body.variantId, body.testId);
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
        // 409: the test exists but has not earned a verdict yet — the reason
        // names the shortfall so the UI can say why nothing was decided.
        if (!concluded.ok) {
          return apiError(concluded.error, concluded.error === 'Test not found' ? 404 : 409);
        }
        return apiSuccess(concluded.data);
      }

      // ── Clustering ────────────────────────────────────────────
      case 'cluster-prompts': {
        if (!body.moduleId) return apiError('moduleId required', 400);
        const sessions = getModuleSessions(body.moduleId as SubModuleId);
        const clusters = clusterModulePrompts(sessions);
        return apiSuccess(clusters);
      }

      // ── Stats & Suggestions ───────────────────────────────────
      case 'get-stats': {
        const stats = getEvolutionStats();
        return apiSuccess(stats);
      }

      case 'get-prompt-fitness': {
        // Judge-scored quality per quality-pack prompt version (the WS1 improvement loop):
        // judge_verdicts ⋈ pipeline_artifacts ⋈ _provenance.promptVersion.
        return apiSuccess(getPromptVersionFitness());
      }

      case 'get-tests': {
        // List persisted A/B tests (all statuses) so the UI can show / conclude
        // them after a reload. Without this, started tests vanished from the
        // Tests tab while Stats still counted them as Active.
        const tests = getAllTests().filter((t) => !body.moduleId || t.moduleId === body.moduleId);
        return apiSuccess(tests);
      }

      case 'get-suggestions': {
        if (!body.moduleId) return apiError('moduleId required', 400);
        const sessions = getModuleSessions(body.moduleId as SubModuleId);
        const suggestions = generateSuggestions(body.moduleId as SubModuleId, sessions);
        return apiSuccess(suggestions);
      }

      case 'get-best-variant': {
        if (!body.moduleId || !body.checklistItemId) {
          return apiError('moduleId and checklistItemId required', 400);
        }
        const best = getBestVariant(body.moduleId as SubModuleId, body.checklistItemId);
        return apiSuccess(best);
      }

      case 'get-active-variant': {
        // The variant the dispatch path runs for a (module, checklist-item) key.
        // `null` → the item has no adopted variant, so dispatch uses the static
        // registry prompt. This is the read the CLI dispatch consults per run.
        if (!body.moduleId || !body.checklistItemId) {
          return apiError('moduleId and checklistItemId required', 400);
        }
        const active = getActiveVariant(body.moduleId as SubModuleId, body.checklistItemId);
        return apiSuccess(active);
      }

      case 'resolve-dispatch-variant': {
        // What the NEXT run of this checklist item should be served. With a
        // running A/B test this picks an arm (epsilon-greedy) and the caller
        // stamps the served id onto its callback so the trial can be booked;
        // with no test it is exactly `get-active-variant`.
        if (!body.moduleId || !body.checklistItemId) {
          return apiError('moduleId and checklistItemId required', 400);
        }
        const served = resolveDispatchVariant(body.moduleId as SubModuleId, body.checklistItemId);
        return apiSuccess(served);
      }

      case 'record-variant-trial': {
        // The callback side of the loop: a finished run reports its outcome for
        // the variant it was served. No running test on that variant → no trial
        // (`null`), which is a normal, non-error outcome.
        if (!body.moduleId || !body.checklistItemId || !body.variantId || body.success === undefined) {
          return apiError('moduleId, checklistItemId, variantId, and success required', 400);
        }
        const trial = recordTrialForServedVariant(
          body.moduleId as SubModuleId,
          body.checklistItemId,
          body.variantId,
          body.success,
          body.durationMs ?? 0,
        );
        return apiSuccess(trial);
      }

      // ── Version history & rollback ──────────────────────────────
      case 'get-version-history': {
        if (!body.moduleId || !body.checklistItemId) {
          return apiError('moduleId and checklistItemId required', 400);
        }
        const history = getVersionHistory(body.moduleId as SubModuleId, body.checklistItemId);
        return apiSuccess(history);
      }

      case 'restore-variant': {
        if (!body.variantId) return apiError('variantId required', 400);
        const restored = restoreVariant(body.variantId);
        if (!restored) return apiError('Variant not found', 404);
        return apiSuccess(restored);
      }

      // ── Prompt Optimizer ────────────────────────────────────────
      case 'optimize-prompt': {
        if (!body.moduleId || !body.prompt) {
          return apiError('moduleId and prompt required', 400);
        }
        const optSessions = getModuleSessions(body.moduleId as SubModuleId);
        const optStats = getModuleStats(body.moduleId as SubModuleId);
        const optResult = optimizePrompt(body.prompt, body.moduleId as SubModuleId, optSessions, optStats);
        return apiSuccess(optResult);
      }

      default:
        return apiError(`Unknown action: ${action}`, 400);
    }
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Internal error', 500);
  }
}
