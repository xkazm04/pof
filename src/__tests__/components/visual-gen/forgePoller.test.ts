/**
 * `startTrackedPoll` — the ONE forge poll rail. Before it, the store carried three copies
 * of the same skeleton (a stopped flag, a timer, a 30-minute deadline, a cap of three
 * consecutive misses, register/unregister in `activePolls`) and the UE import panel a
 * fourth, divergent one. These cases pin the skeleton once: misses are forgiven until the
 * cap, the deadline is a hard stop, and a stop wins over a late response.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { startTrackedPoll, isTracked } from '@/components/modules/visual-gen/asset-forge/forgePoller';
import { useForgeStore } from '@/components/modules/visual-gen/asset-forge/useForgeStore';
import { ok, err, type Result } from '@/types/result';

const POLL_MS = 5_000;
const THIRTY_MIN = 30 * 60_000;

type Status = { status: 'running' | 'done'; n?: number };

function spec(fetchStatus: () => Promise<Result<Status, string>>, over: Record<string, unknown> = {}) {
  const onTick = vi.fn();
  const onTerminal = vi.fn();
  const onGiveUp = vi.fn();
  const handle = startTrackedPoll<Status>({
    id: 'poll-1',
    fetchStatus,
    isTerminal: (d) => d.status === 'done',
    onTick,
    onTerminal,
    onGiveUp,
    deadlineMs: THIRTY_MIN,
    intervalMs: POLL_MS,
    ...over,
  });
  return { handle, onTick, onTerminal, onGiveUp };
}

beforeEach(() => {
  vi.useFakeTimers();
  useForgeStore.setState({ jobs: [], activePolls: [] });
});
afterEach(() => {
  useForgeStore.getState().stopAllPolling();
  vi.useRealTimers();
});

describe('forgePoller — one rail', () => {
  it('two misses then a terminal payload: the terminal handler runs once, no give-up, the id is untracked', async () => {
    const replies: Result<Status, string>[] = [err('502'), err('502'), ok({ status: 'done', n: 7 })];
    const fetchStatus = vi.fn(async () => replies.shift() ?? ok<Status>({ status: 'running' }));
    const { onTerminal, onGiveUp } = spec(fetchStatus);
    expect(useForgeStore.getState().activePolls).toEqual(['poll-1']);

    await vi.advanceTimersByTimeAsync(POLL_MS * 5);

    expect(onTerminal).toHaveBeenCalledTimes(1);
    expect(onTerminal).toHaveBeenCalledWith({ status: 'done', n: 7 });
    expect(onGiveUp).not.toHaveBeenCalled();
    expect(fetchStatus).toHaveBeenCalledTimes(3);
    expect(isTracked('poll-1')).toBe(false);
    expect(useForgeStore.getState().activePolls).toEqual([]);
  });

  it('three misses in a row: give-up fires once with the miss sentence and no 4th fetch is made', async () => {
    let n = 0;
    const fetchStatus = vi.fn(async () => err(`timeout ${++n}`));
    const { onGiveUp, onTerminal } = spec(fetchStatus);

    await vi.advanceTimersByTimeAsync(POLL_MS * 10);

    expect(fetchStatus).toHaveBeenCalledTimes(3);
    expect(onGiveUp).toHaveBeenCalledTimes(1);
    expect(onGiveUp.mock.calls[0][0].message).toBe('Status polling failed 3 times in a row: timeout 3');
    expect(onTerminal).not.toHaveBeenCalled();
    expect(useForgeStore.getState().activePolls).toEqual([]);
  });

  it('always running: give-up fires at the deadline with the 30-min sentence and fetch stops', async () => {
    const fetchStatus = vi.fn(async () => ok<Status>({ status: 'running' }));
    const { onGiveUp, onTick } = spec(fetchStatus);

    await vi.advanceTimersByTimeAsync(THIRTY_MIN - POLL_MS);
    expect(onGiveUp).not.toHaveBeenCalled();
    expect(onTick).toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(POLL_MS * 2);
    expect(onGiveUp).toHaveBeenCalledTimes(1);
    expect(onGiveUp.mock.calls[0][0].reason).toBe('deadline');
    expect(onGiveUp.mock.calls[0][0].message).toMatch(/^Gave up tracking after 30 min/);

    const callsAtGiveUp = fetchStatus.mock.calls.length;
    await vi.advanceTimersByTimeAsync(POLL_MS * 20);
    expect(fetchStatus).toHaveBeenCalledTimes(callsAtGiveUp);
    expect(useForgeStore.getState().activePolls).toEqual([]);
  });

  it('stop() during an in-flight fetch: the late response calls neither the tick nor the terminal handler', async () => {
    let release: ((r: Result<Status, string>) => void) | null = null;
    const fetchStatus = vi.fn(() => new Promise<Result<Status, string>>((r) => { release = r; }));
    const { handle, onTick, onTerminal, onGiveUp } = spec(fetchStatus);

    await vi.advanceTimersByTimeAsync(POLL_MS);
    expect(fetchStatus).toHaveBeenCalledTimes(1);
    handle.stop();
    expect(useForgeStore.getState().activePolls).toEqual([]);

    release!(ok({ status: 'done' }));
    await vi.advanceTimersByTimeAsync(POLL_MS * 3);

    expect(onTick).not.toHaveBeenCalled();
    expect(onTerminal).not.toHaveBeenCalled();
    expect(onGiveUp).not.toHaveBeenCalled();
    expect(fetchStatus).toHaveBeenCalledTimes(1);
  });
});
