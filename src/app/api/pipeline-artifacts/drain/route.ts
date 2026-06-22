import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { getOriginFromRequest } from '@/lib/constants';
import { buildExecutors, collectDeferred, drainAll, parseDrainFilter, type DrainFilter } from '@/lib/test-gate-runner';
import { resolveUprojectPath } from '@/lib/ue5-bridge/build-pipeline';

// Module-level in-flight set, scoped per catalogId|entityId (global key when both omitted).
// The drain talks to a shared, non-reentrant UE editor — overlapping requests would clobber
// each other and produce garbage verdicts. Mirrors the worker's tickInFlight guard.
const drainInFlight = new Set<string>();
const drainKey = (f: DrainFilter) => `${f.catalogId ?? '*'}|${f.entityId ?? '*'}`;
/** Test-only: clear the in-flight set between cases. */
export function __resetDrainInFlight() { drainInFlight.clear(); }

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
 * Body: { tier?, catalogId?, entityId?, executor?, port?, allowSpawn?, limit? }.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      tier?: string; catalogId?: string; entityId?: string;
      executor?: 'bridge' | 'spawn'; port?: number; allowSpawn?: boolean; limit?: number;
      screenshotPath?: string; visualMode?: 'hud' | 'texture' | 'lighting' | 'character';
      // L4 autonomous capture: with a projectPath + autoCapture, the visual gate renders its
      // OWN frame (headless -game -RenderOffScreen) instead of staying deferred. Opt-in (it
      // launches an editor — pair with executor:'spawn' so it doesn't collide with a live one).
      projectPath?: string; autoCapture?: boolean;
    };
    const filter = parseDrainFilter((k) => body[k]);
    const key = drainKey(filter);
    if (drainInFlight.has(key)) {
      const scope = filter.catalogId || filter.entityId
        ? `${filter.catalogId ?? '*'}/${filter.entityId ?? '*'}`
        : 'global';
      return apiError(`drain already in flight for ${scope} — refusing to overlap (UE editor is non-reentrant)`, 409);
    }
    drainInFlight.add(key);
    try {
      const executors = buildExecutors({
        executor: body.executor === 'spawn' ? 'spawn' : 'bridge',
        ...(body.port ? { port: body.port } : {}),
        ...(body.allowSpawn ? { allowSpawn: true } : {}),
        ...(body.screenshotPath ? { screenshotPath: body.screenshotPath } : {}),
        ...(body.visualMode ? { visualMode: body.visualMode } : {}),
        ...(body.autoCapture && body.projectPath
          ? { autoCapture: { uproject: resolveUprojectPath(body.projectPath, 'PoF') } }
          : {}),
        appOrigin: getOriginFromRequest(req),
      });
      const summary = await drainAll(executors, filter, body.limit != null ? { limit: body.limit } : undefined);
      return apiSuccess(summary);
    } finally {
      drainInFlight.delete(key);
    }
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'drain POST failed', 500);
  }
}
