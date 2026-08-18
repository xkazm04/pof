import { apiSuccess } from '@/lib/api-utils';
import { resolvePofPort } from '@/lib/pof-bridge/constants';
import { proxyToPofBridge, pofProxyError } from '@/lib/pof-bridge/proxy';
import type { PofBridgeStatus } from '@/types/pof-bridge';

/**
 * `GET /api/pof-bridge/status` — proxy of the plugin's `GET /pof/status`.
 *
 * The success envelope carries EXACTLY {@link PofBridgeStatus}, so a caller
 * typing the response with `apiFetch<PofBridgeStatus>` cannot be silently wrong.
 *
 * A bridge that could not be reached (or that answered badly) returns the
 * `success: false` envelope — the same contract as every sibling route in this
 * directory, via {@link pofProxyError}. It previously degraded to
 * `apiSuccess({ connected: false })`: an object satisfying NONE of the type's 13
 * required fields, inside the success envelope, so `apiFetch` would not throw and
 * the caller would read `undefined` for everything it asked for. "We could not
 * ask the editor" is not "the editor answered" — and with the proxy's failure
 * `kind` the reason now says which it was (unreachable / timeout / malformed
 * reply), which a bare `connected: false` never could.
 */
export async function GET(request: Request) {
  const port = resolvePofPort(new URL(request.url).searchParams);

  const result = await proxyToPofBridge<PofBridgeStatus>('status', { port, timeoutMs: 5000 });
  if (!result.ok) return pofProxyError(result, 'Plugin status error');
  return apiSuccess(result.data);
}
