/**
 * Waiting tests — the UE automation tests that deferred L3 gates are waiting on, and the
 * one-test run + settle the human can trigger from the Test Harness.
 *
 * This is the human surface of the loop the agent already has in `pof_ue_run_tests`
 * (tools/pof-mcp/src/tools/ue.ts): run the test through `/pof/test/run-automation`, then
 * hand the raw payload to `/api/pipeline-artifacts/drain/settle-test`, which reuses the
 * drain's own verdict semantics (`settleGatesFromTestRun`) — no new verdict path.
 *
 * Lease honesty: the drain lease is CHECKED before the run (a held lease runs nothing), but
 * the run itself takes no lease — so a drain that starts between the check and the settle
 * makes the settle 409. That outcome is `settle-error` with `ran: true`: the test ran, and
 * no gate was written. It is never reported as settled.
 */

import { tryApiFetch } from '@/lib/api-utils';
import type { Result } from '@/types/result';
import type { GateJob } from '@/lib/test-gate-runner/types';
import type { SettleOutcome } from '@/lib/test-gate-runner/settleFromTest';
import type { LeaseState } from '@/lib/test-gate-runner/drain-lease';

export const WAITING_TESTS_URL = '/api/pipeline-artifacts/drain?tier=L3';
export const DRAIN_STATUS_URL = '/api/pipeline-artifacts/drain/status';
export const BRIDGE_TEST_URL = '/api/pof-bridge/test';
export const SETTLE_TEST_URL = '/api/pipeline-artifacts/drain/settle-test';

export interface WaitingTest {
  testName: string;
  /** Deferred L3 gates one run of this test would settle. */
  gates: number;
  /** Distinct catalogs those gates belong to, sorted. */
  catalogs: string[];
}

export interface WaitingTests {
  /** Ranked by `gates` desc (then name) — the first row unblocks the most. */
  tests: WaitingTest[];
  /** L3 gates whose deferred reason names no test (a run cannot settle them). */
  unnamed: number;
}

/** Group the deferred queue by the UE test each L3 gate waits on. L4 (visual) gates are excluded. */
export function groupWaitingTests(jobs: readonly GateJob[]): WaitingTests {
  const byName = new Map<string, { gates: number; catalogs: Set<string> }>();
  let unnamed = 0;
  for (const j of jobs) {
    if (j.tier !== 'L3') continue;
    const name = j.testName?.trim();
    if (!name) { unnamed++; continue; }
    const row = byName.get(name) ?? { gates: 0, catalogs: new Set<string>() };
    row.gates++;
    row.catalogs.add(j.catalogId);
    byName.set(name, row);
  }
  const tests = [...byName].map(([testName, r]) => ({ testName, gates: r.gates, catalogs: [...r.catalogs].sort() }));
  tests.sort((a, b) => b.gates - a.gates || a.testName.localeCompare(b.testName));
  return { tests, unnamed };
}

/** Injected transport (tryApiFetch in the app, a fake in tests). */
export interface WaitingTestsApi {
  get<T>(url: string): Promise<Result<T, string>>;
  post<T>(url: string, body: unknown): Promise<Result<T, string>>;
}

export const fetchApi: WaitingTestsApi = {
  get: (url) => tryApiFetch(url),
  post: (url, body) => tryApiFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }),
};

export type WaitingRunOutcome =
  /** A drain holds the lease — nothing was run. */
  | { kind: 'busy'; scope: string | null; since: string | null }
  /** The lease state could not be read — treated as unknown, not free; nothing was run. */
  | { kind: 'lease-error'; error: string }
  /** The bridge refused or was unreachable — nothing ran, no gate was written. */
  | { kind: 'bridge-error'; error: string }
  /** The test ran but the settle was refused/failed — NO gate was written. */
  | { kind: 'settle-error'; ran: true; bridgeResult: unknown; error: string }
  /** The test ran and the settle route reported what it wrote (possibly nothing — see `note`). */
  | { kind: 'settled'; bridgeResult: unknown; outcome: SettleOutcome };

/** Lease check -> run-automation (one test) -> settle-test. Every step reports its own failure. */
export async function runWaitingTest(testName: string, api: WaitingTestsApi = fetchApi): Promise<WaitingRunOutcome> {
  const lease = await api.get<LeaseState>(DRAIN_STATUS_URL);
  if (!lease.ok) return { kind: 'lease-error', error: lease.error };
  if (lease.data.held) return { kind: 'busy', scope: lease.data.scope, since: lease.data.since };

  const run = await api.post<unknown>(BRIDGE_TEST_URL, { action: 'run-automation', filter: testName });
  if (!run.ok) return { kind: 'bridge-error', error: run.error };

  const settle = await api.post<SettleOutcome>(SETTLE_TEST_URL, { testName, result: run.data });
  if (!settle.ok) return { kind: 'settle-error', ran: true, bridgeResult: run.data, error: settle.error };
  return { kind: 'settled', bridgeResult: run.data, outcome: settle.data };
}

/** One human line per outcome — what ran, and what was (not) written. */
export function describeRunOutcome(o: WaitingRunOutcome): string {
  switch (o.kind) {
    case 'busy':
      return `Drain in flight for ${o.scope ?? 'an unknown scope'} — nothing was run.`;
    case 'lease-error':
      return `Could not read the drain lease (${o.error}) — nothing was run.`;
    case 'bridge-error':
      return `UE bridge error: ${o.error} — the test did not run, no gate was written.`;
    case 'settle-error': {
      const status = (o.bridgeResult as { status?: unknown } | null)?.status;
      return `Test ran${typeof status === 'string' ? ` (${status})` : ''} but NO gate was written: ${o.error}`;
    }
    case 'settled': {
      const s = o.outcome;
      return `matched ${s.matched} · settled ${s.settled} · passed ${s.passed} · failed ${s.failed} · deferred ${s.deferred} — ${s.note}`;
    }
  }
}
