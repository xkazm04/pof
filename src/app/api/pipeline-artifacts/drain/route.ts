import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { getOriginFromRequest } from '@/lib/constants';
import { buildExecutors, collectDeferred, drainAll, type DrainFilter, type GateTier } from '@/lib/test-gate-runner';

function parseTier(v: string | null | undefined): GateTier | undefined {
  return v === 'L3' || v === 'L4' ? v : undefined;
}

/** GET /api/pipeline-artifacts/drain?tier=L3[&catalogId=&entityId=] → the deferred jobs queue. */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const filter: DrainFilter = {
      ...(parseTier(sp.get('tier')) ? { tier: parseTier(sp.get('tier')) } : {}),
      ...(sp.get('catalogId') ? { catalogId: sp.get('catalogId')! } : {}),
      ...(sp.get('entityId') ? { entityId: sp.get('entityId')! } : {}),
    };
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
    };
    const filter: DrainFilter = {
      ...(parseTier(body.tier) ? { tier: parseTier(body.tier) } : {}),
      ...(body.catalogId ? { catalogId: body.catalogId } : {}),
      ...(body.entityId ? { entityId: body.entityId } : {}),
    };
    const executors = buildExecutors({
      executor: body.executor === 'spawn' ? 'spawn' : 'bridge',
      ...(body.port ? { port: body.port } : {}),
      ...(body.allowSpawn ? { allowSpawn: true } : {}),
      ...(body.screenshotPath ? { screenshotPath: body.screenshotPath } : {}),
      ...(body.visualMode ? { visualMode: body.visualMode } : {}),
      appOrigin: getOriginFromRequest(req),
    });
    const summary = await drainAll(executors, filter, body.limit != null ? { limit: body.limit } : undefined);
    return apiSuccess(summary);
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'drain POST failed', 500);
  }
}
