import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { getOriginFromRequest } from '@/lib/constants';
import { startDrainWorker, stopDrainWorker, getWorkerStatus, parseDrainFilter } from '@/lib/test-gate-runner';

/** GET /api/pipeline-artifacts/drain/worker → current worker status. */
export async function GET() {
  return apiSuccess(getWorkerStatus());
}

/**
 * POST /api/pipeline-artifacts/drain/worker — operator toggle for the always-on
 * drain worker. Body: { action:'start'|'stop', intervalMs?, cooldownMs?, executor?,
 * port?, tier?, catalogId?, entityId? }.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      action?: 'start' | 'stop'; intervalMs?: number; cooldownMs?: number;
      executor?: 'bridge' | 'spawn'; port?: number;
      tier?: string; catalogId?: string; entityId?: string;
    };
    if (body.action === 'stop') return apiSuccess(stopDrainWorker());
    if (body.action !== 'start') return apiError("action must be 'start' or 'stop'", 400);

    const filter = parseDrainFilter((k) => body[k]);
    return apiSuccess(startDrainWorker({
      intervalMs: Math.max(5_000, body.intervalMs ?? 30_000),
      ...(body.cooldownMs != null ? { cooldownMs: body.cooldownMs } : {}),
      ...(Object.keys(filter).length ? { filter } : {}),
      executor: {
        executor: body.executor === 'spawn' ? 'spawn' : 'bridge',
        ...(body.port ? { port: body.port } : {}),
        appOrigin: getOriginFromRequest(req),
      },
    }));
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'drain worker toggle failed', 500);
  }
}
