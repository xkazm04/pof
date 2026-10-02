/**
 * Shared proxy helper for the `/api/pof-bridge/*` route handlers.
 *
 * Every bridge route used to re-implement the same dance: build a hardcoded
 * `http://127.0.0.1:${port}/pof/...` URL, arm an ad-hoc timeout, check `res.ok`,
 * slice the error text to 200 chars, and map to the API envelope.
 * {@link proxyToPofBridge} centralizes that so each route is a few lines, and
 * {@link pofProxyError} formats the standard failure envelope. The HTTP call
 * itself is the bridge transport kernel (`@/lib/bridge/transport`), which decides
 * what a failure IS; this host only names it for the PoF routes.
 *
 * This transport is how the app learns whether anything is real in the actual
 * editor, so it reports what ACTUALLY happened: a plugin that answers with a
 * broken body is never reported as "editor not running".
 */
import { apiError } from '@/lib/api-utils';
import { logger } from '@/lib/logger';
import { bridgeFetch } from '@/lib/bridge/transport';
import { POF_BRIDGE } from './constants';

/**
 * Why a {@link proxyToPofBridge} call failed. Distinguishing these is the point:
 * only `unreachable` and `timeout` mean "go look at the editor"; the others mean
 * the plugin answered.
 *
 * - `unreachable`    — no response at all (connection refused / DNS / socket error).
 * - `timeout`        — the request was aborted by our own deadline; nothing usable arrived.
 * - `auth-rejected`  — the plugin answered 401/403: the auth token is missing or wrong.
 * - `http-error`     — the plugin answered with any other non-2xx status.
 * - `malformed-body` — the plugin answered 2xx but the body could not be read or parsed as JSON.
 */
export type PofProxyFailureKind =
  | 'unreachable'
  | 'timeout'
  | 'auth-rejected'
  | 'http-error'
  | 'malformed-body';

/**
 * Outcome of a {@link proxyToPofBridge} call.
 * - `ok: true` — the bridge responded 2xx with a parseable JSON body; `data` is that body.
 * - `ok: false, reachable: true` — the bridge ANSWERED but the answer was unusable
 *   (`kind: 'auth-rejected' | 'http-error'` with the upstream status, or
 *   `kind: 'malformed-body'`); `detail` carries a ≤200-char snippet of what was received.
 * - `ok: false, reachable: false` — nothing was received (`kind: 'unreachable' | 'timeout'`);
 *   `detail` is the connection error / timeout message.
 * - `indeterminate: true` — a POST that timed out: the plugin may already have acted
 *   (written the file, started the compile), so its outcome is unknown, not failed.
 *
 * `reachable` keeps its original meaning, so callers that only branch on it are
 * unaffected by the `kind` distinction.
 */
export type PofProxyResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      reachable: boolean;
      kind: PofProxyFailureKind;
      status: number;
      detail: string;
      indeterminate?: boolean;
    };

export interface ProxyOptions {
  /** Bridge port (derive from the request via {@link resolvePofPort}). */
  port: number;
  method?: 'GET' | 'POST';
  /** Serialized as the JSON request body for POSTs. */
  body?: unknown;
  /** Abort the request after this many ms (default 10s). */
  timeoutMs?: number;
}

/**
 * Proxy a single request to the PoF Bridge plugin at `http://<host>:<port>/pof/<path>`.
 *
 * `path` may include a query string or trailing segment
 * (e.g. `'manifest?checksum-only=true'`, `'test/results/abc'`).
 *
 * A parse failure on a live 200 response is a plugin bug (`kind: 'malformed-body'`,
 * `reachable: true`), not a dead editor: reporting it as the latter sends a
 * developer to restart an editor that is already running.
 */
export async function proxyToPofBridge<T>(
  path: string,
  { port, method = 'GET', body, timeoutMs = 10_000 }: ProxyOptions,
): Promise<PofProxyResult<T>> {
  const result = await bridgeFetch<T>(`http://${POF_BRIDGE.HOST}:${port}/pof/${path}`, {
    method,
    headers: method === 'POST' ? { 'Content-Type': 'application/json' } : undefined,
    body,
    timeoutMs,
    label: 'PoF Bridge',
  });
  if (result.ok) return { ok: true, data: result.data };

  // A plugin bug, not a connectivity problem — say so in the server log too.
  if (result.kind === 'malformed-body') logger.warn('[PoF-Proxy]', `/pof/${path} ${result.detail}`);
  return {
    ok: false,
    reachable: result.reachable,
    // No caller signal is passed, so the kernel cannot report `aborted`; any abort is our deadline.
    kind: result.kind === 'aborted' ? 'timeout' : result.kind,
    status: result.status,
    detail: result.detail,
    indeterminate: result.indeterminate,
  };
}

/**
 * Map a failed {@link PofProxyResult} to the standard error envelope.
 *
 * A bridge that ANSWERED (`reachable: true` — a non-2xx or an unparseable body)
 * becomes `"<label>: <detail>"` with the upstream status preserved (a 401/403 names
 * the auth token); a bridge that was never reached surfaces the raw connection /
 * timeout message so it reads as a connectivity problem rather than a plugin fault.
 */
export function pofProxyError(
  result: Extract<PofProxyResult<unknown>, { ok: false }>,
  label: string,
) {
  if (result.kind === 'auth-rejected') {
    return apiError(
      `${label}: PoF Bridge refused the request (HTTP ${result.status}) - the auth token ` +
        `(X-Pof-Auth-Token) is missing or wrong` +
        (result.detail ? `: ${result.detail}` : ''),
      result.status,
    );
  }
  // A timed-out POST carries its "outcome unknown - check before retrying" in `detail`.
  if (!result.reachable) return apiError(result.detail);
  return apiError(result.detail ? `${label}: ${result.detail}` : label, result.status);
}
