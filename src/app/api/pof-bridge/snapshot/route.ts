import { apiSuccess } from '@/lib/api-utils';
import { resolvePofPort } from '@/lib/pof-bridge/constants';
import { proxyToPofBridge, pofProxyError } from '@/lib/pof-bridge/proxy';
import type { PofSnapshotCaptureRequest, PofSnapshotDiffReport } from '@/types/pof-bridge';

export async function POST(request: Request) {
  const port = resolvePofPort(new URL(request.url).searchParams);
  const body = await request.json() as { action: string } & PofSnapshotCaptureRequest & { presetIds?: string[] };

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
