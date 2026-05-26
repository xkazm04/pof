import type { GateExecutor, GateJob, GateVerdict } from './types';

const DEFAULT_PORT = 30040;

type FetchImpl = typeof fetch;

export interface BridgeExecutorOptions {
  port?: number;
  /** Injectable for tests. Defaults to global fetch. */
  fetchImpl?: FetchImpl;
  /** Per-request timeout (ms). */
  timeoutMs?: number;
  /** Poll interval + cap when the plugin reports the run is still in progress. */
  pollMs?: number;
  maxPolls?: number;
}

/**
 * Reduce the PoF Bridge plugin's results payload into a terminal verdict. Ground
 * truth (PofHttpServer.cpp): `POST /pof/test/run-automation` is async and returns
 * `{status:"accepted"}`; `GET /pof/test/results` returns
 * `{results:[{testId,status:"passed"|"failed",...}]}` (status is binary). We probe
 * those shapes plus a couple of defensive fallbacks. `matchName` correlates the
 * results array to our test (the recorded testId may embed the automation name).
 * Exported pure for unit tests.
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

  // 0. GET /pof/test/results — the real shape: { results: [{ testId, status }] }
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

  // 1. PofTestResult-style status
  if (typeof d.status === 'string') {
    const s = d.status;
    if (s === 'passed') return { terminal: true, status: 'pass', detail: 'automation passed', testId };
    if (s === 'failed') return { terminal: true, status: 'fail', detail: failDetail(d), testId };
    if (s === 'error') return { terminal: true, status: 'fail', detail: failDetail(d, 'automation error'), testId };
    if (s === 'timeout') return { terminal: true, status: 'fail', detail: 'automation timed out', testId };
    if (s === 'running') return { terminal: false, detail: 'running', testId };
  }

  // 2. Automation summary counts ({ passed, failed, total } or nested { summary })
  const summary = (d.summary && typeof d.summary === 'object' ? d.summary : d) as Record<string, unknown>;
  const passed = numOr(summary.passed);
  const failed = numOr(summary.failed);
  if (passed != null || failed != null) {
    const f = failed ?? 0;
    const p = passed ?? 0;
    if (f > 0) return { terminal: true, status: 'fail', detail: `${f} failed / ${p} passed`, testId };
    if (p > 0) return { terminal: true, status: 'pass', detail: `${p} passed`, testId };
  }

  // 3. Plain boolean
  if (typeof d.success === 'boolean') {
    return d.success
      ? { terminal: true, status: 'pass', detail: 'automation passed', testId }
      : { terminal: true, status: 'fail', detail: failDetail(d), testId };
  }

  return { terminal: false, detail: 'unrecognised result shape', testId };
}

function numOr(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function failDetail(d: Record<string, unknown>, fallback = 'automation failed'): string {
  if (Array.isArray(d.errors) && d.errors.length) return String(d.errors[0]).slice(0, 200);
  return fallback;
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

  async function call(path: string, init?: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
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
      let interp = interpretAutomationResult(await res.json().catch(() => null), job.testName);

      // run-automation is async (returns {status:"accepted"}) — poll the results
      // endpoint until our test's verdict is recorded or we exhaust the budget.
      for (let i = 0; !interp.terminal && i < maxPolls; i++) {
        await new Promise((r) => setTimeout(r, pollMs));
        const path = interp.testId ? `/test/results/${encodeURIComponent(interp.testId)}` : '/test/results';
        const pr = await call(path).catch(() => null);
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
