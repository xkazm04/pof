/**
 * Client for the PoF Bridge `/pof/python/run` HTTP route.
 *
 * The bridge dispatches `module.function(args)` on the editor thread via the
 * PythonScriptPlugin and returns a structured JSON envelope:
 *   - `{ok: true,  data: <fn return>,    logs: [...]}` on success
 *   - `{ok: false, error: <traceback>,   logs: [...]}` on in-Python failure
 *   - `{ok: false, error: <reason>}` on transport-level failure (no marker)
 */

const DEFAULT_BRIDGE_URL = 'http://localhost:30040/pof/python/run';

export interface RunPythonOk<T = unknown> {
  ok: true;
  data: T;
  logs?: string[];
}

export interface RunPythonErr {
  ok: false;
  error: string;
  logs?: string[];
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

/**
 * Call a Python module function through the bridge.
 *
 * Network errors are converted to a `RunPythonErr` so callers can pattern-match on
 * the `ok` discriminant without try/catch.
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

  try {
    const res = await f(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ module: modulePath, function: fn, args }),
      signal: opts.signal,
    });
    // Bridge always returns JSON, even on 4xx/5xx — parse and pass through.
    const body = (await res.json()) as RunPythonResult<T>;
    return body;
  } catch (err) {
    return {
      ok: false,
      error: `Bridge unreachable: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
