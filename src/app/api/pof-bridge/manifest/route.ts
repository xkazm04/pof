import { apiSuccess, apiError } from '@/lib/api-utils';
import type { AssetManifest } from '@/types/pof-bridge';

const DEFAULT_POF_PORT = 30040;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const port = parseInt(searchParams.get('port') || String(DEFAULT_POF_PORT), 10);
  const checksumOnly = searchParams.get('checksum-only') === 'true';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const url = checksumOnly
      ? `http://127.0.0.1:${port}/pof/manifest?checksum-only=true`
      : `http://127.0.0.1:${port}/pof/manifest`;

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return apiError(`Plugin manifest error: ${text.slice(0, 200)}`, res.status);
    }

    const data = await res.json();
    return apiSuccess(data as AssetManifest | { checksum: string });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'Failed to reach PoF Bridge plugin');
  }
}
