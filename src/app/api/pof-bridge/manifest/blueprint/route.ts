import { apiSuccess, apiError } from '@/lib/api-utils';
import type { BlueprintEntry } from '@/types/pof-bridge';

const DEFAULT_POF_PORT = 30040;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const port = parseInt(searchParams.get('port') || String(DEFAULT_POF_PORT), 10);
  const path = searchParams.get('path');

  if (!path) {
    return apiError('Missing required "path" query parameter', 400);
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const url = `http://127.0.0.1:${port}/pof/manifest/blueprint?path=${encodeURIComponent(path)}`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return apiError(`Blueprint introspection error: ${text.slice(0, 200)}`, res.status);
    }

    const data = await res.json();

    // The C++ side returns { error: "..." } when the blueprint is not found
    if (data.error) {
      return apiError(data.error, 404);
    }

    return apiSuccess(data as BlueprintEntry);
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'Failed to reach PoF Bridge plugin');
  }
}
