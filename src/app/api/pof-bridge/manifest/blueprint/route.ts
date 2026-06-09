import { apiSuccess, apiError } from '@/lib/api-utils';
import { resolvePofPort } from '@/lib/pof-bridge/constants';
import { proxyToPofBridge, pofProxyError } from '@/lib/pof-bridge/proxy';
import type { BlueprintEntry } from '@/types/pof-bridge';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const port = resolvePofPort(searchParams);
  const path = searchParams.get('path');

  if (!path) {
    return apiError('Missing required "path" query parameter', 400);
  }

  const result = await proxyToPofBridge<BlueprintEntry & { error?: string }>(
    `manifest/blueprint?path=${encodeURIComponent(path)}`,
    { port, timeoutMs: 15000 },
  );
  if (!result.ok) return pofProxyError(result, 'Blueprint introspection error');

  // The C++ side returns { error: "..." } when the blueprint is not found.
  if (result.data.error) return apiError(result.data.error, 404);

  return apiSuccess(result.data as BlueprintEntry);
}
