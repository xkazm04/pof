import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { deriveCatalogLifecycle, syncCatalogLifecycle, syncEntityLifecycle, CatalogNotFoundError } from '@/lib/catalog/headless';

/**
 * Entity lifecycle DERIVED from pipeline truth.
 *
 * Distinct from `POST /api/catalog` (the legacy generation @@CALLBACK, which applies
 * an operator-supplied transition): here nothing is supplied. The state is computed
 * from the entity's persisted artifacts — `configComplete` from `rollup.ts` plus the
 * gate evidence — and `verified` is reachable only through a DRAINED L3/L4 gate. There
 * is no manual toggle on this surface (Rule 4b), and a shape-only all-`pass` entity
 * stops at `wired` with an evidence sentence that says its runtime is unproven.
 *
 * GET  /api/catalog/lifecycle?catalogId=items[&entityId=x] → EntityLifecycleView[]
 *      READ-ONLY. Safe for display: it derives, it never writes.
 * POST /api/catalog/lifecycle { action: 'sync', catalogId, entityId? }
 *      Persists the derivation into `catalog_lifecycle` (idempotent, re-derivable)
 *      and reports which entities changed.
 */
export async function GET(req: NextRequest) {
  try {
    const catalogId = req.nextUrl.searchParams.get('catalogId');
    const entityId = req.nextUrl.searchParams.get('entityId') ?? undefined;
    if (!catalogId) return apiError('catalogId is required', 400);
    return apiSuccess(deriveCatalogLifecycle(catalogId, entityId));
  } catch (e) {
    if (e instanceof CatalogNotFoundError) return apiError(e.message, 404);
    return apiError(e instanceof Error ? e.message : 'Lifecycle GET failed', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    if (body.action !== 'sync') return apiError(`Unknown action: ${String(body.action)}`, 400);
    const catalogId = typeof body.catalogId === 'string' ? body.catalogId : '';
    const entityId = typeof body.entityId === 'string' && body.entityId ? body.entityId : undefined;
    if (!catalogId) return apiError('catalogId is required', 400);

    const results = entityId
      ? [syncEntityLifecycle(catalogId, entityId)]
      : syncCatalogLifecycle(catalogId);

    return apiSuccess({
      catalogId,
      synced: results.length,
      changed: results.filter((r) => r.changed).length,
      records: results.map((r) => ({
        entityId: r.record.entityId,
        lifecycle: r.record.lifecycle,
        changed: r.changed,
        ...(r.record.lastVerifiedAt ? { lastVerifiedAt: r.record.lastVerifiedAt } : {}),
        evidence: r.derived.evidence.summary,
      })),
    });
  } catch (e) {
    if (e instanceof CatalogNotFoundError) return apiError(e.message, 404);
    return apiError(e instanceof Error ? e.message : 'Lifecycle POST failed', 500);
  }
}
