import { apiSuccess, apiError } from '@/lib/api-utils';
import { resolvePofPort } from '@/lib/pof-bridge/constants';
import { proxyToPofBridge, pofProxyError } from '@/lib/pof-bridge/proxy';
import type { PofHotPatchRequest, PofHotPatchResult, PofCompileStatus, PofPatchPhase } from '@/types/pof-bridge';

export async function POST(request: Request) {
  const port = resolvePofPort(new URL(request.url).searchParams);
  const body = await request.json() as PofHotPatchRequest;

  if (!body.filePath || !body.fileContent) {
    return apiError('filePath and fileContent are required', 400);
  }

  // Hot-patch can take a while: file write + compile + verification.
  const result = await proxyToPofBridge<PofHotPatchResult>('compile/hot-patch', {
    port,
    method: 'POST',
    body,
    timeoutMs: 180_000,
  });
  if (!result.ok) return pofProxyError(result, 'Hot-patch error');
  return apiSuccess(result.data);
}

export async function GET(request: Request) {
  const port = resolvePofPort(new URL(request.url).searchParams);

  const result = await proxyToPofBridge<{ status: PofCompileStatus; patchPhase: PofPatchPhase }>(
    'compile/hot-patch/status',
    { port, timeoutMs: 5000 },
  );
  if (!result.ok) return pofProxyError(result, 'Failed to get hot-patch status');
  return apiSuccess(result.data);
}
