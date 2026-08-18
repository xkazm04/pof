import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@/lib/test-gate-runner/drain', () => ({ collectDeferred: vi.fn(() => []), drainJobs: vi.fn() }));
vi.mock('@/lib/test-gate-runner/executors', () => ({ buildExecutors: () => [] }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

import {
  resolveAutostartConfig, AUTOSTART_ENV, AUTOSTART_DEFAULT_INTERVAL_MS, MIN_WORKER_INTERVAL_MS,
  startDrainWorker, stopDrainWorker, getWorkerStatus,
} from '@/lib/test-gate-runner/worker';
import { __resetLeases } from '@/lib/test-gate-runner/drain-lease';

const env = (over: Record<string, string> = {}): NodeJS.ProcessEnv => ({ ...over }) as NodeJS.ProcessEnv;

beforeEach(() => { __resetLeases(); });
afterEach(() => { stopDrainWorker(); __resetLeases(); });

describe('resolveAutostartConfig', () => {
  it('is OFF by default and says so — an unset env never starts a background drainer', () => {
    const d = resolveAutostartConfig(env());
    expect(d.enabled).toBe(false);
    expect(d.enabled === false && d.reason).toContain('OFF (the default)');
    expect(d.enabled === false && d.reason).toContain(AUTOSTART_ENV.enable);
  });

  it('stays OFF for a non-truthy value and quotes what was set', () => {
    const d = resolveAutostartConfig(env({ [AUTOSTART_ENV.enable]: '0' }));
    expect(d.enabled).toBe(false);
    expect(d.enabled === false && d.reason).toContain('"0"');
  });

  it('enables on an explicit truthy value with the default interval and bridge executor', () => {
    const d = resolveAutostartConfig(env({ [AUTOSTART_ENV.enable]: 'true' }));
    expect(d.enabled).toBe(true);
    if (!d.enabled) return;
    expect(d.config.intervalMs).toBe(AUTOSTART_DEFAULT_INTERVAL_MS);
    expect(d.config.executor).toEqual({ executor: 'bridge' });
    expect(d.config.origin).toBe('autostart');
    expect(d.config.filter).toBeUndefined();
    expect(d.notice).toContain('ENABLED');
    // The lease guarantee is stated where the operator reads the boot log.
    expect(d.notice).toContain('lease');
  });

  it('reads interval, executor and scope from env and floors the interval', () => {
    const d = resolveAutostartConfig(env({
      [AUTOSTART_ENV.enable]: '1',
      [AUTOSTART_ENV.intervalMs]: '10',          // below the floor
      [AUTOSTART_ENV.executor]: 'spawn',
      [AUTOSTART_ENV.tier]: 'L3',
      [AUTOSTART_ENV.catalogId]: 'items',
    }));
    expect(d.enabled).toBe(true);
    if (!d.enabled) return;
    expect(d.config.intervalMs).toBe(MIN_WORKER_INTERVAL_MS);
    expect(d.config.executor).toEqual({ executor: 'spawn' });
    expect(d.config.filter).toEqual({ tier: 'L3', catalogId: 'items' });
  });

  it('ignores a bogus tier rather than passing it through to the drain filter', () => {
    const d = resolveAutostartConfig(env({ [AUTOSTART_ENV.enable]: '1', [AUTOSTART_ENV.tier]: 'L9' }));
    expect(d.enabled === true && d.config.filter).toBeUndefined();
  });
});

describe('worker status provenance', () => {
  it('reports who started it, its scope and its executor', () => {
    startDrainWorker({ intervalMs: 999_999, filter: { tier: 'L4' }, executor: { executor: 'spawn' }, origin: 'autostart' });
    const s = getWorkerStatus();
    expect(s.origin).toBe('autostart');
    expect(s.filter).toEqual({ tier: 'L4' });
    expect(s.executor).toBe('spawn');
  });

  it('defaults an unstamped start to the operator', () => {
    startDrainWorker({ intervalMs: 999_999 });
    expect(getWorkerStatus().origin).toBe('operator');
    expect(getWorkerStatus().filter).toEqual({});
    expect(getWorkerStatus().executor).toBe('bridge');
  });
});
