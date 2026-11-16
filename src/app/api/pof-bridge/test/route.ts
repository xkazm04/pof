import { apiSuccess, apiError } from '@/lib/api-utils';
import { requireOperator } from '@/lib/api-auth';
import { readJsonObject, MALFORMED_BODY_ERROR } from '@/app/api/blender-mcp/_lib/body';
import { resolvePofPort } from '@/lib/pof-bridge/constants';
import { proxyToPofBridge, pofProxyError } from '@/lib/pof-bridge/proxy';
import type { PofTestSpec, PofTestResult } from '@/types/pof-bridge';

export async function POST(request: Request) {
  const denied = requireOperator(request);
  if (denied) return denied;
  const port = resolvePofPort(new URL(request.url).searchParams);
  const raw = await readJsonObject(request);
  if (!raw) return apiError(MALFORMED_BODY_ERROR, 400);
  const body = raw as { action?: string; spec?: PofTestSpec; filter?: string; flags?: string[] };

  if (body.action !== 'run' && body.action !== 'run-automation') {
    return apiError("action must be 'run' or 'run-automation'", 400);
  }
  const isAutomation = body.action === 'run-automation';
  if (isAutomation) {
    if (typeof body.filter !== 'string' || !body.filter) return apiError('filter is required for run-automation', 400);
    const flags: unknown = body.flags;
    if (flags !== undefined && !(Array.isArray(flags) && flags.every((f) => typeof f === 'string'))) {
      return apiError('flags must be an array of strings', 400);
    }
  } else if (typeof body.spec !== 'object' || body.spec === null || Array.isArray(body.spec)) {
    return apiError('spec is required for run', 400);
  }
  const result = await proxyToPofBridge(isAutomation ? 'test/run-automation' : 'test/run', {
    port,
    method: 'POST',
    body: isAutomation ? { filter: body.filter, flags: body.flags } : body.spec,
    timeoutMs: 15000,
  });
  if (!result.ok) return pofProxyError(result, 'Test runner error');
  return apiSuccess(result.data);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const port = resolvePofPort(searchParams);
  const testId = searchParams.get('testId');
  // encodeURIComponent leaves dots alone, so these would climb out of test/results/.
  if (testId === '.' || testId === '..') return apiError('testId is not a valid id', 400);

  const result = await proxyToPofBridge<PofTestResult | { results: PofTestResult[] }>(
    testId ? `test/results/${encodeURIComponent(testId)}` : 'test/results',
    { port, timeoutMs: 10000 },
  );
  if (!result.ok) return pofProxyError(result, 'Test results error');
  return apiSuccess(result.data);
}
