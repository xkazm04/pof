/**
 * The bridge transport kernel: the ONE HTTP transport the app uses to talk to the
 * UE editor plugins. `/api/pof-bridge/*` (`pof-bridge/proxy.ts`), `/pof/python/run`
 * (`bridge/run-python.ts`) and the PoF / Remote Control clients
 * (`ue5-bridge/shared.ts` `bridgeRequest`) are thin hosts over {@link bridgeFetch}.
 *
 * It decides, in one place, what a bridge failure IS, and returns that verdict as
 * fields - `kind`, `reachable`, `indeterminate` - never as a sentence a downstream
 * caller has to re-parse. Three rules it owns:
 *   - the body is read as TEXT first and parsed OUTSIDE the transport catch, so a
 *     live plugin answering garbage (`malformed-body`, reachable) never reads as a
 *     dead socket (`unreachable`);
 *   - our own deadline (`timeout`) and the caller's cancel (`aborted`) are told apart
 *     from a dead bridge, and the deadline holds even when a fetch ignores its signal;
 *   - a timed-out or cancelled NON-GET is `indeterminate`: the plugin may already have
 *     written the file / started the compile, so its outcome is unknown, not failed.
 */

export type BridgeHttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

/**
 * Why a bridge call failed.
 * - `unreachable`    - nothing was received (connection refused / DNS / socket error).
 * - `timeout`        - our own deadline ended the call before a usable answer arrived.
 * - `aborted`        - the caller's signal cancelled the call.
 * - `auth-rejected`  - the plugin answered 401/403: the auth token is missing or wrong.
 * - `http-error`     - the plugin answered with any other non-2xx status.
 * - `malformed-body` - the plugin answered, but the body could not be read or parsed as JSON.
 */
export type BridgeFailureKind =
  | 'unreachable'
  | 'timeout'
  | 'aborted'
  | 'auth-rejected'
  | 'http-error'
  | 'malformed-body';

/** Max characters of a received body (or parse reason) echoed into a failure detail. */
export const BRIDGE_SNIPPET_CHARS = 200;

export interface BridgeFetchOptions {
  method?: BridgeHttpMethod;
  /** JSON-stringified when defined. */
  body?: unknown;
  /** Sent as given; the kernel adds none of its own. */
  headers?: Record<string, string>;
  /** Deadline in ms. Absent, `0`, negative or non-finite = unbounded (the caller's choice). */
  timeoutMs?: number;
  /** Caller cancel. Composed with `timeoutMs`: either one ends the call. */
  signal?: AbortSignal;
  /** Override the fetch implementation (tests). Defaults to the global fetch at call time. */
  fetchImpl?: typeof fetch;
  /**
   * The plugin answers JSON on 4xx/5xx too: parse it and return it as `body` on the
   * failure (an unparseable one is `malformed-body`). Default: keep the raw snippet only.
   */
  parseErrorBody?: boolean;
  /** Who is talking, for failure details (e.g. `PoF Bridge`). Default `Bridge`. */
  label?: string;
}

export interface BridgeFailure {
  ok: false;
  kind: BridgeFailureKind;
  /** The plugin answered (auth-rejected / http-error / malformed-body). */
  reachable: boolean;
  /** A non-GET that timed out or was cancelled: it may already have taken effect. */
  indeterminate: boolean;
  /** Upstream status for an answer; 502 unreachable/malformed, 504 timeout, 499 aborted. */
  status: number;
  /** What was received or what went wrong, snippets bounded by {@link BRIDGE_SNIPPET_CHARS}. */
  detail: string;
  /** Parsed non-2xx body, only with `parseErrorBody`. */
  body?: unknown;
}

export type BridgeFetchResult<T> = { ok: true; status: number; data: T } | BridgeFailure;

/** Arm the deadline and compose it with the caller's signal (built by hand: same in node and jsdom). */
function armDeadline(signal: AbortSignal | undefined, timeoutMs: number | undefined) {
  if (timeoutMs === undefined || !Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return { signal, timedOut: () => false, cleanup: () => {} };
  }
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const onCallerAbort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener('abort', onCallerAbort);
  return {
    signal: controller.signal,
    timedOut: () => timedOut,
    cleanup: () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onCallerAbort);
    },
  };
}

/** Settle with `work`, or reject as soon as `signal` aborts - a fetch that ignores its signal cannot hang us. */
function untilAborted<T>(work: Promise<T>, signal: AbortSignal | undefined): Promise<T> {
  if (!signal) return work;
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new DOMException('The operation was aborted', 'AbortError'));
    signal.addEventListener('abort', onAbort, { once: true });
    void work.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort));
    if (signal.aborted) onAbort();
  });
}

function reasonOf(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * One HTTP call to a bridge. Never throws: every outcome is a {@link BridgeFetchResult}.
 */
export async function bridgeFetch<T>(url: string, opts: BridgeFetchOptions = {}): Promise<BridgeFetchResult<T>> {
  const { method = 'GET', headers, timeoutMs, signal, parseErrorBody = false, label = 'Bridge' } = opts;
  const f = opts.fetchImpl ?? globalThis.fetch;
  const deadline = armDeadline(signal, timeoutMs);
  const mutating = method !== 'GET';

  const fail = (kind: BridgeFailureKind, status: number, detail: string, body?: unknown): BridgeFailure => ({
    ok: false,
    kind,
    reachable: kind === 'auth-rejected' || kind === 'http-error' || kind === 'malformed-body',
    indeterminate: mutating && (kind === 'timeout' || kind === 'aborted'),
    status,
    detail,
    ...(body !== undefined ? { body } : {}),
  });

  /** Nothing usable arrived: our deadline, the caller's cancel, or a dead bridge. */
  const interrupted = (e: unknown): BridgeFailure => {
    const unknownOutcome = mutating
      ? `; the ${method} may already have taken effect - its outcome is unknown, check it before retrying`
      : '';
    // Only our controller aborts the request when the caller's signal did not fire.
    const isAbort = typeof e === 'object' && e !== null && (e as { name?: unknown }).name === 'AbortError';
    if (deadline.timedOut() || (isAbort && !signal?.aborted)) {
      const within = timeoutMs && timeoutMs > 0 ? `within ${timeoutMs}ms` : 'in time';
      return fail('timeout', 504, `${label} did not respond ${within}${unknownOutcome}`);
    }
    if (signal?.aborted) return fail('aborted', 499, `${label} call aborted by caller${unknownOutcome}`);
    return fail('unreachable', 502, reasonOf(e));
  };

  const malformed = (status: number, received: string, reason: string): BridgeFailure => {
    const snippet = received.slice(0, BRIDGE_SNIPPET_CHARS);
    return fail(
      'malformed-body',
      502,
      `${label} answered HTTP ${status} with an unparseable body ` +
        `(${reason.slice(0, BRIDGE_SNIPPET_CHARS)})` +
        (snippet ? `: ${snippet}` : ''),
    );
  };

  try {
    let res: Response;
    try {
      res = await untilAborted(
        f(url, {
          method,
          headers,
          body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
          signal: deadline.signal,
        }),
        deadline.signal,
      );
    } catch (e) {
      return interrupted(e);
    }

    let raw: string;
    try {
      raw = await untilAborted(res.text(), deadline.signal);
    } catch (e) {
      // A stalled body stream is still a timeout / cancel, not a malformed payload.
      if (deadline.timedOut() || signal?.aborted) return interrupted(e);
      if (!res.ok) raw = '';
      else return malformed(res.status, '', `body could not be read: ${reasonOf(e)}`);
    }

    if (!res.ok) {
      const kind = res.status === 401 || res.status === 403 ? 'auth-rejected' : 'http-error';
      if (!parseErrorBody) return fail(kind, res.status, raw.slice(0, BRIDGE_SNIPPET_CHARS));
      try {
        return fail(kind, res.status, raw.slice(0, BRIDGE_SNIPPET_CHARS), JSON.parse(raw));
      } catch (e) {
        return malformed(res.status, raw, reasonOf(e));
      }
    }

    try {
      return { ok: true, status: res.status, data: JSON.parse(raw) as T };
    } catch (e) {
      return malformed(res.status, raw, reasonOf(e));
    }
  } finally {
    deadline.cleanup();
  }
}
