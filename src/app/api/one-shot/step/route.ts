import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { getCatalogPipeline } from '@/lib/catalog/pipeline-registry';
import { upsertArtifact } from '@/lib/pipeline-artifacts-db';
import { gradeArtifact, hasRegisteredChecker } from '@/lib/catalog/headless';
import { describeUngraded } from '@/lib/catalog/acceptance/stepGradability';
import { stampPromptVersion } from '@/lib/prompt-evolution/judge-fitness';
import { seededEntities } from '@/lib/catalog/seed';
import { withProduceDirection } from '@/lib/catalog/produceDirection';
import { startExecution, awaitCallback } from '@/lib/claude-terminal/cli-service';
import { resolveDispatchModelChoice } from '@/lib/model-policy';
import { ONE_SHOT_STEP_TASK_TYPE } from '@/lib/cli-spend/dispatchPlan';
import { UI_TIMEOUTS } from '@/lib/constants';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';
import type { AcceptanceStatus, AcceptanceTier } from '@/lib/catalog/acceptance/types';
import type { StoredCatalogEntity } from '@/lib/catalog/types';

const PROJECT_PATH = process.env.POF_UE_UPROJECT ?? process.cwd();

/** Used only when the caller supplies no direction of its own. */
export const DEFAULT_DIRECTION = 'derive from approved design; minimal commentary';

function entityToLab(e: { id: string; name: string; lifecycle: string; data?: unknown }): LabEntity {
  return { id: e.id, name: e.name, lifecycle: e.lifecycle as LabEntity['lifecycle'], data: e.data };
}

interface StepGrade {
  status: AcceptanceStatus;
  tier: AcceptanceTier;
  /** The persisted reason (checker's own), kept byte-identical to the other write paths. */
  reason?: string;
  /** What the operator is told — the reason, or the checker's detail when it gave none. */
  told?: string;
}

/**
 * Grade a produced step through the SAME server path every other write path uses
 * (`gradeArtifact` → `serverCheckerFor` + `safeAccept` + a real `CheckerContext`).
 *
 * This route used to call `step.accept(data)` bare: no context, no `safeAccept`, and a
 * hardcoded `pass` fallback. That mattered most for `linksResolve()`, which explicitly
 * self-reports that it CANNOT resolve without a context and returns `pass` — 63 step specs
 * compose it — so a live-produced step's cross-catalog links got a verdict the checker
 * itself disclaims, where the same payload through `/api/pipeline-artifacts` came back
 * `deferred` naming the unresolved targets. A checker that THREW 500'd the route and wrote
 * nothing, instead of degrading to `pending` with the thrown reason.
 *
 * (Honest scope: this path is opt-in and has never run against the real DB — 0 `draft-%`
 * rows, 0 rows carrying `produceDirection`. A trap disarmed before first use.)
 */
function gradeStep(
  catalogId: string,
  entityId: string,
  stepLabel: string,
  data: Record<string, unknown>,
): StepGrade {
  const { graded, raw } = gradeArtifact(catalogId, stepLabel, data, entityId);
  if (!graded || !raw) {
    // No server checker resolved — never an optimistic `pass`. The row says why.
    const reason = graded
      ? 'unverified: acceptance check did not resolve'
      : describeUngraded(catalogId, stepLabel, hasRegisteredChecker);
    return { status: 'pending', tier: 'L0', reason, told: reason };
  }
  return {
    status: raw.status,
    tier: raw.tier,
    ...(raw.reason ? { reason: raw.reason } : {}),
    ...(raw.reason || raw.detail ? { told: raw.reason ?? raw.detail } : {}),
  };
}

/**
 * The one-shot run log's vocabulary (`StepOutcome`). `deferred` is a Rule-5-LEGAL terminal
 * state for an L3/L4 gate and was previously reported to the operator as `fail`; it now
 * says deferral. `pending` has no run-log state of its own, so it reports as `fail` ("did
 * not succeed") — the exact 4-state truth rides along in the response's `status`.
 */
function toOutcome(status: AcceptanceStatus): 'pass' | 'deferred' | 'fail' {
  if (status === 'pass') return 'pass';
  if (status === 'deferred') return 'deferred';
  return 'fail';
}

/**
 * POST /api/one-shot/step
 * Body: {
 *   catalogId: string;
 *   entityId: string;
 *   stepLabel: string;
 *   mode: 'deterministic' | 'cli';
 *   direction?: string;                           // the operator's typed art direction
 *   proposal?: { name: string; data: unknown };   // required for draft entities (id draft-<cat>-<ts>)
 * }
 * `direction` is forwarded to `step.produce(entity, direction)` and embedded in the CLI
 * prompt; DEFAULT_DIRECTION is only the fallback when the caller supplies none. It is also
 * stamped onto the persisted artifact (`data.produceDirection`) so the row records what
 * drove it.
 * Runs a single pipeline step for the given entity and upserts the artifact.
 * Draft entities (created client-side) are resolved via the inline proposal payload;
 * seeded entities are resolved from the static catalog seed as before.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Record<string, unknown>;
    const catalogId = typeof body.catalogId === 'string' ? body.catalogId : '';
    const entityId = typeof body.entityId === 'string' ? body.entityId : '';
    const stepLabel = typeof body.stepLabel === 'string' ? body.stepLabel : '';
    const mode = body.mode === 'cli' ? 'cli' : 'deterministic';
    // Caller-supplied direction wins; the old constant is now only the fallback.
    const direction = typeof body.direction === 'string' && body.direction.trim()
      ? body.direction.trim()
      : DEFAULT_DIRECTION;

    // Optional inline proposal — required when entityId is a draft (not in seededEntities)
    const proposalRaw = body.proposal && typeof body.proposal === 'object' ? body.proposal as Record<string, unknown> : null;
    const proposal = proposalRaw && typeof proposalRaw.name === 'string'
      ? { name: proposalRaw.name, data: proposalRaw.data }
      : null;

    if (!catalogId) return apiError('catalogId is required', 400);
    if (!entityId) return apiError('entityId is required', 400);
    if (!stepLabel) return apiError('stepLabel is required', 400);

    const pipeline = getCatalogPipeline(catalogId);
    if (!pipeline) return apiError(`no pipeline registered for catalog '${catalogId}'`, 404);

    const step = pipeline.steps.find((s) => s.label === stepLabel);
    if (!step) return apiError(`step '${stepLabel}' not found in catalog '${catalogId}'`, 404);

    // Resolve entity: first check seeded entities, then fall back to the inline proposal
    // (draft entities live only in the client Zustand store and are never seeded server-side).
    let rawEntity: StoredCatalogEntity | undefined;
    const all = seededEntities(catalogId);
    rawEntity = all.find((e) => e.id === entityId);
    if (!rawEntity && proposal) {
      rawEntity = { id: entityId, name: proposal.name, data: proposal.data, catalogId, categoryPath: [], tags: ['one-shot'], lifecycle: 'planned' } as StoredCatalogEntity;
    }
    if (!rawEntity) return apiError(`entity '${entityId}' not found in catalog '${catalogId}' (and no proposal provided)`, 404);

    const entity = entityToLab(rawEntity);

    if (mode === 'deterministic') {
      // No CLI prompt drove a deterministic produce — the stamp records that honestly
      // (empty `prompt`) rather than fabricating one.
      const out = withProduceDirection(step.produce(entity, direction), { direction, prompt: '' });
      const data = (out.data ?? {}) as Record<string, unknown>;
      const grade = gradeStep(catalogId, entityId, stepLabel, data);
      // Grade the SUBMITTED data untouched; the provenance stamp is added only to what is
      // persisted (the additive-key pattern `/api/pipeline-artifacts` uses), so acceptance
      // can never shift because of it — and a live-produced artifact stops being invisible
      // to the prompt-fitness join.
      const stamped = stampPromptVersion(data);

      upsertArtifact({
        catalogId,
        entityId,
        step: stepLabel,
        data: stamped,
        ueAssets: out.ueAssets ?? [],
        status: grade.status,
        tier: grade.tier,
        reason: grade.reason,
      });

      return apiSuccess({
        outcome: toOutcome(grade.status),
        status: grade.status,
        tier: grade.tier,
        stepName: stepLabel,
        reason: grade.told,
        artifactData: stamped,
        ueAssets: out.ueAssets ?? [],
      });
    }

    // CLI mode
    const entitySummary = JSON.stringify({ id: entity.id, name: entity.name, data: entity.data }, null, 2);
    const promptText =
      `# PIPELINE STEP: ${stepLabel}\n\nCatalog: ${catalogId}\n\nEntity:\n${entitySummary}\n\n` +
      `Direction: ${direction}\n\nProduce the step output as a JSON @@CALLBACK block:\n` +
      `@@CALLBACK:step-${Date.now()}\n{}\n@@END_CALLBACK`;

    // Quality Program: this dispatch is governed by model policy like every other one.
    // It was previously the sole CLI produce in the app that spawned unpinned, because
    // `one-shot-step` had no entry in `taskClassForDispatchType`.
    const { model, effort } = resolveDispatchModelChoice({ taskType: ONE_SHOT_STEP_TASK_TYPE });
    const executionId = startExecution(PROJECT_PATH, promptText, undefined, undefined, {
      enableMcp: true,
      ...(model ? { model } : {}),
      ...(effort ? { effort } : {}),
      attribution: { moduleId: catalogId, taskType: ONE_SHOT_STEP_TASK_TYPE, taskLabel: stepLabel },
    });
    const payload = await awaitCallback(executionId, { timeoutMs: UI_TIMEOUTS.callbackAwaitTimeout }) as Record<string, unknown>;

    const mergedData = (withProduceDirection({ data: { ...(payload ?? {}) } }, { direction, prompt: promptText }).data
      ?? {}) as Record<string, unknown>;
    const grade = gradeStep(catalogId, entityId, stepLabel, mergedData);
    const stamped = stampPromptVersion(mergedData);

    const cliAssets = Array.isArray(payload.ueAssets) ? (payload.ueAssets as string[]) : [];
    upsertArtifact({
      catalogId,
      entityId,
      step: stepLabel,
      data: stamped,
      ueAssets: cliAssets,
      status: grade.status,
      tier: grade.tier,
      reason: grade.reason,
    });

    return apiSuccess({
      outcome: toOutcome(grade.status),
      status: grade.status,
      tier: grade.tier,
      stepName: stepLabel,
      reason: grade.told,
      artifactData: stamped,
      ueAssets: cliAssets,
    });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'step failed', 500);
  }
}
