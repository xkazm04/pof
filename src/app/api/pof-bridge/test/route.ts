import { apiSuccess } from '@/lib/api-utils';
import { resolvePofPort } from '@/lib/pof-bridge/constants';
import { proxyToPofBridge, pofProxyError } from '@/lib/pof-bridge/proxy';
import type { PofTestSpec, PofTestResult } from '@/types/pof-bridge';

export async function POST(request: Request) {
  const port = resolvePofPort(new URL(request.url).searchParams);
  const body = await request.json() as { action: string; spec?: PofTestSpec; filter?: string; flags?: string[] };

  const isAutomation = body.action === 'run-automation';
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

  const result = await proxyToPofBridge<PofTestResult | { results: PofTestResult[] }>(
    testId ? `test/results/${encodeURIComponent(testId)}` : 'test/results',
    { port, timeoutMs: 10000 },
  );
  if (!result.ok) return pofProxyError(result, 'Test results error');
  return apiSuccess(result.data);
}
