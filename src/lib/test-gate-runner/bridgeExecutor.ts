import type { GateExecutor, GateJob, GateVerdict } from './types';

const DEFAULT_PORT = 30040;

type FetchImpl = typeof fetch;

export interface BridgeExecutorOptions {
  port?: number;
  /** Injectable for tests. Defaults to global fetch. */
  fetchImpl?: FetchImpl;
  /** Per-request timeout (ms) for the synchronous run-automation POST + status probe. */
  timeoutMs?: number;
  /** Poll interval + cap when the plugin reports the run is still in progress. */
  pollMs?: number;
  maxPolls?: number;
  /**
   * Per-request timeout (ms) for the lightweight results-poll GETs. Defaults to a
   * short value scaled off pollMs so a slow poll fails fast instead of inheriting the
   * 120s run-automation timeout. The overall poll wall-clock is independently capped.
   */
  pollTimeoutMs?: number;
}

/**
 * Reduce the PoF Bridge plugin's results payload into a terminal verdict. Ground
 * truth (PofHttpServer.cpp + live verification 2026-05-26, see docs/catalog/L3-L4-RUNNER.md):
 * `POST /pof/test/run-automation` runs the matching IMPLEMENT_SIMPLE_AUTOMATION_TEST gate
 * synchronously and returns a top-level `{status:"passed"|"failed",testId}` (or
 * `{status:"not_found"}`, handled by the caller); `GET /pof/test/results` returns
 * `{results:[{testId,status:"passed"|"failed",...}]}` (status is binary). A top-level
 * `status` of "accepted"/"running" is the non-terminal poll state of the async fallback.
 * `matchName` correlates the results array to our test (the recorded testId may embed the
 * automation name). Exported pure for unit tests.
 */
export function interpretAutomationResult(
  data: unknown,
  matchName?: string,
): { terminal: boolean; status?: 'pass' | 'fail'; detail: string; testId?: string } {
  if (data == null || typeof data !== 'object') {
    return { terminal: false, detail: 'no result payload' };
  }
  const d = data as Record<string, unknown>;
  const testId = typeof d.testId === 'string' ? d.testId : undefined;

  // GET /pof/test/results — the array verdict shape: { results: [{ testId, status }] }.
  if (Array.isArray(d.results)) {
    const all = d.results as Array<Record<string, unknown>>;
    const matched = matchName
      ? all.filter((r) => typeof r.testId === 'string' && (r.testId as string).includes(matchName))
      : all;
    // matchName given but not yet recorded → keep polling (not terminal).
    if (!matched.length) return { terminal: false, detail: matchName ? 'result not recorded yet' : 'no results yet' };
    const failed = matched.filter((r) => r.status !== 'passed');
    return failed.length
      ? { terminal: true, status: 'fail', detail: `${failed.length} failed / ${matched.length}` }
      : { terminal: true, status: 'pass', detail: `${matched.length} passed` };
  }

  // POST run-automation — synchronous top-level verdict { status, testId }. Any other
  // status string ("accepted"/"running") is the non-terminal poll state of the async path.
  if (typeof d.status === 'string') {
    if (d.status === 'passed') return { terminal: true, status: 'pass', detail: 'automation passed', testId };
    if (d.status === 'failed') return { terminal: true, status: 'fail', detail: failDetail(d), testId };
    return { terminal: false, detail: d.status, testId };
  }

  return { terminal: false, detail: 'unrecognised result shape', testId };
}

function failDetail(d: Record<string, unknown>): string {
  if (Array.isArray(d.errors) && d.errors.length) return String(d.errors[0]).slice(0, 200);
  return 'automation failed';
}

/**
 * L3 executor that runs the test through the running editor's PoF Bridge plugin.
 * No spawn, no shared-log clobber — the safe default on the shared UE tree.
 */
export function makeBridgeExecutor(opts: BridgeExecutorOptions = {}): GateExecutor {
  const port = opts.port ?? DEFAULT_PORT;
  const base = `http://127.0.0.1:${port}/pof`;
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 120_000;
  const pollMs = opts.pollMs ?? 2_000;
  const maxPolls = opts.maxPolls ?? 60;
  // Poll GETs are lightweight and must fail fast — don't let them inherit the long
  // run-automation timeout. Default to a few poll intervals (min 5s).
  const pollTimeoutMs = opts.pollTimeoutMs ?? Math.max(5_000, pollMs * 3);

  async function call(path: string, init?: RequestInit, reqTimeoutMs: number = timeoutMs): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), reqTimeoutMs);
    try {
      return await fetchImpl(`${base}${path}`, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    id: 'bridge',
    tier: 'L3',

    async available() {
      try {
        const res = await call('/status');
        return res.ok;
      } catch {
        return false;
      }
    },

    async run(job: GateJob): Promise<GateVerdict> {
      const res = await call('/test/run-automation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filter: job.testName, flags: [] }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`bridge run-automation ${res.status}: ${text.slice(0, 160)}`);
      }
      const posted = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      // The plugin returns status:"not_found" when no automation test matches → skip
      // (stays deferred), never a false fail, and don't waste the poll budget.
      if (posted && posted.status === 'not_found') {
        throw new Error(`no automation test matches ${job.testName}`);
      }
      let interp = interpretAutomationResult(posted, job.testName);

      // run-automation is async (returns {status:"accepted"}) — poll the results
      // endpoint until our test's verdict is recorded or we exhaust the budget.
      // Cap total poll wall-clock with a single deadline computed once, and arm a
      // short per-GET timeout (not the 120s POST timeout) so one slow poll can't stall
      // the whole budget. Worst case is now ~maxPolls × (pollMs + pollTimeoutMs).
      const deadline = Date.now() + maxPolls * (pollMs + pollTimeoutMs);
      for (let i = 0; !interp.terminal && i < maxPolls && Date.now() < deadline; i++) {
        await new Promise((r) => setTimeout(r, pollMs));
        const path = interp.testId ? `/test/results/${encodeURIComponent(interp.testId)}` : '/test/results';
        const pr = await call(path, undefined, pollTimeoutMs).catch(() => null);
        if (!pr || !pr.ok) continue;
        interp = interpretAutomationResult(await pr.json().catch(() => null), job.testName);
      }

      if (!interp.terminal || !interp.status) {
        throw new Error(`bridge result not terminal for ${job.testName}: ${interp.detail}`);
      }
      return { status: interp.status, detail: `${job.testName}: ${interp.detail}`, raw: interp };
    },
  };
}
