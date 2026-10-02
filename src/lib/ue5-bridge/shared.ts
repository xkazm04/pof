/**
 * Shared UE5 bridge HTTP plumbing.
 *
 * Both the PoF Bridge client (`pof-bridge/client.ts`) and the UE5 Remote
 * Control client (`ue5-bridge/remote-control-client.ts`) talk to a UE5
 * companion over HTTP with identical mechanics: build the URL, abort on a
 * timeout, JSON-encode the body, wrap the response in a result, and
 * `logger.warn` on failure. `bridgeRequest` is the single source of that
 * plumbing — clients differ only in their base URL, timeout, error label,
 * log prefix, and any extra headers (e.g. the PoF auth token). The HTTP call and
 * the failure verdict are the bridge transport kernel (`@/lib/bridge/transport`).
 */

import { logger } from '@/lib/logger';
import { bridgeFetch, type BridgeFailureKind, type BridgeHttpMethod } from '@/lib/bridge/transport';

/** HTTP verbs used across the UE5 bridges. */
export type { BridgeHttpMethod };

export interface BridgeRequestOptions {
  /** HTTP method. */
  method: BridgeHttpMethod;
  /** Request path appended to `baseUrl` (e.g. `/pof/status`). */
  path: string;
  /** Abort timeout in milliseconds. */
  timeout: number;
  /** Human-readable bridge name for error messages (e.g. `PoF Bridge`). */
  label: string;
  /** Logger prefix tag (e.g. `[PoF-Bridge]`). */
  logPrefix: string;
  /** Optional request body — JSON-stringified when defined. */
  body?: unknown;
  /** Extra headers merged on top of `Content-Type: application/json`. */
  headers?: Record<string, string>;
}

/**
 * A failed {@link bridgeRequest}. `error` is the human sentence (what string
 * consumers - connection state, API envelopes, logs - keep showing); the verdict
 * travels as fields, so no caller re-parses the sentence:
 * - `kind`          - the kernel's {@link BridgeFailureKind};
 * - `reachable`     - the bridge answered (a live plugin with a broken reply is not a dead one);
 * - `indeterminate` - a non-GET that timed out: it may already have taken effect;
 * - `status`        - the upstream status, or the kernel's 502 / 504.
 */
export interface BridgeRequestErr {
  ok: false;
  error: string;
  kind: BridgeFailureKind;
  reachable: boolean;
  indeterminate: boolean;
  status: number;
}

/**
 * Outcome of a {@link bridgeRequest}: assignable to `Result<T, string>`, so callers
 * that only read `error` are unaffected, while the failure kind survives as a field.
 */
export type BridgeRequestResult<T> = { ok: true; data: T } | BridgeRequestErr;

/**
 * Perform a JSON HTTP request against a UE5 bridge.
 *
 * Never throws: timeouts, non-2xx responses, unparseable bodies and network
 * errors are all folded into a {@link BridgeRequestErr} and logged via `logger.warn`.
 */
export async function bridgeRequest<T>(
  baseUrl: string,
  opts: BridgeRequestOptions,
): Promise<BridgeRequestResult<T>> {
  const { method, path, timeout, label, logPrefix, body, headers: extraHeaders } = opts;
  const where = `${label} ${method} ${path}`;

  const res = await bridgeFetch<T>(`${baseUrl}${path}`, {
    method,
    body,
    timeoutMs: timeout,
    label: where,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
  if (res.ok) return { ok: true, data: res.data };

  const unknownOutcome = res.indeterminate ? ' - outcome unknown, check it before retrying' : '';
  let error: string;
  switch (res.kind) {
    case 'auth-rejected':
    case 'http-error':
      error = `${where} returned ${res.status}: ${res.detail}`;
      break;
    case 'timeout':
      error = `${where} timed out after ${timeout}ms${unknownOutcome}`;
      break;
    default:
      // unreachable: the raw connection error; malformed-body: the kernel's detail
      // already names `where`, the received status and a snippet.
      error = res.detail;
  }

  if (res.kind === 'unreachable') logger.warn(logPrefix, `${method} ${path} failed:`, error);
  else logger.warn(logPrefix, error);

  return {
    ok: false,
    error,
    kind: res.kind,
    reachable: res.reachable,
    indeterminate: res.indeterminate,
    status: res.status,
  };
}
