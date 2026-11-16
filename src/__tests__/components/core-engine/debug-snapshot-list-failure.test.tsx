import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { useDebugSnapshot } from '@/components/modules/core-engine/sub_debug/_shared/useDebugSnapshot';
import { usePerformanceProfilingStore } from '@/stores/performanceProfilingStore';

/**
 * scan-sweep night 2026-11-08 (debug-performance, state-coverage): a FAILED
 * session list is not an empty one. The profiling store swallows the list
 * error into `error` and leaves `sessionList` empty, so the Debug tab used to
 * report "No profiler capture yet" while the list route was down.
 */

afterEach(cleanup);

beforeEach(() => {
  usePerformanceProfilingStore.setState({ sessionList: [], activeSession: null, error: null, isLoading: false });
});

function mockList(envelope: unknown) {
  global.fetch = vi.fn(async () => ({ json: async () => envelope })) as unknown as typeof fetch;
}

describe('useDebugSnapshot list failure', () => {
  it('a failed list-sessions -> unavailable with the route reason, never no-capture', async () => {
    mockList({ success: false, error: 'database is locked' });
    const { result } = renderHook(() => useDebugSnapshot());
    await waitFor(() => expect(result.current.listed).toBe(true));
    expect(result.current.latest).toEqual({ kind: 'unavailable', reason: 'database is locked' });
    expect(result.current.provenance).toEqual({ kind: 'sample' });
  });

  it('control: an empty successful list stays no-capture', async () => {
    mockList({ success: true, data: { sessions: [] } });
    const { result } = renderHook(() => useDebugSnapshot());
    await waitFor(() => expect(result.current.listed).toBe(true));
    expect(result.current.latest).toEqual({ kind: 'no-capture' });
  });
});
