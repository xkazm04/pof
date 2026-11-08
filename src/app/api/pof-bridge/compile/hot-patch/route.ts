import { apiSuccess, apiError } from '@/lib/api-utils';
import { requireOperator } from '@/lib/api-auth';
import { readJsonObject, MALFORMED_BODY_ERROR } from '@/app/api/blender-mcp/_lib/body';
import { resolvePofPort } from '@/lib/pof-bridge/constants';
import { proxyToPofBridge, pofProxyError } from '@/lib/pof-bridge/proxy';
import type { PofHotPatchRequest, PofHotPatchResult, PofCompileStatus, PofPatchPhase } from '@/types/pof-bridge';

export async function POST(request: Request) {
  const denied = requireOperator(request);
  if (denied) return denied;
  const port = resolvePofPort(new URL(request.url).searchParams);
  const raw = await readJsonObject(request);
  if (!raw) return apiError(MALFORMED_BODY_ERROR, 400);
  const body = raw as unknown as PofHotPatchRequest;

  if (!body.filePath || !body.fileContent) {
    return apiError('filePath and fileContent are required', 400);
  }
  if (typeof body.filePath !== 'string' || typeof body.fileContent !== 'string') {
    return apiError('filePath and fileContent must be strings', 400);
  }
  if (body.filePath.split(/[\\/]/).includes('..')) {
    return apiError('filePath must not contain traversal (..)', 400);
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
