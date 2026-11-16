/**
 * useTestRunner stops with its component and names why a poll gave up.
 *
 * The unmount cleanup used to be returned from a `useState` initializer, so React
 * stored it as state and never called it: a poll kept fetching for up to 120 s
 * after the Test Harness panel was gone.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useTestRunner } from '@/hooks/useTestRunner';
import { TEMPLATE_SCENARIO } from '@/components/modules/project-setup/TestHarnessPanel/constants';

const originalFetch = global.fetch;
const spec = { ...TEMPLATE_SCENARIO, testId: 'test-lifecycle' };
const running = { testId: spec.testId, status: 'running', startTime: '', assertions: [], logs: [], errors: [] };
const respond = (body: unknown) => new Response(JSON.stringify(body));

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  global.fetch = originalFetch;
});

describe('useTestRunner lifecycle', () => {
  it('stops polling once the component unmounts', async () => {
    const fetchMock = vi.fn(async () => respond({ success: true, data: running }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const { result, unmount } = renderHook(() => useTestRunner());
    void result.current.runTest(spec);
    await act(async () => { await vi.advanceTimersByTimeAsync(2_100); });
    const callsAtUnmount = fetchMock.mock.calls.length;
    expect(callsAtUnmount).toBe(2); // the POST and one poll

    unmount();
    await vi.advanceTimersByTimeAsync(20_000);
    expect(fetchMock.mock.calls.length).toBe(callsAtUnmount);
  });

  it('refuses a run requested after unmount', async () => {
    const fetchMock = vi.fn(async () => respond({ success: true, data: running }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const { result, unmount } = renderHook(() => useTestRunner());
    const runTest = result.current.runTest;
    unmount();

    await expect(runTest(spec)).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
