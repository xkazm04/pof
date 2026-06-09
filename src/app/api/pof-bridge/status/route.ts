import { apiSuccess, apiError } from '@/lib/api-utils';
import { resolvePofPort } from '@/lib/pof-bridge/constants';
import { proxyToPofBridge } from '@/lib/pof-bridge/proxy';
import type { PofBridgeStatus } from '@/types/pof-bridge';

export async function GET(request: Request) {
  const port = resolvePofPort(new URL(request.url).searchParams);

  const result = await proxyToPofBridge<PofBridgeStatus>('status', { port, timeoutMs: 5000 });
  if (result.ok) return apiSuccess(result.data);
  // An unreachable bridge degrades gracefully to "disconnected"; a non-2xx is a real error.
  if (!result.reachable) return apiSuccess({ connected: false });
  return apiError(`Plugin returned ${result.status}`, result.status);
}
