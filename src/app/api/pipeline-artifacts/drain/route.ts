import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { requireOperator } from '@/lib/api-auth';
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
/** The body keys that NARROW a drain (the `DrainFilter` fields). */
const SCOPE_KEYS: readonly (keyof DrainFilter)[] = ['tier', 'catalogId', 'entityId', 'entityIds'];

/** Test-only: clear the lease registry between cases. */
export function __resetDrainInFlight() { __resetLeases(); }

/** GET /api/pipeline-artifacts/drain?tier=L3[&catalogId=&entityId=] → the deferred jobs queue. */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const filter = parseDrainFilter((k) => sp.get(k));
    // Same rule as POST: a scope key the caller SENT but that did not parse (`tier=l3`, `entityId=`)
    // would preview a WIDER queue than it named, and the POST that runs it would refuse. Refuse here too.
    const unparsed = SCOPE_KEYS.filter((k) => sp.get(k) !== null && filter[k] === undefined);
    if (unparsed.length > 0) {
      return apiError(`drain scope key(s) ${unparsed.join(', ')} did not parse — refusing rather than previewing a wider queue`, 400);
    }
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
    const denied = requireOperator(req);
    if (denied) return denied;
    // The accepted body surface is declared ONCE in `drainRequest.ts` (DRAIN_REQUEST_KEYS) and
    // shared with the headless caller (`pof_drain_gates`), so an agent can reach every scope
    // this route supports — global, catalog-wide, a multi-entity batch, or one entity.
    // `autoCapture` (+ projectPath) is the L4 opt-in: the visual gate renders its OWN frame
    // (headless -game -RenderOffScreen) instead of staying deferred — pair with executor:'spawn'
    // so it doesn't collide with a live editor.
    // An EMPTY body is the explicit global drain. An unparseable or non-object one is refused:
    // it used to read as `{}` too, so a truncated single-entity body silently became a GLOBAL
    // drain (every deferred gate, UE editors booted for all of them).
    const text = await req.text();
    let rawBody: unknown = {};
    if (text.trim()) {
      try {
        rawBody = JSON.parse(text);
      } catch {
        return apiError('drain body is not valid JSON — refusing rather than widening to a global drain', 400);
      }
      if (typeof rawBody !== 'object' || rawBody === null || Array.isArray(rawBody)) {
        return apiError('drain body must be a JSON object', 400);
      }
    }
    const request = parseDrainRequest(rawBody);
    const filter: DrainFilter = request.filter;
    // A scope key the caller SENT but that did not parse (`entityId: 42`, `""`, `tier: "l3"`,
    // `entityIds: []`) used to be dropped silently, so the request ran a WIDER drain than it
    // named (catalog-wide or global). Narrowing is the caller's claim; refuse rather than widen.
    const body = rawBody as Record<string, unknown>;
    const unparsed = SCOPE_KEYS.filter((k) => body[k] !== undefined && body[k] !== null && filter[k] === undefined);
    if (unparsed.length > 0) {
      return apiError(`drain scope key(s) ${unparsed.join(', ')} did not parse — refusing rather than widening the drain`, 400);
    }
    // autoCapture without a project used to be dropped, leaving the L4 gates deferred under a 200.
    if (request.autoCapture && !request.projectPath) {
      return apiError('autoCapture requires projectPath (the UE project to render the frame from)', 400);
    }

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
