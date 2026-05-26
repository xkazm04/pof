import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { getCatalogPipeline } from '@/lib/catalog/pipeline-registry';
import { upsertArtifact } from '@/lib/pipeline-artifacts-db';
import { seededEntities } from '@/lib/catalog/seed';
import { startExecution, awaitCallback } from '@/lib/claude-terminal/cli-service';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';
import type { AcceptanceTier } from '@/lib/catalog/acceptance/types';

const PROJECT_PATH = process.env.POF_UE_UPROJECT ?? process.cwd();

function entityToLab(e: { id: string; name: string; lifecycle: string; data?: unknown }): LabEntity {
  return { id: e.id, name: e.name, lifecycle: e.lifecycle as LabEntity['lifecycle'], data: e.data };
}

/**
 * POST /api/one-shot/step
 * Body: { catalogId: string; entityId: string; stepLabel: string; mode: 'deterministic' | 'cli' }
 * Runs a single pipeline step for the given entity and upserts the artifact.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Record<string, unknown>;
    const catalogId = typeof body.catalogId === 'string' ? body.catalogId : '';
    const entityId = typeof body.entityId === 'string' ? body.entityId : '';
    const stepLabel = typeof body.stepLabel === 'string' ? body.stepLabel : '';
    const mode = body.mode === 'cli' ? 'cli' : 'deterministic';

    if (!catalogId) return apiError('catalogId is required', 400);
    if (!entityId) return apiError('entityId is required', 400);
    if (!stepLabel) return apiError('stepLabel is required', 400);

    const pipeline = getCatalogPipeline(catalogId);
    if (!pipeline) return apiError(`no pipeline registered for catalog '${catalogId}'`, 404);

    const step = pipeline.steps.find((s) => s.label === stepLabel);
    if (!step) return apiError(`step '${stepLabel}' not found in catalog '${catalogId}'`, 404);

    // Resolve entity from seeded entities (drafts live in the client store only).
    const all = seededEntities(catalogId);
    const rawEntity = all.find((e) => e.id === entityId);
    if (!rawEntity) return apiError(`entity '${entityId}' not found in catalog '${catalogId}'`, 404);

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

    const executionId = startExecution(PROJECT_PATH, promptText);
    const payload = await awaitCallback(executionId, { timeoutMs: 5 * 60 * 1000 }) as Record<string, unknown>;

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
