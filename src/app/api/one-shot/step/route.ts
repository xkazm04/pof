import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { getCatalogPipeline } from '@/lib/catalog/pipeline-registry';
import { upsertArtifact } from '@/lib/pipeline-artifacts-db';
import { seededEntities } from '@/lib/catalog/seed';
import { startExecution, awaitCallback } from '@/lib/claude-terminal/cli-service';
import { UI_TIMEOUTS } from '@/lib/constants';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';
import type { AcceptanceTier } from '@/lib/catalog/acceptance/types';
import type { StoredCatalogEntity } from '@/lib/catalog/types';

const PROJECT_PATH = process.env.POF_UE_UPROJECT ?? process.cwd();

function entityToLab(e: { id: string; name: string; lifecycle: string; data?: unknown }): LabEntity {
  return { id: e.id, name: e.name, lifecycle: e.lifecycle as LabEntity['lifecycle'], data: e.data };
}

/**
 * POST /api/one-shot/step
 * Body: {
 *   catalogId: string;
 *   entityId: string;
 *   stepLabel: string;
 *   mode: 'deterministic' | 'cli';
 *   proposal?: { name: string; data: unknown };   // required for draft entities (id draft-<cat>-<ts>)
 * }
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
      const out = step.produce(entity);
      const data = out.data ?? {};
      const accept = step.accept
        ? step.accept(data as Record<string, unknown>)
        : { tier: 'L0' as AcceptanceTier, status: 'pass' as const, label: stepLabel, detail: '' };

      upsertArtifact({
        catalogId,
        entityId,
        step: stepLabel,
        data: data as Record<string, unknown>,
        ueAssets: out.ueAssets ?? [],
        status: accept.status,
        tier: accept.tier,
        reason: accept.reason,
      });

      return apiSuccess({
        outcome: accept.status === 'pass' ? 'pass' : 'fail',
        stepName: stepLabel,
        reason: accept.reason,
      });
    }

    // CLI mode
    const direction = 'derive from approved design; minimal commentary';
    const entitySummary = JSON.stringify({ id: entity.id, name: entity.name, data: entity.data }, null, 2);
    const promptText =
      `# PIPELINE STEP: ${stepLabel}\n\nCatalog: ${catalogId}\n\nEntity:\n${entitySummary}\n\n` +
      `Direction: ${direction}\n\nProduce the step output as a JSON @@CALLBACK block:\n` +
      `@@CALLBACK:step-${Date.now()}\n{}\n@@END_CALLBACK`;

    const executionId = startExecution(PROJECT_PATH, promptText, undefined, undefined, { enableMcp: true });
    const payload = await awaitCallback(executionId, { timeoutMs: UI_TIMEOUTS.callbackAwaitTimeout }) as Record<string, unknown>;

    const mergedData = { ...(payload ?? {}) } as Record<string, unknown>;
    const accept = step.accept
      ? step.accept(mergedData)
      : { tier: 'L0' as AcceptanceTier, status: 'pass' as const, label: stepLabel, detail: '' };

    upsertArtifact({
      catalogId,
      entityId,
      step: stepLabel,
      data: mergedData,
      ueAssets: Array.isArray(payload.ueAssets) ? (payload.ueAssets as string[]) : [],
      status: accept.status,
      tier: accept.tier,
      reason: accept.reason,
    });

    return apiSuccess({
      outcome: accept.status === 'pass' ? 'pass' : 'fail',
      stepName: stepLabel,
      reason: accept.reason,
    });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'step failed', 500);
  }
}
