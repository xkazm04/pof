import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { getOriginFromRequest } from '@/lib/constants';
import { buildExecutors, collectDeferred, drainAll, parseDrainFilter, type DrainFilter } from '@/lib/test-gate-runner';
import { parseDrainRequest } from '@/lib/test-gate-runner/drainRequest';
import { acquireLeases, releaseLeases, scopeFromKey, leaseKeysForFilter, __resetLeases } from '@/lib/test-gate-runner/drain-lease';
import { resolveUprojectPath } from '@/lib/ue5-bridge/build-pipeline';

// The drain talks to a shared, non-reentrant UE editor — overlapping requests would clobber
// each other and produce garbage verdicts. The lease (scoped per catalogId|entityId, global
// key when both omitted) lives in `drain-lease.ts` so a GET status route can READ it (the lab
// runner chip), turning a 409 surprise into visible truth. The SAME lease now also covers the
// always-on worker (`worker.runDrainTick`), so route + worker are mutually exclusive.
/** Test-only: clear the lease registry between cases. */
export function __resetDrainInFlight() { __resetLeases(); }

/** GET /api/pipeline-artifacts/drain?tier=L3[&catalogId=&entityId=] → the deferred jobs queue. */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const filter = parseDrainFilter((k) => sp.get(k));
    return apiSuccess(collectDeferred(filter));
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'drain GET failed', 500);
  }
}

/**
 * POST /api/pipeline-artifacts/drain — operator-triggered. Runs the deferred L3/L4
 * Test Gates through the chosen executors (bridge by default), writing verdicts back.
 * Body: { tier?, catalogId?, entityId?, entityIds?, executor?, port?, allowSpawn?, limit? }.
 *
 * `entityIds` (with `catalogId`) is a CATALOG-LEVEL batch: ONE collection + ONE availability
 * probe + ONE grouped boot cover the whole set (the spawn executor boots ONE editor for every
 * automation gate across all the entities). Lease semantics are ALL-OR-NOTHING: the batch
 * acquires the per-entity lease for every requested entity up front, and if ANY is already
 * in flight it refuses the whole batch with 409 — never two drains against the same entity
 * concurrently (the same guarantee the single-entity path gives, extended to the set).
 */
export async function POST(req: NextRequest) {
  try {
    // The accepted body surface is declared ONCE in `drainRequest.ts` (DRAIN_REQUEST_KEYS) and
    // shared with the headless caller (`pof_drain_gates`), so an agent can reach every scope
    // this route supports — global, catalog-wide, a multi-entity batch, or one entity.
    // `autoCapture` (+ projectPath) is the L4 opt-in: the visual gate renders its OWN frame
    // (headless -game -RenderOffScreen) instead of staying deferred — pair with executor:'spawn'
    // so it doesn't collide with a live editor.
    const request = parseDrainRequest(await req.json().catch(() => ({})));
    const filter: DrainFilter = request.filter;

    // Lease keys: one per requested entity for a batch, else the single (or global) key —
    // the same helper the worker uses, so both contend on one registry.
    const keys = leaseKeysForFilter(filter);
    const acquired = acquireLeases(keys);
    if (!acquired.ok) {
      return apiError(`drain already in flight for ${scopeFromKey(acquired.conflict)} — refusing to overlap (UE editor is non-reentrant)`, 409);
    }
    try {
      const executors = buildExecutors({
        executor: request.executor,
        ...(request.port ? { port: request.port } : {}),
        ...(request.allowSpawn ? { allowSpawn: true } : {}),
        ...(request.screenshotPath ? { screenshotPath: request.screenshotPath } : {}),
        ...(request.visualMode ? { visualMode: request.visualMode } : {}),
        ...(request.autoCapture && request.projectPath
          ? { autoCapture: { uproject: resolveUprojectPath(request.projectPath, 'PoF') } }
          : {}),
        appOrigin: getOriginFromRequest(req),
      });
      const summary = await drainAll(executors, filter, request.limit != null ? { limit: request.limit } : undefined);
      return apiSuccess(summary);
    } finally {
      releaseLeases(keys);
    }
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'drain POST failed', 500);
  }
}
