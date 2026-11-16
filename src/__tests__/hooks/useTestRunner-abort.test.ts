/** Abort ends the in-flight scenario's poll within one poll interval, not after the 120 s timeout. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useTestHarnessPanel } from '@/components/modules/project-setup/TestHarnessPanel/useTestHarnessPanel';

const originalFetch = global.fetch;
const respond = (body: unknown) => new Response(JSON.stringify(body));

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  global.fetch = originalFetch;
});

describe('abort while a scenario hangs', () => {
  it('runSuite resolves within one poll interval (2000 ms) of the abort click', async () => {
    global.fetch = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(String(init.body)) : null;
      const testId = body?.spec?.testId ?? 'x';
      return respond({
        success: true,
        data: { testId, status: 'running', startTime: '', assertions: [], logs: [], errors: [] },
      });
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useTestHarnessPanel());
    act(() => { result.current.createSuite(); });

    let settled = false;
    let p: Promise<void> = Promise.resolve();
    act(() => { p = result.current.runSuite().then(() => { settled = true; }); });
    await act(async () => { await vi.advanceTimersByTimeAsync(5_000); });
    expect(settled).toBe(false);

    act(() => { result.current.abortRun(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
    expect(settled).toBe(true);
    await vi.advanceTimersByTimeAsync(130_000); // drain the old behaviour so a failure stays an assertion
    await p;
  });
});
