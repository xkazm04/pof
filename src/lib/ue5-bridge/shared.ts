/**
 * Shared UE5 bridge HTTP plumbing.
 *
 * Both the PoF Bridge client (`pof-bridge/client.ts`) and the UE5 Remote
 * Control client (`ue5-bridge/remote-control-client.ts`) talk to a UE5
 * companion over HTTP with identical mechanics: build the URL, abort on a
 * timeout, JSON-encode the body, wrap the response in a `Result<T>`, and
 * `logger.warn` on failure. `bridgeRequest` is the single source of that
 * plumbing — clients differ only in their base URL, timeout, error label,
 * log prefix, and any extra headers (e.g. the PoF auth token).
 */

import { ok, err, type Result } from '@/types/result';
import { logger } from '@/lib/logger';

/** HTTP verbs used across the UE5 bridges. */
export type BridgeHttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

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
 * Perform a JSON HTTP request against a UE5 bridge, returning `Result<T>`.
 *
 * Never throws: timeouts, non-2xx responses, and network errors are all
 * folded into `err(message)` and logged via `logger.warn`.
 */
export async function bridgeRequest<T>(
  baseUrl: string,
  opts: BridgeRequestOptions,
): Promise<Result<T, string>> {
  const { method, path, timeout, label, logPrefix, body, headers: extraHeaders } = opts;
  const url = `${baseUrl}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...extraHeaders,
    };

    const init: RequestInit = {
      method,
      signal: controller.signal,
      headers,
    };

    if (body !== undefined) {
      init.body = JSON.stringify(body);
    }

    const res = await fetch(url, init);

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      const msg = `${label} ${method} ${path} returned ${res.status}: ${text.slice(0, 200)}`;
      logger.warn(logPrefix, msg);
      return err(msg);
    }

    const data = (await res.json()) as T;
    return ok(data);
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      const msg = `${label} ${method} ${path} timed out after ${timeout}ms`;
      logger.warn(logPrefix, msg);
      return err(msg);
    }
    const msg = e instanceof Error ? e.message : 'Unknown fetch error';
    logger.warn(logPrefix, `${method} ${path} failed:`, msg);
    return err(msg);
  } finally {
    clearTimeout(timer);
  }
}
