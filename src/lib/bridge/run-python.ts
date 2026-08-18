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
 * never reported as "unreachable", because that would send a developer to
 * restart an editor that is already running and hide a real plugin bug.
 */

const DEFAULT_BRIDGE_URL = 'http://localhost:30040/pof/python/run';

/** Max characters of a received body echoed into an error message. */
const RESPONSE_SNIPPET_CHARS = 200;

export interface RunPythonOk<T = unknown> {
  ok: true;
  data: T;
  logs?: string[];
}

/**
 * How a call failed BEFORE Python ran. Set only for transport-level failures:
 * - `unreachable`    — no response at all (connection refused / socket error).
 * - `malformed-body` — the bridge answered, but the body was not the JSON envelope.
 *
 * An error with NO `kind` came from the bridge itself — the editor ran the call
 * and Python raised. That distinction is the difference between "fix the plugin
 * / the script" and "start the editor".
 */
export type RunPythonFailureKind = 'unreachable' | 'malformed-body';

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
  /** Abort signal forwarded to fetch. */
  signal?: AbortSignal;
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
 * Call a Python module function through the bridge.
 *
 * Network errors are converted to a `RunPythonErr` so callers can pattern-match on
 * the `ok` discriminant without try/catch. The body read and JSON parse sit OUTSIDE
 * the fetch's catch, so "the editor answered with garbage" stays distinguishable
 * from "the editor is not running" (`kind`).
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

  let res: Response;
  try {
    res = await f(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ module: modulePath, function: fn, args }),
      signal: opts.signal,
    });
  } catch (err) {
    // Nothing was received — the only genuinely unreachable case.
    return {
      ok: false,
      kind: 'unreachable',
      error: `Bridge unreachable: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // Read as TEXT first: once `res.json()` consumes the stream, a failed parse can
  // no longer report what was actually received.
  let raw: string;
  try {
    raw = await res.text();
  } catch (err) {
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
}
