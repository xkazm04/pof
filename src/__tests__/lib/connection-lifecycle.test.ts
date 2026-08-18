/**
 * `createConnectionLifecycle` is the genuine shared engine behind BOTH HTTP
 * bridge managers (PoF and UE5 Remote Control), and it had no test of its own.
 * These pin the behaviour that must survive the reconnect/backoff
 * consolidation: the 3-failure health threshold, the exact delay sequence, the
 * `resetAttemptsOnHealthFailure` config seam, and timer cleanup.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createConnectionLifecycle, createReconnectScheduler, type ProbeResult } from '@/lib/connection-lifecycle';

const HEALTH_MS = 30_000;
const BASE = 2_000;
const MAX = 30_000;

interface Harness {
  lifecycle: ReturnType<typeof createConnectionLifecycle<string>>;
  delays: number[];
  probe: ReturnType<typeof vi.fn>;
  onConnected: ReturnType<typeof vi.fn>;
  onHealthInfo: ReturnType<typeof vi.fn>;
  onDisconnectedForReconnect: ReturnType<typeof vi.fn>;
  attempts: () => number;
  setHasClient: (v: boolean) => void;
}

let realSetTimeout: typeof globalThis.setTimeout;

function makeHarness(opts?: { resetAttemptsOnHealthFailure?: boolean }): Harness {
  const delays: number[] = [];
  vi.spyOn(globalThis, 'setTimeout').mockImplementation(((fn: () => void, ms?: number) => {
    delays.push(ms ?? 0);
    return realSetTimeout(fn, ms);
  }) as unknown as typeof globalThis.setTimeout);

  let hasClient = true;
  let reconnectAttempts = 0;
  let status = 'connected';

  const probe = vi.fn<() => Promise<ProbeResult<string>>>()
    .mockResolvedValue({ ok: false, error: 'down' });
  const onConnected = vi.fn(() => { status = 'connected'; reconnectAttempts = 0; });
  const onHealthInfo = vi.fn();
  const onDisconnectedForReconnect = vi.fn((reset: boolean) => {
    status = 'disconnected';
    if (reset) reconnectAttempts = 0;
  });

  const lifecycle = createConnectionLifecycle<string>({
    label: '[TEST]',
    healthCheckMs: HEALTH_MS,
    backoffBase: BASE,
    backoffMax: MAX,
    resetAttemptsOnHealthFailure: opts?.resetAttemptsOnHealthFailure ?? true,
    probe,
    hasClient: () => hasClient,
    getStatus: () => status,
    getReconnectAttempts: () => reconnectAttempts,
    onHealthInfo,
    onConnected,
    onDisconnectedForReconnect,
    onReconnecting: (next) => { status = 'reconnecting'; reconnectAttempts = next; },
  });

  return {
    lifecycle, delays, probe, onConnected, onHealthInfo, onDisconnectedForReconnect,
    attempts: () => reconnectAttempts,
    setHasClient: (v) => { hasClient = v; },
  };
}

/** Let the awaited probe inside a timer settle. */
async function flush() {
  await vi.advanceTimersByTimeAsync(0);
}

beforeEach(() => {
  vi.useFakeTimers();
  realSetTimeout = globalThis.setTimeout;
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('createConnectionLifecycle — health check', () => {
  it('reconnects only after 3 consecutive probe failures', async () => {
    const h = makeHarness();
    h.lifecycle.startHealthCheck();

    await vi.advanceTimersByTimeAsync(HEALTH_MS);
    expect(h.onDisconnectedForReconnect).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(HEALTH_MS);
    expect(h.onDisconnectedForReconnect).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(HEALTH_MS);
    expect(h.onDisconnectedForReconnect).toHaveBeenCalledTimes(1);
    expect(h.onDisconnectedForReconnect).toHaveBeenCalledWith(true);
    h.lifecycle.clearTimers();
  });

  it('a single success resets the failure counter', async () => {
    const h = makeHarness();
    h.lifecycle.startHealthCheck();

    await vi.advanceTimersByTimeAsync(HEALTH_MS);
    await vi.advanceTimersByTimeAsync(HEALTH_MS);
    h.probe.mockResolvedValueOnce({ ok: true, data: 'v1' });
    await vi.advanceTimersByTimeAsync(HEALTH_MS);
    expect(h.onHealthInfo).toHaveBeenCalledWith('v1');

    // Back to zero: two more failures must not trip the threshold.
    await vi.advanceTimersByTimeAsync(HEALTH_MS);
    await vi.advanceTimersByTimeAsync(HEALTH_MS);
    expect(h.onDisconnectedForReconnect).not.toHaveBeenCalled();
    h.lifecycle.clearTimers();
  });

  it('passes resetAttemptsOnHealthFailure straight through (the PoF/UE5 divergence)', async () => {
    const h = makeHarness({ resetAttemptsOnHealthFailure: false });
    h.lifecycle.startHealthCheck();
    for (let i = 0; i < 3; i++) await vi.advanceTimersByTimeAsync(HEALTH_MS);

    expect(h.onDisconnectedForReconnect).toHaveBeenCalledWith(false);
    h.lifecycle.clearTimers();
  });
});

describe('createConnectionLifecycle — reconnect backoff', () => {
  it('escalates min(base * 2^attempt, max) across failed attempts', async () => {
    const expected = [BASE, BASE * 2, BASE * 4, BASE * 8, MAX, MAX];
    const h = makeHarness();
    h.lifecycle.scheduleReconnect();

    // Advance by exactly the pending delay: each failed probe re-schedules
    // with the next exponent, so the sequence itself is the assertion.
    for (let i = 0; i < expected.length - 1; i++) {
      await vi.advanceTimersByTimeAsync(expected[i]);
      await flush();
    }

    expect(h.delays).toEqual(expected);
    h.lifecycle.clearTimers();
  });

  it('settles as connected and resumes health checks on a successful attempt', async () => {
    const h = makeHarness();
    h.probe.mockResolvedValueOnce({ ok: true, data: 'v2' });
    h.lifecycle.scheduleReconnect();

    await vi.advanceTimersByTimeAsync(BASE);
    await flush();

    expect(h.onConnected).toHaveBeenCalledWith('v2');
    expect(h.attempts()).toBe(0);

    // Health check is running again: 3 failures trip it once more.
    for (let i = 0; i < 3; i++) await vi.advanceTimersByTimeAsync(HEALTH_MS);
    expect(h.onDisconnectedForReconnect).toHaveBeenCalledTimes(1);
    h.lifecycle.clearTimers();
  });

  it('does not schedule, or fire, without a client', async () => {
    const h = makeHarness();
    h.setHasClient(false);
    h.lifecycle.scheduleReconnect();
    expect(h.delays).toEqual([]);

    h.setHasClient(true);
    h.lifecycle.scheduleReconnect();
    expect(h.delays).toEqual([BASE]);

    // Client goes away while the retry is pending → the probe must not run.
    h.setHasClient(false);
    await vi.advanceTimersByTimeAsync(BASE);
    await flush();
    expect(h.probe).not.toHaveBeenCalled();
  });

  it('clearTimers cancels a pending reconnect', async () => {
    const h = makeHarness();
    h.lifecycle.scheduleReconnect();
    h.lifecycle.clearTimers();

    await vi.advanceTimersByTimeAsync(MAX * 4);
    await flush();

    expect(h.probe).not.toHaveBeenCalled();
  });
});

describe('createReconnectScheduler — the shared retry policy', () => {
  it('owns the counter bump, and re-checks shouldRetry inside the timer', async () => {
    const delays: number[] = [];
    vi.spyOn(globalThis, 'setTimeout').mockImplementation(((fn: () => void, ms?: number) => {
      delays.push(ms ?? 0);
      return realSetTimeout(fn, ms);
    }) as unknown as typeof globalThis.setTimeout);

    let attempt = 0;
    let allowed = true;
    const run = vi.fn();
    const scheduler = createReconnectScheduler({
      label: '[TEST]',
      backoffBase: BASE,
      backoffMax: MAX,
      getAttempt: () => attempt,
      setAttempt: (n) => { attempt = n; },
      shouldRetry: () => allowed,
      attempt: run,
    });

    scheduler.schedule();
    expect(delays).toEqual([BASE]);
    expect(attempt).toBe(1);

    // Revoked between scheduling and firing — the attempt must be abandoned.
    allowed = false;
    await vi.advanceTimersByTimeAsync(BASE);
    expect(run).not.toHaveBeenCalled();

    allowed = true;
    scheduler.schedule();
    expect(delays).toEqual([BASE, BASE * 2]);
    await vi.advanceTimersByTimeAsync(BASE * 2);
    expect(run).toHaveBeenCalledTimes(1);
  });
});
