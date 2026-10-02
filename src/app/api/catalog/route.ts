import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { requireOperator } from '@/lib/api-auth';
import { listLifecycle, getLifecycle, upsertLifecycle } from '@/lib/catalog-db';
import { generationCallbackSchema, lifecycleStateSchema } from '@/lib/catalog/validation';
import { syncEntityLifecycle } from '@/lib/catalog/headless';
import { getCatalogPipeline } from '@/lib/catalog/pipeline-registry';
import { transitionOutcome } from '@/lib/catalog/generationPlan';
import { recordTrialForVariantId } from '@/lib/prompt-evolution/engine';
import { STATIC_VARIANT_ID } from '@/lib/prompt-evolution/dispatch-resolve';
import { logger } from '@/lib/logger';

/** GET /api/catalog?catalogId=spellbook → LifecycleRecord[] */
export async function GET(req: NextRequest) {
  try {
    const catalogId = req.nextUrl.searchParams.get('catalogId');
    if (!catalogId) return apiError('catalogId is required', 400);
    return apiSuccess(listLifecycle(catalogId));
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'Catalog GET failed', 500);
  }
}

/**
 * POST /api/catalog
 *   { action: 'transition', catalogId, entityId, nextLifecycle, ueAssets?, testResult? }
 *   ↑ the generation @@CALLBACK target. It RECORDS evidence (the reported ueAssets)
 *   and returns `{ ...record, requested, held?, trialRecorded }` — it does not walk a
 *   lifecycle ladder. ONE lifecycle writer: the persisted lifecycle is the derivation
 *   (`syncEntityLifecycle`, the same sync `commitArtifact` runs), so `nextLifecycle`
 *   is only what the step ASKED for, and a session-reported testResult never writes
 *   'verified' or lastVerifiedAt — only a drained L3/L4 gate does (lifecycle.ts).
 *   `held` says why the derivation is below the request. An unregistered catalog
 *   has nothing to derive from: lifecycle untouched (a new row starts 'planned').
 */
export async function POST(req: NextRequest) {
  try {
    const denied = requireOperator(req);
    if (denied) return denied;
    const body = await req.json();
    if (body.action !== 'transition') return apiError(`Unknown action: ${body.action}`, 400);

    const next = lifecycleStateSchema.safeParse(body.nextLifecycle);
    const catalogId = typeof body.catalogId === 'string' ? body.catalogId : '';
    const entityId = typeof body.entityId === 'string' ? body.entityId : '';
    if (!next.success || !catalogId || !entityId) {
      return apiError('catalogId, entityId, and a valid nextLifecycle are required', 400);
    }
    const payload = generationCallbackSchema.safeParse({
      ueAssets: body.ueAssets, testResult: body.testResult, error: body.error,
    });
    if (!payload.success) return apiError('Invalid callback payload', 400, payload.error.issues);

    const existing = getLifecycle(catalogId, entityId);
    const merged = Array.from(new Set([...(existing?.ueAssets ?? []), ...payload.data.ueAssets]));
    // Evidence first: the reported assets land on the row with its lifecycle untouched…
    const recorded = upsertLifecycle({
      ...(existing ?? {}), catalogId, entityId,
      lifecycle: existing?.lifecycle ?? 'planned', ueAssets: merged,
    });
    // …then the derivation — the one lifecycle writer — decides the state.
    const synced = getCatalogPipeline(catalogId) ? syncEntityLifecycle(catalogId, entityId) : null;
    const saved = synced?.record ?? recorded;
    const held = transitionOutcome(next.data, synced ? synced.derived : null);

    // ── Close the A/B loop for the RECIPE path ────────────────────────────────
    // The dispatch stamps the variant it was served into the callback's static
    // fields; a completed transition is that run's outcome (a `verify` step also
    // has to have passed its test). Best-effort — the lifecycle write is the
    // primary job and must never fail because the experiment layer did.
    let trialRecorded = false;
    const promptVariantId = typeof body.promptVariantId === 'string' ? body.promptVariantId : '';
    if (promptVariantId && promptVariantId !== STATIC_VARIANT_ID) {
      try {
        const success = payload.data.testResult ? payload.data.testResult === 'pass' : true;
        trialRecorded = recordTrialForVariantId(promptVariantId, success) !== null;
      } catch (e) {
        logger.warn('catalog/transition: could not record A/B trial', e);
      }
    }

    return apiSuccess({ ...saved, requested: next.data, ...(held ? { held } : {}), trialRecorded });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'Catalog POST failed', 500);
  }
}
