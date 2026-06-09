import { apiSuccess } from '@/lib/api-utils';
import { resolvePofPort } from '@/lib/pof-bridge/constants';
import { proxyToPofBridge, pofProxyError } from '@/lib/pof-bridge/proxy';
import type { AssetManifest } from '@/types/pof-bridge';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const port = resolvePofPort(searchParams);
  const checksumOnly = searchParams.get('checksum-only') === 'true';

  const result = await proxyToPofBridge<AssetManifest | { checksum: string }>(
    checksumOnly ? 'manifest?checksum-only=true' : 'manifest',
    { port, timeoutMs: 15000 },
  );
  if (!result.ok) return pofProxyError(result, 'Plugin manifest error');
  return apiSuccess(result.data);
}
