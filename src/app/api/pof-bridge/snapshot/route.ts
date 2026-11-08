import { apiSuccess, apiError } from '@/lib/api-utils';
import { requireOperator } from '@/lib/api-auth';
import { readJsonObject, MALFORMED_BODY_ERROR } from '@/app/api/blender-mcp/_lib/body';
import { resolvePofPort } from '@/lib/pof-bridge/constants';
import { proxyToPofBridge, pofProxyError } from '@/lib/pof-bridge/proxy';
import type { PofSnapshotCaptureRequest, PofSnapshotDiffReport } from '@/types/pof-bridge';

export async function POST(request: Request) {
  const denied = requireOperator(request);
  if (denied) return denied;
  const port = resolvePofPort(new URL(request.url).searchParams);
  const raw = await readJsonObject(request);
  if (!raw) return apiError(MALFORMED_BODY_ERROR, 400);
  const body = raw as { action?: string } & Partial<PofSnapshotCaptureRequest>;

  // No action is a capture: that is what useSnapshots posts.
  if (body.action !== undefined && body.action !== 'capture' && body.action !== 'baseline') {
    return apiError("action must be 'capture' or 'baseline'", 400);
  }
  const presetIds: unknown = body.presetIds;
  if (presetIds !== undefined && !(Array.isArray(presetIds) && presetIds.every((p) => typeof p === 'string'))) {
    return apiError('presetIds must be an array of strings', 400);
  }
  if (body.diffThreshold !== undefined && typeof body.diffThreshold !== 'number') {
    return apiError('diffThreshold must be a number', 400);
  }

  const isBaseline = body.action === 'baseline';
  const result = await proxyToPofBridge(isBaseline ? 'snapshot/baseline' : 'snapshot/capture', {
    port,
    method: 'POST',
    body: isBaseline ? { presetIds: body.presetIds } : body,
    timeoutMs: 30000,
  });
  if (!result.ok) return pofProxyError(result, 'Snapshot error');
  return apiSuccess(result.data);
}

export async function GET(request: Request) {
  const port = resolvePofPort(new URL(request.url).searchParams);

  const result = await proxyToPofBridge<PofSnapshotDiffReport>('snapshot/diff', {
    port,
    timeoutMs: 10000,
  });
  if (!result.ok) return pofProxyError(result, 'Snapshot diff error');
  return apiSuccess(result.data);
}
