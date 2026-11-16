/**
 * `register()` arms three independent server-startup hooks. The gate-notifier
 * hook used to run unguarded, so a throw there rejected register() before the
 * nightly-build interval was armed (and the started flag blocked any retry).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const tickScheduler = vi.fn(() => ({ ran: false, reason: 'idle' }));
const tickPurgeExpiredKeys = vi.fn(() => 0);
const registerGateNotifier = vi.fn();
const warn = vi.fn();

vi.mock('@/lib/packaging/scheduled-build-runner', () => ({ tickScheduler: () => tickScheduler() }));
vi.mock('@/lib/request-log', () => ({ tickPurgeExpiredKeys: () => tickPurgeExpiredKeys() }));
vi.mock('@/lib/notify/gate-notifier', () => ({ registerGateNotifier: () => registerGateNotifier() }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: (...a: unknown[]) => warn(...a), error: vi.fn() } }));

type G = typeof globalThis & { __pofSchedulerStarted?: boolean };

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv('NEXT_RUNTIME', 'nodejs');
  vi.stubEnv('POF_DRAIN_WORKER_AUTOSTART', '');
  (globalThis as G).__pofSchedulerStarted = undefined;
  tickScheduler.mockClear();
  tickPurgeExpiredKeys.mockClear();
  registerGateNotifier.mockReset();
  warn.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  (globalThis as G).__pofSchedulerStarted = undefined;
});

describe('instrumentation register() - hooks fail independently', () => {
  it('still arms the nightly cron when the gate notifier throws', async () => {
    registerGateNotifier.mockImplementation(() => { throw new Error('listener broke'); });
    const { register } = await import('@/instrumentation');
    await expect(register()).resolves.toBeUndefined();
    vi.advanceTimersByTime(60_000);
    expect(tickScheduler).toHaveBeenCalledTimes(1);
    expect(tickPurgeExpiredKeys).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls.some((c) => String(c[0]).includes('listener broke'))).toBe(true);
  });

  it('arms the cron on a healthy boot', async () => {
    const { register } = await import('@/instrumentation');
    await register();
    vi.advanceTimersByTime(60_000);
    expect(registerGateNotifier).toHaveBeenCalledTimes(1);
    expect(tickScheduler).toHaveBeenCalledTimes(1);
  });
});
