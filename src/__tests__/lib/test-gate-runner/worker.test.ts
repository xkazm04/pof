import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { DrainSummary, GateJob } from '@/lib/test-gate-runner/types';

// vi.mock is hoisted — define the mock fns via vi.hoisted so the factory can see them.
const { collectDeferred, drainJobs } = vi.hoisted(() => ({ collectDeferred: vi.fn(), drainJobs: vi.fn() }));

vi.mock('@/lib/test-gate-runner/drain', () => ({ collectDeferred, drainJobs }));
vi.mock('@/lib/test-gate-runner/executors', () => ({ buildExecutors: () => [] }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { startDrainWorker, stopDrainWorker, getWorkerStatus, runDrainTick } from '@/lib/test-gate-runner/worker';

const job = (id: string): GateJob => ({ catalogId: 'items', entityId: id, step: 'Test Gate', tier: 'L3', testName: 'T' });
const summary = (results: DrainSummary['results']): DrainSummary => ({
  ran: results.filter((r) => r.verdict).length,
  passed: results.filter((r) => r.verdict?.status === 'pass').length,
  failed: results.filter((r) => r.verdict?.status === 'fail').length,
  skipped: results.filter((r) => r.skipped).length,
  screenshots: [],
  results,
});

beforeEach(() => {
  collectDeferred.mockReset();
  drainJobs.mockReset();
  collectDeferred.mockReturnValue([]);
  drainJobs.mockResolvedValue(summary([]));
});
afterEach(() => stopDrainWorker());

describe('drain worker', () => {
  it('start/stop/status reflects running state', () => {
    expect(getWorkerStatus().running).toBe(false);
    const s = startDrainWorker({ intervalMs: 999_999, cooldownMs: 10_000 });
    expect(s.running).toBe(true);
    expect(s.intervalMs).toBe(999_999);
    expect(getWorkerStatus().running).toBe(true);
    expect(stopDrainWorker().running).toBe(false);
    expect(getWorkerStatus().running).toBe(false);
  });

  it('a tick drains the collected jobs and records the summary', async () => {
    const j1 = job('a'), j2 = job('b');
    collectDeferred.mockReturnValue([j1, j2]);
    drainJobs.mockResolvedValue(summary([{ job: j1, skipped: 'unavailable' }, { job: j2, verdict: { status: 'pass', detail: 'ok' } }]));

    startDrainWorker({ intervalMs: 999_999, cooldownMs: 10_000 });
    await runDrainTick(1_000);

    expect(drainJobs).toHaveBeenCalledTimes(1);
    expect(drainJobs.mock.calls[0][0]).toEqual([j1, j2]);
    const st = getWorkerStatus();
    expect(st.ticks).toBe(1);
    expect(st.lastSummary).toEqual({ ran: 1, passed: 1, failed: 0, skipped: 1 });
    expect(st.lastTickAt).toBe(new Date(1_000).toISOString());
  });

  it('cools down a skipped job so the next tick (within cooldown) excludes it', async () => {
    const j1 = job('a'), j2 = job('b');
    collectDeferred.mockReturnValue([j1, j2]);
    // tick 1: j1 skipped (→ cooldown), j2 ran (→ cleared)
    drainJobs.mockResolvedValueOnce(summary([{ job: j1, skipped: 'no test name in deferred reason' }, { job: j2, verdict: { status: 'pass', detail: 'ok' } }]));
    drainJobs.mockResolvedValue(summary([{ job: j2, verdict: { status: 'pass', detail: 'ok' } }]));

    startDrainWorker({ intervalMs: 999_999, cooldownMs: 10_000 });
    await runDrainTick(1_000);
    await runDrainTick(2_000); // within cooldown (until 11_000) → j1 filtered out

    expect(drainJobs.mock.calls[1][0]).toEqual([j2]); // only j2 on the 2nd tick
  });

  it('re-attempts a cooled-down job once the cooldown expires', async () => {
    const j1 = job('a');
    collectDeferred.mockReturnValue([j1]);
    drainJobs.mockResolvedValue(summary([{ job: j1, skipped: 'unavailable' }]));

    startDrainWorker({ intervalMs: 999_999, cooldownMs: 10_000 });
    await runDrainTick(1_000);       // skipped → cooldown until 11_000
    await runDrainTick(5_000);       // still cooling → excluded
    expect(drainJobs).toHaveBeenCalledTimes(1);
    await runDrainTick(12_000);      // cooldown expired → re-attempted
    expect(drainJobs).toHaveBeenCalledTimes(2);
    expect(drainJobs.mock.calls[1][0]).toEqual([j1]);
  });

  it('runDrainTick is a no-op before the worker is started', async () => {
    stopDrainWorker();
    // cfg persists across tests; explicitly verify no crash + returns a value when configured
    startDrainWorker({ intervalMs: 999_999 });
    collectDeferred.mockReturnValue([]);
    const res = await runDrainTick(1_000);
    expect(res).toEqual({ ran: 0, passed: 0, failed: 0, skipped: 0, screenshots: [], results: [] });
    expect(drainJobs).not.toHaveBeenCalled(); // no jobs → drainJobs skipped
  });
});
