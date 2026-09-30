import { apiSuccess, apiError } from '@/lib/api-utils';
import { resolvePofPort } from '@/lib/pof-bridge/constants';
import { readManifestChecksum } from '@/lib/pof-bridge/manifest-feed';
import { proxyToPofBridge, pofProxyError } from '@/lib/pof-bridge/proxy';
import type { AssetManifest } from '@/types/pof-bridge';

/**
 * Full manifest, or `?checksum-only=true` for change detection. The plugin
 * answers the checksum as `{ checksum }` (its documented contract); the client
 * reads `{ checksumSha256 }` - normalized here so the two never disagree.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const port = resolvePofPort(searchParams);
  const checksumOnly = searchParams.get('checksum-only') === 'true';

  const result = await proxyToPofBridge<AssetManifest | { checksum: string }>(
    checksumOnly ? 'manifest?checksum-only=true' : 'manifest',
    { port, timeoutMs: 15000 },
  );
  if (!result.ok) return pofProxyError(result, 'Plugin manifest error');
  if (!checksumOnly) return apiSuccess(result.data);

  const checksumSha256 = readManifestChecksum(result.data);
  if (!checksumSha256) {
    return apiError('PoF Bridge checksum answer carried no checksum', 502);
  }
  return apiSuccess({ checksumSha256 });
}
