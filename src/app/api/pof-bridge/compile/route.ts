import { apiSuccess } from '@/lib/api-utils';
import { resolvePofPort } from '@/lib/pof-bridge/constants';
import { proxyToPofBridge, pofProxyError } from '@/lib/pof-bridge/proxy';
import type { PofCompileRequest, PofCompileResult, PofCompileStatus } from '@/types/pof-bridge';

export async function POST(request: Request) {
  const port = resolvePofPort(new URL(request.url).searchParams);
  const body = await request.json() as PofCompileRequest;

  // Allow longer timeout for compilation.
  const timeoutMs = (body.timeoutSeconds ?? 120) * 1000 + 5000;
  const result = await proxyToPofBridge<PofCompileResult>('compile/live', {
    port,
    method: 'POST',
    body,
    timeoutMs,
  });
  if (!result.ok) return pofProxyError(result, 'Compile error');
  return apiSuccess(result.data);
}

export async function GET(request: Request) {
  const port = resolvePofPort(new URL(request.url).searchParams);

  const result = await proxyToPofBridge<{ status: PofCompileStatus }>('compile/status', {
    port,
    timeoutMs: 5000,
  });
  if (!result.ok) return pofProxyError(result, 'Failed to get compile status');
  return apiSuccess(result.data);
}
