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
 * editor that is already running and hide a real plugin bug. The HTTP call and
 * that classification are the bridge transport kernel (`@/lib/bridge/transport`);
 * this host keeps the envelope check and the run-python wording.
 */

import { bridgeFetch, BRIDGE_SNIPPET_CHARS } from '@/lib/bridge/transport';

const DEFAULT_BRIDGE_URL = 'http://localhost:30040/pof/python/run';

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

/**
 * Pass the bridge's envelope through. Valid JSON that is NOT the envelope is a
 * malformed reply, never a result (the old cast surfaced `error: undefined`).
 */
function asEnvelope<T>(status: number, value: unknown): RunPythonResult<T> {
  if (isRunPythonEnvelope(value)) return value as RunPythonResult<T>;
  const snippet = (JSON.stringify(value) ?? '').slice(0, BRIDGE_SNIPPET_CHARS);
  return {
    ok: false,
    kind: 'malformed-body',
    error:
      `Bridge answered HTTP ${status} with an unparseable body ` +
      `(reply is not a {ok, data|error} envelope)` +
      (snippet ? `: ${snippet}` : ''),
  };
}

/**
 * Call a Python module function through the bridge.
 *
 * Network errors are converted to a `RunPythonErr` so callers can pattern-match on
 * the `ok` discriminant without try/catch. The kernel reads and parses the body
 * outside its transport catch, so "the editor answered with garbage" stays
 * distinguishable from "the editor is not running" and from "the editor never
 * answered" (`kind`).
 *
 * Every call is bounded: see {@link RUN_PYTHON_DEFAULT_TIMEOUT_MS}.
 */
export async function runPython<T = unknown>(
  modulePath: string,
  fn: string,
  args: Record<string, unknown> = {},
  opts: RunPythonOptions = {},
): Promise<RunPythonResult<T>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.authToken) headers['X-Pof-Auth-Token'] = opts.authToken;

  // A caller-supplied signal wins: it suppresses the default (an explicit choice is
  // not second-guessed); with a `timeoutMs` as well, the kernel composes both.
  const bound = opts.timeoutMs ?? (opts.signal ? undefined : RUN_PYTHON_DEFAULT_TIMEOUT_MS);

  const res = await bridgeFetch<unknown>(opts.bridgeUrl ?? DEFAULT_BRIDGE_URL, {
    method: 'POST',
    headers,
    body: { module: modulePath, function: fn, args },
    timeoutMs: bound,
    signal: opts.signal,
    fetchImpl: opts.fetchImpl,
    // The bridge returns its JSON envelope even on 4xx/5xx — parse and pass it through.
    parseErrorBody: true,
  });

  if (res.ok) return asEnvelope<T>(res.status, res.data);

  switch (res.kind) {
    case 'timeout':
      return {
        ok: false,
        kind: 'timeout',
        error:
          `Bridge timed out after ${bound ?? '?'}ms: ${modulePath}.${fn} was accepted but ` +
          `never answered (editor compiling, in PIE, or wedged)`,
      };
    case 'aborted':
      return { ok: false, kind: 'aborted', error: `Bridge call aborted by caller: ${modulePath}.${fn}` };
    case 'unreachable':
      return { ok: false, kind: 'unreachable', error: `Bridge unreachable: ${res.detail}` };
    case 'malformed-body':
      return { ok: false, kind: 'malformed-body', error: res.detail };
    default:
      // auth-rejected / http-error: the bridge answered with its envelope on a non-2xx.
      return asEnvelope<T>(res.status, res.body);
  }
}
