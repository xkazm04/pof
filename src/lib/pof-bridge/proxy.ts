/**
 * Shared proxy helper for the `/api/pof-bridge/*` route handlers.
 *
 * Every bridge route used to re-implement the same dance: build a hardcoded
 * `http://127.0.0.1:${port}/pof/...` URL, spin up an `AbortController` with an
 * ad-hoc timeout, check `res.ok`, slice the error text to 200 chars, and map to
 * the API envelope. {@link proxyToPofBridge} centralizes that so each route is a
 * few lines, and {@link pofProxyError} formats the standard failure envelope.
 *
 * This transport is how the app learns whether anything is real in the actual
 * editor, so it reports what ACTUALLY happened: a plugin that answers with a
 * broken body is never reported as "editor not running".
 */
import { apiError } from '@/lib/api-utils';
import { logger } from '@/lib/logger';
import { POF_BRIDGE } from './constants';

/** Max characters of an upstream body (or error text) echoed into a failure detail. */
const DETAIL_SNIPPET_CHARS = 200;

/**
 * Why a {@link proxyToPofBridge} call failed. Distinguishing these is the point:
 * only `unreachable` and `timeout` mean "go look at the editor"; `http-error`
 * and `malformed-body` mean the plugin answered and the fault is in the plugin.
 *
 * - `unreachable`    — no response at all (connection refused / DNS / socket error).
 * - `timeout`        — the request was aborted by our own deadline; nothing usable arrived.
 * - `http-error`     — the plugin answered with a non-2xx status.
 * - `malformed-body` — the plugin answered 2xx but the body could not be read or parsed as JSON.
 */
export type PofProxyFailureKind = 'unreachable' | 'timeout' | 'http-error' | 'malformed-body';

/**
 * Outcome of a {@link proxyToPofBridge} call.
 * - `ok: true` — the bridge responded 2xx with a parseable JSON body; `data` is that body.
 * - `ok: false, reachable: true` — the bridge ANSWERED but the answer was unusable
 *   (`kind: 'http-error'` with the upstream status, or `kind: 'malformed-body'`);
 *   `detail` names the status and carries a ≤200-char snippet of what was received.
 * - `ok: false, reachable: false` — nothing was received (`kind: 'unreachable' | 'timeout'`);
 *   `detail` is the connection error / timeout message.
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

/** A 2xx answer we could not turn into JSON — the plugin is up, the payload is broken. */
function malformedBody(
  path: string,
  status: number,
  received: string,
  reason: string,
): Extract<PofProxyResult<never>, { ok: false }> {
  const snippet = received.slice(0, DETAIL_SNIPPET_CHARS);
  const detail =
    `PoF Bridge answered HTTP ${status} with an unparseable body ` +
    `(${reason.slice(0, DETAIL_SNIPPET_CHARS)})` +
    (snippet ? `: ${snippet}` : '');
  // A plugin bug, not a connectivity problem — say so in the server log too.
  logger.warn('[PoF-Proxy]', `/pof/${path} ${detail}`);
  // 502: the upstream answer was invalid. The received status is preserved in `detail`.
  return { ok: false, reachable: true, kind: 'malformed-body', status: 502, detail };
}

/**
 * Proxy a single request to the PoF Bridge plugin at `http://<host>:<port>/pof/<path>`.
 *
 * `path` may include a query string or trailing segment
 * (e.g. `'manifest?checksum-only=true'`, `'test/results/abc'`).
 *
 * The JSON parse is deliberately OUTSIDE the fetch's catch: a parse failure on a
 * live 200 response is a plugin bug (`kind: 'malformed-body'`, `reachable: true`),
 * not a dead editor, and reporting it as the latter sends a developer to restart
 * an editor that is already running.
 */
export async function proxyToPofBridge<T>(
  path: string,
  { port, method = 'GET', body, timeoutMs = 10_000 }: ProxyOptions,
): Promise<PofProxyResult<T>> {
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    let res: Response;
    try {
      res = await fetch(`http://${POF_BRIDGE.HOST}:${port}/pof/${path}`, {
        method,
        headers: method === 'POST' ? { 'Content-Type': 'application/json' } : undefined,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } catch (e) {
      // Nothing was received — this is the ONLY genuinely unreachable case.
      if (timedOut) {
        return {
          ok: false,
          reachable: false,
          kind: 'timeout',
          status: 504,
          detail: `PoF Bridge did not respond within ${timeoutMs}ms`,
        };
      }
      return {
        ok: false,
        reachable: false,
        kind: 'unreachable',
        status: 502,
        detail: e instanceof Error ? e.message : 'Failed to reach PoF Bridge plugin',
      };
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return {
        ok: false,
        reachable: true,
        kind: 'http-error',
        status: res.status,
        detail: text.slice(0, DETAIL_SNIPPET_CHARS),
      };
    }

    // Read the body as TEXT first: once `res.json()` consumes the stream a failed
    // parse can no longer say what was actually received.
    let raw: string;
    try {
      raw = await res.text();
    } catch (e) {
      const reason = e instanceof Error ? e.message : 'unknown read error';
      if (timedOut) {
        return {
          ok: false,
          reachable: false,
          kind: 'timeout',
          status: 504,
          detail: `PoF Bridge did not respond within ${timeoutMs}ms`,
        };
      }
      return malformedBody(path, res.status, '', `body could not be read: ${reason}`);
    }

    try {
      return { ok: true, data: JSON.parse(raw) as T };
    } catch (e) {
      return malformedBody(path, res.status, raw, e instanceof Error ? e.message : 'invalid JSON');
    }
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Map a failed {@link PofProxyResult} to the standard error envelope.
 *
 * A bridge that ANSWERED (`reachable: true` — a non-2xx or an unparseable body)
 * becomes `"<label>: <detail>"` with the upstream status preserved; a bridge that
 * was never reached surfaces the raw connection/timeout message so it reads as a
 * connectivity problem rather than a plugin fault.
 */
export function pofProxyError(
  result: Extract<PofProxyResult<unknown>, { ok: false }>,
  label: string,
) {
  if (!result.reachable) return apiError(result.detail);
  return apiError(result.detail ? `${label}: ${result.detail}` : label, result.status);
}
