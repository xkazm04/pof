import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, waitFor, fireEvent, screen } from '@testing-library/react';

import { DrainWorkerControls } from '@/components/harness/DrainWorkerControls';
import { describeScope, startBody, AUTOSTART_DEFAULT_NOTE } from '@/components/harness/DrainWorkerControls/workerCopy';
import { DEFAULT_WORKER_SETTINGS } from '@/components/harness/DrainWorkerControls/WorkerSettingsForm';
import type { WorkerStatus } from '@/lib/test-gate-runner/worker';
import type { LeaseState } from '@/lib/test-gate-runner/drain-lease';

const originalFetch = global.fetch;

const STOPPED: WorkerStatus = {
  running: false, intervalMs: 0, ticks: 0, lastTickAt: null, lastSummary: null,
  origin: null, filter: {}, executor: 'bridge',
};

const RUNNING: WorkerStatus = {
  running: true, intervalMs: 30_000, ticks: 7, lastTickAt: '2026-08-18T09:15:00.000Z',
  lastSummary: { ran: 3, passed: 2, failed: 1, deferred: 0, skipped: 4 },
  origin: 'autostart', filter: { tier: 'L3', catalogId: 'items' }, executor: 'bridge',
};

const FREE_LEASE: LeaseState = { held: false, scope: null, since: null, scopes: [] };
const HELD_LEASE: LeaseState = { held: true, scope: 'items/item-1', since: '2026-08-18T09:14:00.000Z', scopes: ['items/item-1'] };

interface Call { url: string; init?: RequestInit }
let calls: Call[] = [];

function installFetch(
  worker: WorkerStatus,
  lease: LeaseState = FREE_LEASE,
  post: { ok: true; data: WorkerStatus } | { ok: false; error: string } = { ok: true, data: RUNNING },
) {
  global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    calls.push({ url, init });
    if (init?.method === 'POST') {
      return post.ok
        ? new Response(JSON.stringify({ success: true, data: post.data }), { status: 200 })
        : new Response(JSON.stringify({ success: false, error: post.error }), { status: 500 });
    }
    const data = url.includes('/drain/status') ? lease : worker;
    return new Response(JSON.stringify({ success: true, data }), { status: 200 });
  }) as unknown as typeof fetch;
}

const postBodies = () =>
  calls.filter((c) => c.init?.method === 'POST').map((c) => JSON.parse(String(c.init?.body)));

beforeEach(() => { calls = []; });
afterEach(() => { global.fetch = originalFetch; cleanup(); vi.restoreAllMocks(); });

describe('workerCopy (pure)', () => {
  it('describes an unfiltered worker as every catalog at both runtime tiers', () => {
    expect(describeScope({})).toBe('every catalog · L3+L4');
    expect(describeScope(undefined)).toBe('every catalog · L3+L4');
    expect(describeScope({ tier: 'L4', catalogId: 'items' })).toBe('items · L4');
  });

  it('builds a start body from the settings, omitting blanks', () => {
    expect(startBody(DEFAULT_WORKER_SETTINGS)).toEqual({ action: 'start', intervalMs: 30_000, executor: 'bridge' });
    expect(startBody({ intervalSeconds: '90', executor: 'spawn', tier: 'L4', catalogId: ' items ' }))
      .toEqual({ action: 'start', intervalMs: 90_000, executor: 'spawn', tier: 'L4', catalogId: 'items' });
  });

  it('states the auto-start default explicitly', () => {
    expect(AUTOSTART_DEFAULT_NOTE).toContain('OFF by default');
    expect(AUTOSTART_DEFAULT_NOTE).toContain('POF_DRAIN_WORKER_AUTOSTART=1');
  });
});

describe('DrainWorkerControls', () => {
  it('shows running state, who started it, tick + last-drain summary, and a free lease', async () => {
    installFetch(RUNNING);
    const { container } = render(<DrainWorkerControls />);
    await waitFor(() => expect(container.querySelector('[data-testid="drain-worker-state"]')).toBeTruthy());

    expect(container.querySelector('[data-testid="drain-worker-state"]')?.getAttribute('data-running')).toBe('true');
    expect(container.textContent).toContain('boot auto-start');
    expect(container.textContent).toContain('items · L3');
    expect(container.querySelector('[data-testid="drain-worker-summary"]')?.textContent).toContain('ran 3');
    expect(container.querySelector('[data-testid="drain-worker-lease"]')?.getAttribute('data-held')).toBe('false');
    // The auto-start default is stated in the product, not only the docs.
    expect(container.querySelector('[data-testid="drain-worker-autostart-note"]')?.textContent).toContain('OFF by default');
  });

  it('surfaces a held drain lease and says the worker skips rather than contends', async () => {
    installFetch(RUNNING, HELD_LEASE);
    const { container } = render(<DrainWorkerControls />);
    await waitFor(() =>
      expect(container.querySelector('[data-testid="drain-worker-lease"]')?.getAttribute('data-held')).toBe('true'));
    const lease = container.querySelector('[data-testid="drain-worker-lease"]')!;
    expect(lease.textContent).toContain('items/item-1');
    expect(lease.textContent).toContain('SKIP');
  });

  it('disables Stop with a reason while the worker is not running', async () => {
    installFetch(STOPPED);
    const { container } = render(<DrainWorkerControls />);
    await waitFor(() => expect(container.querySelector('[data-testid="drain-worker-stop"]')).toBeTruthy());
    expect(container.querySelector<HTMLButtonElement>('[data-testid="drain-worker-stop"]')!.disabled).toBe(true);
    expect(container.querySelector('[data-testid="drain-worker-stop-reason"]')?.textContent).toContain('nothing to stop');
    expect(container.querySelector<HTMLButtonElement>('[data-testid="drain-worker-start"]')!.textContent)
      .toContain('Start worker');
  });

  it('starts the worker with the chosen settings', async () => {
    installFetch(STOPPED);
    const { container } = render(<DrainWorkerControls />);
    await waitFor(() => expect(container.querySelector('[data-testid="drain-worker-start"]')).toBeTruthy());

    fireEvent.change(container.querySelector('#drain-worker-interval')!, { target: { value: '45' } });
    fireEvent.change(container.querySelector('#drain-worker-tier')!, { target: { value: 'L3' } });
    fireEvent.change(container.querySelector('#drain-worker-catalog')!, { target: { value: 'items' } });
    fireEvent.click(container.querySelector('[data-testid="drain-worker-start"]')!);

    await waitFor(() => expect(postBodies()).toEqual([
      { action: 'start', intervalMs: 45_000, executor: 'bridge', tier: 'L3', catalogId: 'items' },
    ]));
    expect(calls.filter((c) => c.init?.method === 'POST')[0].url).toBe('/api/pipeline-artifacts/drain/worker');
    await waitFor(() =>
      expect(container.querySelector('[data-testid="drain-worker-note"]')?.textContent).toContain('every 30s'));
  });

  it('stops the worker and reports what stopping costs', async () => {
    installFetch(RUNNING, FREE_LEASE, { ok: true, data: STOPPED });
    const { container } = render(<DrainWorkerControls />);
    await waitFor(() => expect(container.querySelector('[data-testid="drain-worker-stop"]')).toBeTruthy());
    fireEvent.click(container.querySelector('[data-testid="drain-worker-stop"]')!);
    await waitFor(() => expect(postBodies()).toEqual([{ action: 'stop' }]));
    await waitFor(() =>
      expect(container.querySelector('[data-testid="drain-worker-note"]')?.textContent).toContain('operator drain'));
  });

  it('warns that spawn is separately gated', async () => {
    installFetch(STOPPED);
    const { container } = render(<DrainWorkerControls />);
    await waitFor(() => expect(container.querySelector('#drain-worker-executor')).toBeTruthy());
    expect(container.querySelector('[data-testid="drain-worker-spawn-note"]')).toBeNull();
    fireEvent.change(container.querySelector('#drain-worker-executor')!, { target: { value: 'spawn' } });
    expect(container.querySelector('[data-testid="drain-worker-spawn-note"]')?.textContent).toContain('allowSpawn');
  });

  it('surfaces a failed toggle and disables controls when the status read fails', async () => {
    installFetch(STOPPED, FREE_LEASE, { ok: false, error: 'drain worker toggle failed' });
    const { container } = render(<DrainWorkerControls />);
    await waitFor(() => expect(container.querySelector('[data-testid="drain-worker-start"]')).toBeTruthy());
    fireEvent.click(container.querySelector('[data-testid="drain-worker-start"]')!);
    expect((await screen.findByRole('alert')).textContent).toContain('drain worker toggle failed');
    cleanup();

    global.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ success: false, error: 'nope' }), { status: 500 })) as unknown as typeof fetch;
    const blind = render(<DrainWorkerControls />);
    await waitFor(() => expect(blind.container.querySelector('[data-testid="drain-worker-start"]')).toBeTruthy());
    expect(blind.container.querySelector<HTMLButtonElement>('[data-testid="drain-worker-start"]')!.disabled).toBe(true);
    expect(blind.container.querySelector('[data-testid="drain-worker-stop-reason"]')?.textContent).toContain('unreadable');
  });
});
