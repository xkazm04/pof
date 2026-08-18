/**
 * Client for the PoF Bridge `/pof/python/run` HTTP route.
 *
 * The bridge dispatches `module.function(args)` on the editor thread via the
 * PythonScriptPlugin and returns a structured JSON envelope:
 *   - `{ok: true,  data: <fn return>,    logs: [...]}` on success
 *   - `{ok: false, error: <traceback>,   logs: [...]}` on in-Python failure
 *   - `{ok: false, error: <reason>}` on transport-level failure (no marker)
 *
 * Failures report WHAT HAPPENED: a bridge that answered with a broken body is
 * never reported as "unreachable", and a call that outlived its deadline is
 * never reported as either — because that would send a developer to restart an
 * editor that is already running and hide a real plugin bug.
 */

const DEFAULT_BRIDGE_URL = 'http://localhost:30040/pof/python/run';

/** Max characters of a received body echoed into an error message. */
const RESPONSE_SNIPPET_CHARS = 200;

/**
 * Upper bound applied when the caller supplies neither `timeoutMs` nor a `signal`.
 *
 * Rationale: this route dispatches onto the EDITOR GAME THREAD, so a call is queued
 * behind whatever the editor is doing. A live-coding compile or a queued asset
 * import/save routinely costs 30-60s, which rules out the 15s
 * `UI_TIMEOUTS.pofHttpTimeout` used for the cheap `/pof/status` + `/pof/manifest`
 * reads — too short would turn healthy slow work into a NEW false failure. Two
 * minutes clears that band with room to spare while still being a real bound: past
 * it, the editor is not "busy", it is wedged (crashed mid-PIE, modal dialog open,
 * blocking Python), and an unbounded await would hang the caller forever with no
 * error at all. Genuinely longer work (cooks, full reimports) must opt into a
 * larger `timeoutMs` explicitly rather than inherit an unbounded wait.
 */
export const RUN_PYTHON_DEFAULT_TIMEOUT_MS = 120_000;

export interface RunPythonOk<T = unknown> {
  ok: true;
  data: T;
  logs?: string[];
}

/**
 * How a call failed BEFORE Python ran. Set only for transport-level failures:
 * - `unreachable`    — no response at all (connection refused / socket error).
 * - `timeout`        — the bridge took the connection but did not answer within the bound.
 * - `aborted`        — the caller's own signal cancelled the call.
 * - `malformed-body` — the bridge answered, but the body was not the JSON envelope.
 *
 * An error with NO `kind` came from the bridge itself — the editor ran the call
 * and Python raised. That distinction is the difference between "fix the plugin
 * / the script" and "start the editor".
 */
export type RunPythonFailureKind = 'unreachable' | 'timeout' | 'aborted' | 'malformed-body';

export interface RunPythonErr {
  ok: false;
  error: string;
  logs?: string[];
  /** Present only on transport-level failures; see {@link RunPythonFailureKind}. */
  kind?: RunPythonFailureKind;
}

export type RunPythonResult<T = unknown> = RunPythonOk<T> | RunPythonErr;

export interface RunPythonOptions {
  /** Override the fetch implementation (for tests). */
  fetchImpl?: typeof fetch;
  /**
   * Abort signal forwarded to fetch. Supplying one means YOU own the deadline:
   * the {@link RUN_PYTHON_DEFAULT_TIMEOUT_MS} default is not applied on top of it.
   * Pass `timeoutMs` as well to get both (either one ends the call).
   */
  signal?: AbortSignal;
  /**
   * Upper bound for this call, overriding {@link RUN_PYTHON_DEFAULT_TIMEOUT_MS}.
   * This is how a legitimately slow call (cook, full reimport) buys more time.
   * `0` (or any non-positive value) waits indefinitely — an explicit, rarely
   * correct choice, since nothing else can then unstick a wedged editor.
   */
  timeoutMs?: number;
  /** Override the bridge URL (for non-default port/host). */
  bridgeUrl?: string;
  /** Optional auth token; sent as `X-Pof-Auth-Token` if the bridge requires it. */
  authToken?: string;
}

/** The bridge's own envelope — anything else is a malformed reply, not a result. */
function isRunPythonEnvelope(value: unknown): value is RunPythonResult {
  return typeof value === 'object' && value !== null && typeof (value as { ok?: unknown }).ok === 'boolean';
}

/** Describe a live-but-broken reply with the status and a bounded snippet of what arrived. */
function malformedReply(status: number | undefined, received: string, reason: string): RunPythonErr {
  const snippet = received.slice(0, RESPONSE_SNIPPET_CHARS);
  return {
    ok: false,
    kind: 'malformed-body',
    error:
      `Bridge answered HTTP ${status ?? '?'} with an unparseable body ` +
      `(${reason.slice(0, RESPONSE_SNIPPET_CHARS)})` +
      (snippet ? `: ${snippet}` : ''),
  };
}

/**
 * Resolve the deadline for one call and expose the signal to hand to fetch.
 *
 * A caller-supplied signal wins: it suppresses the default (an explicit choice is
 * not second-guessed) and, when a `timeoutMs` is ALSO given, both are composed so
 * either can end the call. Built by hand rather than with `AbortSignal.any` so it
 * behaves identically across the runtimes this module runs in (node, jsdom).
 */
function resolveDeadline(signal: AbortSignal | undefined, timeoutMs: number | undefined) {
  const bound = timeoutMs ?? (signal ? undefined : RUN_PYTHON_DEFAULT_TIMEOUT_MS);

  if (bound === undefined || !Number.isFinite(bound) || bound <= 0) {
    return { signal, boundMs: null as number | null, timedOut: () => false, cleanup: () => {} };
  }

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, bound);

  let onCallerAbort: (() => void) | undefined;
  if (signal) {
    if (signal.aborted) controller.abort();
    else {
      onCallerAbort = () => controller.abort();
      signal.addEventListener('abort', onCallerAbort);
    }
  }

  return {
    signal: controller.signal,
    boundMs: bound,
    timedOut: () => timedOut,
    cleanup: () => {
      clearTimeout(timer);
      if (onCallerAbort) signal?.removeEventListener('abort', onCallerAbort);
    },
  };
}

/**
 * Call a Python module function through the bridge.
 *
 * Network errors are converted to a `RunPythonErr` so callers can pattern-match on
 * the `ok` discriminant without try/catch. The body read and JSON parse sit OUTSIDE
 * the fetch's catch, so "the editor answered with garbage" stays distinguishable
 * from "the editor is not running" and from "the editor never answered" (`kind`).
 *
 * Every call is bounded: see {@link RUN_PYTHON_DEFAULT_TIMEOUT_MS}.
 */
export async function runPython<T = unknown>(
  modulePath: string,
  fn: string,
  args: Record<string, unknown> = {},
  opts: RunPythonOptions = {},
): Promise<RunPythonResult<T>> {
  const f = opts.fetchImpl ?? fetch;
  const url = opts.bridgeUrl ?? DEFAULT_BRIDGE_URL;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.authToken) headers['X-Pof-Auth-Token'] = opts.authToken;

  const deadline = resolveDeadline(opts.signal, opts.timeoutMs);

  /** Classify a thrown transport error: our deadline, the caller's cancel, or a dead bridge. */
  const transportFailure = (err: unknown): RunPythonErr => {
    if (deadline.timedOut()) {
      return {
        ok: false,
        kind: 'timeout',
        error:
          `Bridge timed out after ${deadline.boundMs}ms: ${modulePath}.${fn} was accepted but ` +
          `never answered (editor compiling, in PIE, or wedged)`,
      };
    }
    if (opts.signal?.aborted) {
      return { ok: false, kind: 'aborted', error: `Bridge call aborted by caller: ${modulePath}.${fn}` };
    }
    return {
      ok: false,
      kind: 'unreachable',
      error: `Bridge unreachable: ${err instanceof Error ? err.message : String(err)}`,
    };
  };

  try {
    let res: Response;
    try {
      res = await f(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ module: modulePath, function: fn, args }),
        signal: deadline.signal,
      });
    } catch (err) {
      // Nothing was received — unreachable, timed out, or cancelled, never conflated.
      return transportFailure(err);
    }

    // Read as TEXT first: once `res.json()` consumes the stream, a failed parse can
    // no longer report what was actually received.
    let raw: string;
    try {
      raw = await res.text();
    } catch (err) {
      // A stalled body stream is still a timeout, not a malformed payload.
      if (deadline.timedOut() || opts.signal?.aborted) return transportFailure(err);
      return malformedReply(
        res.status,
        '',
        `body could not be read: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    // The bridge returns JSON even on 4xx/5xx — parse and pass its envelope through.
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      return malformedReply(res.status, raw, err instanceof Error ? err.message : 'invalid JSON');
    }

    if (!isRunPythonEnvelope(parsed)) {
      return malformedReply(res.status, raw, 'reply is not a {ok, data|error} envelope');
    }

    return parsed as RunPythonResult<T>;
  } finally {
    deadline.cleanup();
  }
}
