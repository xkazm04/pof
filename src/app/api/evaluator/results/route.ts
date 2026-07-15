import { NextRequest } from 'next/server';
import { apiSuccess, apiError, withRoute } from '@/lib/api-utils';
import { recordScanResult, getScanHistory, getLatestScan } from '@/lib/evaluator/evaluator-results-db';
import type { EvalFinding } from '@/lib/evaluator/finding-collector';

/**
 * Persist a completed deep-eval scan (durable regression baseline + history).
 * Body: `{ scanId, findings, modulesEvaluated, failedModules?, durationMs?, projectId?, scannedAt? }`.
 */
export const POST = withRoute(async (req: NextRequest) => {
  const body = (await req.json()) as {
    scanId?: string;
    findings?: unknown;
    modulesEvaluated?: unknown;
    failedModules?: unknown;
    durationMs?: number;
    projectId?: string;
    scannedAt?: string;
  };

  if (!body.scanId || typeof body.scanId !== 'string') {
    return apiError('scanId is required', 400);
  }
  if (!Array.isArray(body.findings)) {
    return apiError('findings must be an array', 400);
  }

  const modulesEvaluated = Array.isArray(body.modulesEvaluated)
    ? body.modulesEvaluated.filter((m): m is string => typeof m === 'string')
    : [];
  const failedModules = Array.isArray(body.failedModules)
    ? body.failedModules.filter((m): m is string => typeof m === 'string')
    : [];

  const scan = recordScanResult({
    scanId: body.scanId,
    projectId: typeof body.projectId === 'string' ? body.projectId : '',
    scannedAt: typeof body.scannedAt === 'string' ? body.scannedAt : undefined,
    durationMs: typeof body.durationMs === 'number' ? body.durationMs : 0,
    modulesEvaluated,
    failedModules,
    findings: body.findings as EvalFinding[],
  });

  return apiSuccess({ scan });
}, 'Failed to persist scan result');

/**
 * Read scan history. `?latest=1` returns the single most-recent scan (baseline
 * hydration); otherwise returns up to `?limit=N` scans, newest first. `?project=`
 * scopes to a project path.
 */
export const GET = withRoute(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('project') || undefined;

  if (searchParams.get('latest') === '1') {
    return apiSuccess({ scan: getLatestScan(projectId) });
  }

  const limitRaw = Number(searchParams.get('limit'));
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 500) : 50;
  return apiSuccess({ scans: getScanHistory(limit, projectId) });
}, 'Failed to read scan history');
