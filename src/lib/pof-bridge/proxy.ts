/**
 * Shared proxy helper for the `/api/pof-bridge/*` route handlers.
 *
 * Every bridge route used to re-implement the same dance: build a hardcoded
 * `http://127.0.0.1:${port}/pof/...` URL, spin up an `AbortController` with an
 * ad-hoc timeout, check `res.ok`, slice the error text to 200 chars, and map to
 * the API envelope. {@link proxyToPofBridge} centralizes that so each route is a
 * few lines, and {@link pofProxyError} formats the standard failure envelope.
 */
import { apiError } from '@/lib/api-utils';
import { POF_BRIDGE } from './constants';

/**
 * Outcome of a {@link proxyToPofBridge} call.
 * - `ok: true` — the bridge responded 2xx; `data` is the parsed JSON body.
 * - `ok: false, reachable: true` — the bridge responded non-2xx; `status` + `detail`
 *   (≤200 chars of the response body) describe the error.
 * - `ok: false, reachable: false` — the bridge could not be reached (network error /
 *   timeout); `detail` is the connection error message and `status` defaults to 502.
 */
export type PofProxyResult<T> =
  | { ok: true; data: T }
  | { ok: false; reachable: boolean; status: number; detail: string };

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
 */
export async function proxyToPofBridge<T>(
  path: string,
  { port, method = 'GET', body, timeoutMs = 10_000 }: ProxyOptions,
): Promise<PofProxyResult<T>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`http://${POF_BRIDGE.HOST}:${port}/pof/${path}`, {
      method,
      headers: method === 'POST' ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { ok: false, reachable: true, status: res.status, detail: text.slice(0, 200) };
    }

    return { ok: true, data: (await res.json()) as T };
  } catch (e) {
    return {
      ok: false,
      reachable: false,
      status: 502,
      detail: e instanceof Error ? e.message : 'Failed to reach PoF Bridge plugin',
    };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Map a failed {@link PofProxyResult} to the standard error envelope.
 *
 * A non-2xx response becomes `"<label>: <detail>"` with the upstream status
 * preserved; an unreachable bridge surfaces the raw connection message with the
 * default upstream status.
 */
export function pofProxyError(
  result: Extract<PofProxyResult<unknown>, { ok: false }>,
  label: string,
) {
  if (!result.reachable) return apiError(result.detail);
  return apiError(result.detail ? `${label}: ${result.detail}` : label, result.status);
}
