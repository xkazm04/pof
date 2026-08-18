import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  useForgeStore,
  FORGE_POLL_MAX_DURATION_MS,
} from '@/components/modules/visual-gen/asset-forge/useForgeStore';

/**
 * The forge status poll lives in a store ACTION, not a React effect, so neither
 * `SuspendContext` nor the module LRU's unmount can stop it. These tests prove it
 * stops ANYWAY — on a wall-clock deadline, on an explicit operator stop — and that
 * a long-running generation still completes normally rather than being cut short.
 */

const POLL_MS = 5_000; // UI_TIMEOUTS.blenderGenPollInterval

function envelope(data: unknown): Response {
  return { json: async () => ({ success: true, data }) } as unknown as Response;
}

/** Mock the local-runner endpoints. `statusRef.value` is what /status reports. */
function mockRunner(statusRef: { value: Record<string, unknown> }) {
  const statusCalls = { count: 0 };
  const fetchMock = vi.fn(async (url: string) => {
    if (url.includes('/api/visual-gen/generate/status')) {
      statusCalls.count++;
      return envelope(statusRef.value);
    }
    return envelope({ jobId: 'runner-job-1' });
  });
  vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);
  return statusCalls;
}

/** Advance fake time (and Date.now) by `ms`, flushing each poll's awaits. */
async function tickFor(ms: number) {
  for (let elapsed = 0; elapsed < ms; elapsed += POLL_MS) {
    await vi.advanceTimersByTimeAsync(POLL_MS);
  }
}

describe('forge poll termination', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useForgeStore.setState({ jobs: [], promptHistory: [], activePolls: [] });
  });

  afterEach(() => {
    useForgeStore.getState().stopAllPolling();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('stops polling at the wall-clock deadline instead of running forever', async () => {
    const statusRef = { value: { status: 'running' } as Record<string, unknown> };
    const statusCalls = mockRunner(statusRef);

    await useForgeStore.getState().submitLocalJob('triposr', 'image-to-3d', 'data:image/png;base64,AA');
    expect(useForgeStore.getState().activePolls).toHaveLength(1);

    await tickFor(FORGE_POLL_MAX_DURATION_MS + POLL_MS * 2);

    // Terminated: no tracked poll, and the job says WHY it stopped.
    expect(useForgeStore.getState().activePolls).toEqual([]);
    const job = useForgeStore.getState().jobs[0];
    expect(job.status).toBe('failed');
    expect(job.error).toMatch(/Gave up tracking after 30 min/);

    // And the timer is really gone: more time passes, no further network calls.
    const callsAtStop = statusCalls.count;
    await tickFor(POLL_MS * 20);
    expect(statusCalls.count).toBe(callsAtStop);
  });

  it('still completes a long-running generation that finishes before the deadline', async () => {
    const statusRef = { value: { status: 'running' } as Record<string, unknown> };
    mockRunner(statusRef);

    await useForgeStore.getState().submitLocalJob('triposr', 'image-to-3d', 'data:image/png;base64,AA');

    // 20 minutes of honest "still working" — well past any component lifetime.
    await tickFor(20 * 60_000);
    expect(useForgeStore.getState().jobs[0].status).toBe('generating');
    expect(useForgeStore.getState().activePolls).toHaveLength(1);

    statusRef.value = { status: 'done', meshPath: '/generated/triposr/x.glb' };
    await tickFor(POLL_MS * 2);

    const job = useForgeStore.getState().jobs[0];
    expect(job.status).toBe('completed');
    expect(job.resultUrl).toBe('/generated/triposr/x.glb');
    expect(useForgeStore.getState().activePolls).toEqual([]);
  });

  it('an explicit operator stop ends the poll and states that tracking stopped', async () => {
    const statusRef = { value: { status: 'running' } as Record<string, unknown> };
    const statusCalls = mockRunner(statusRef);

    await useForgeStore.getState().submitLocalJob('triposr', 'image-to-3d', 'data:image/png;base64,AA');
    await tickFor(POLL_MS * 3);
    expect(statusCalls.count).toBeGreaterThan(0);

    useForgeStore.getState().stopAllPolling();

    expect(useForgeStore.getState().activePolls).toEqual([]);
    const job = useForgeStore.getState().jobs[0];
    expect(job.status).toBe('failed');
    expect(job.error).toMatch(/Tracking stopped by operator/);

    const callsAtStop = statusCalls.count;
    await tickFor(POLL_MS * 10);
    expect(statusCalls.count).toBe(callsAtStop);
  });

  it('removeJob de-registers the poll from the operator-visible list', async () => {
    const statusRef = { value: { status: 'running' } as Record<string, unknown> };
    mockRunner(statusRef);

    await useForgeStore.getState().submitLocalJob('triposr', 'image-to-3d', 'data:image/png;base64,AA');
    const id = useForgeStore.getState().jobs[0].id;
    expect(useForgeStore.getState().activePolls).toEqual([id]);

    useForgeStore.getState().removeJob(id);
    expect(useForgeStore.getState().activePolls).toEqual([]);
    expect(useForgeStore.getState().jobs).toEqual([]);
  });
});
