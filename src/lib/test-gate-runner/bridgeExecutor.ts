import { logger } from '@/lib/logger';
import type { GateEvidence } from '@/types/observation';
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

/**
 * What ONE PoF-Bridge automation payload means for a gate: a terminal {@link GateVerdict},
 * or `pending` (the run is accepted/running/not yet recorded — keep polling, settle nothing).
 *
 * This is the runner's per-test truth for the bridge shape, extracted so the executor's poll
 * loop AND the agent-facing settle path (`settleGatesFromTestRun` — an agent that ran the exact
 * test a gate waits on) map a payload identically: the plugin's `not_found` is the SAME
 * "planned, not registered in UE" DEFERRED verdict both paths already agree on, never a fail,
 * and a non-terminal payload never fabricates one. Pure.
 */
export type AutomationOutcome =
  | { kind: 'verdict'; verdict: GateVerdict }
  | { kind: 'pending'; detail: string; testId?: string };

export function automationOutcome(testName: string, payload: unknown): AutomationOutcome {
  const at = new Date().toISOString();
  const d = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : null;
  // The plugin returns status:"not_found" when no automation test matches. Same condition the
  // spawn executor reports as `unregistered` — an honest DEFERRED wait, never a red fail.
  if (d && d.status === 'not_found') {
    return {
      kind: 'verdict',
      verdict: {
        status: 'deferred',
        detail: `${testName}: no automation test registered (planned, not in UE)`,
        evidence: { kind: 'bridge', at, markers: ['not_found: no automation test registered'] },
      },
    };
  }
  const interp = interpretAutomationResult(payload, testName);
  if (!interp.terminal || !interp.status) {
    return { kind: 'pending', detail: interp.detail, ...(interp.testId ? { testId: interp.testId } : {}) };
  }
  const evidence: GateEvidence = {
    kind: 'bridge',
    at,
    markers: [interp.testId ? `${interp.detail} (${interp.testId})` : interp.detail],
  };
  return { kind: 'verdict', verdict: { status: interp.status, detail: `${testName}: ${interp.detail}`, evidence, raw: interp } };
}

function failDetail(d: Record<string, unknown>): string {
  if (Array.isArray(d.errors) && d.errors.length) return String(d.errors[0]).slice(0, 200);
  return 'automation failed';
}

/** Compact message for a swallowed error, kept out of the hot path's inline catches. */
function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
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
      const posted = (await res.json().catch((e) => {
        logger.warn(`[test-gate-runner] bridge ${job.testName}: unparseable run-automation JSON (${errMsg(e)})`);
        return null;
      })) as Record<string, unknown> | null;
      // `automationOutcome` owns the payload→verdict truth (incl. the plugin's `not_found`
      // → DEFERRED "planned, not registered in UE", which must not burn the poll budget).
      // The settle path shares it, so an agent-run test and a drain read a payload identically.
      const name = job.testName ?? '';
      let outcome = automationOutcome(name, posted);
      if (outcome.kind === 'verdict') return outcome.verdict;

      // run-automation is async (returns {status:"accepted"}) — poll the results
      // endpoint until our test's verdict is recorded or we exhaust the budget.
      // Cap total poll wall-clock with a single deadline computed once, and arm a
      // short per-GET timeout (not the 120s POST timeout) so one slow poll can't stall
      // the whole budget. Worst case is now ~maxPolls × (pollMs + pollTimeoutMs).
      const deadline = Date.now() + maxPolls * (pollMs + pollTimeoutMs);
      for (let i = 0; outcome.kind === 'pending' && i < maxPolls && Date.now() < deadline; i++) {
        await new Promise((r) => setTimeout(r, pollMs));
        const path = outcome.testId ? `/test/results/${encodeURIComponent(outcome.testId)}` : '/test/results';
        const pr = await call(path, undefined, pollTimeoutMs).catch((e) => {
          logger.warn(`[test-gate-runner] bridge ${job.testName}: results poll failed (${errMsg(e)})`);
          return null;
        });
        if (!pr || !pr.ok) continue;
        outcome = automationOutcome(name, await pr.json().catch((e) => {
          logger.warn(`[test-gate-runner] bridge ${job.testName}: unparseable results JSON (${errMsg(e)})`);
          return null;
        }));
      }

      if (outcome.kind === 'pending') {
        throw new Error(`bridge result not terminal for ${job.testName}: ${outcome.detail}`);
      }
      return outcome.verdict;
    },
  };
}
