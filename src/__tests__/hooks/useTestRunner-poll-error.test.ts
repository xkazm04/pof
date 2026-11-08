/** A poll that keeps failing must say why, not report a timeout. */
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

describe('useTestRunner poll failure', () => {
  it('names the last poll failure instead of a bare timeout', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) =>
      init?.method === 'POST'
        ? respond({ success: true, data: running })
        : respond({ success: false, error: 'bridge offline' }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const { result } = renderHook(() => useTestRunner());
    let outcome: unknown = 'unset';
    void result.current.runTest(spec).then((r) => { outcome = r; });
    await act(async () => { await vi.advanceTimersByTimeAsync(125_000); });

    expect(outcome).toBeNull();
    expect(result.current.error).toContain('bridge offline');
  });
});
