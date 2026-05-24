import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { listLifecycle, getLifecycle, upsertLifecycle } from '@/lib/catalog-db';
import { generationCallbackSchema, lifecycleStateSchema } from '@/lib/catalog/validation';
import { resolveTransition } from '@/lib/catalog/lifecycle';
import type { LifecycleRecord } from '@/lib/catalog/types';

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
 *   ↑ the generation @@CALLBACK target — applies the lifecycle gate server-side.
 */
export async function POST(req: NextRequest) {
  try {
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
    const currentState = existing?.lifecycle ?? 'planned';
    const resolved = resolveTransition(currentState, next.data, payload.data.testResult);
    if (!resolved) {
      return apiError(
        `Illegal lifecycle transition ${currentState} → ${next.data}` +
          (next.data === 'verified' ? ' (verified requires a passing test)' : ''),
        409,
      );
    }

    const merged = Array.from(new Set([...(existing?.ueAssets ?? []), ...payload.data.ueAssets]));
    const record: LifecycleRecord = {
      catalogId, entityId, lifecycle: resolved, ueAssets: merged,
      ...(payload.data.testResult ? { lastTestResult: payload.data.testResult } : {}),
      ...(resolved === 'verified' ? { lastVerifiedAt: new Date().toISOString() } : {}),
    };
    return apiSuccess(upsertLifecycle(record));
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'Catalog POST failed', 500);
  }
}
