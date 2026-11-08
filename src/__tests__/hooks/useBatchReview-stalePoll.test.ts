/** A dead server must not read as an endless "Reviewing": repeated poll failures surface on error. */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useBatchReview, MAX_MISSED_BATCH_POLLS } from '@/hooks/useBatchReview';
import { UI_TIMEOUTS } from '@/lib/constants';

const originalFetch = globalThis.fetch;
afterEach(() => { cleanup(); vi.useRealTimers(); globalThis.fetch = originalFetch; });

const reply = (body: unknown, status = 200) => ({
  ok: status < 400,
  status,
  json: () => Promise.resolve(body),
  text: () => Promise.resolve(JSON.stringify(body)),
});

const RUNNING = { status: 'running', startedAt: 1 };

describe('useBatchReview poll health', () => {
  it('after MAX_MISSED_BATCH_POLLS failed polls of a running batch, error names the dead poll; a good poll clears it', async () => {
    vi.useFakeTimers();
    let alive = true;
    globalThis.fetch = vi.fn(() => Promise.resolve(
      alive ? reply({ success: true, data: { batch: RUNNING } }) : reply({ success: false, error: 'down' }, 500),
    )) as unknown as typeof fetch;

    const { result } = renderHook(() => useBatchReview());
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(result.current.isRunning).toBe(true);
    expect(result.current.error).toBeNull();

    alive = false;
    await act(async () => { await vi.advanceTimersByTimeAsync(UI_TIMEOUTS.pollInterval * (MAX_MISSED_BATCH_POLLS - 1)); });
    expect(result.current.error).toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(UI_TIMEOUTS.pollInterval * 2); });
    expect(result.current.error).toContain('not answering');

    alive = true;
    await act(async () => { await vi.advanceTimersByTimeAsync(UI_TIMEOUTS.pollInterval); });
    expect(result.current.error).toBeNull();
  });
});
