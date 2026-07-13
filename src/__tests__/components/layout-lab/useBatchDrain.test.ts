import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor, cleanup } from '@testing-library/react';
import type { DrainOutcome } from '@/components/layout-lab/batchDrainModel';
import type { DrainSummary } from '@/lib/test-gate-runner/types';

const drainMock = vi.fn();
const invalidateMock = vi.fn();
vi.mock('@/components/layout-lab/labArtifactClient', () => ({
  drainEntityGates: (...a: unknown[]) => drainMock(...a),
}));
vi.mock('@/components/layout-lab/labArtifactCache', () => ({
  invalidateArtifacts: (...a: unknown[]) => invalidateMock(...a),
}));

import { useBatchDrain, type BatchEntity } from '@/components/layout-lab/hooks/useBatchDrain';

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}
const okOutcome = (over: Partial<DrainSummary> = {}): DrainOutcome => ({
  kind: 'ok', summary: { ran: 0, passed: 0, failed: 0, deferred: 0, skipped: 0, screenshots: [], results: [], ...over },
});
const failResult = (step: string, reason: string) => ({
  job: { catalogId: 'c', entityId: 'e', step, tier: 'L3' as const },
  verdict: { status: 'fail' as const, detail: reason },
});
const ents: BatchEntity[] = [{ id: 'e1', name: 'One' }, { id: 'e2', name: 'Two' }, { id: 'e3', name: 'Three' }];

beforeEach(() => { drainMock.mockReset(); invalidateMock.mockReset(); });
afterEach(cleanup);

describe('useBatchDrain', () => {
  it('drains entities SERIALLY — e2 is not started until e1 resolves; invalidates per entity', async () => {
    const d1 = deferred<DrainOutcome>();
    const d2 = deferred<DrainOutcome>();
    drainMock.mockReturnValueOnce(d1.promise).mockReturnValueOnce(d2.promise);

    const { result } = renderHook(() => useBatchDrain('c', 0));
    let run!: Promise<void>;
    act(() => { run = result.current.start([{ id: 'e1', name: 'One' }, { id: 'e2', name: 'Two' }]); });

    // Only e1 is in flight — the loop awaits it before touching e2.
    await waitFor(() => expect(drainMock).toHaveBeenCalledTimes(1));
    expect(drainMock).toHaveBeenNthCalledWith(1, 'c', 'e1');
    expect(result.current.state.currentEntityId).toBe('e1');

    await act(async () => { d1.resolve(okOutcome({ ran: 1, passed: 1 })); });
    await waitFor(() => expect(drainMock).toHaveBeenCalledTimes(2));
    expect(drainMock).toHaveBeenNthCalledWith(2, 'c', 'e2');
    expect(invalidateMock).toHaveBeenNthCalledWith(1, 'c', 'e1'); // e1's result landed → grid refetch

    await act(async () => { d2.resolve(okOutcome({ ran: 1, failed: 1, results: [failResult('Gate', 'bad')] })); await run; });

    expect(result.current.state.running).toBe(false);
    expect(result.current.state.summary).toMatchObject({ entitiesRun: 2, passed: 1, failed: 1 });
    expect(result.current.state.summary?.fails).toEqual([{ entityId: 'e2', entityName: 'Two', step: 'Gate', reason: 'bad' }]);
    expect(invalidateMock).toHaveBeenCalledTimes(2);
  });

  it('on a 409 lease it retries once, then counts the entity as locked if still held', async () => {
    // e1: locked then ok (retry succeeds). e2: locked then locked (skipped as locked).
    drainMock
      .mockResolvedValueOnce({ kind: 'locked' }).mockResolvedValueOnce(okOutcome({ ran: 1, passed: 1 })) // e1
      .mockResolvedValueOnce({ kind: 'locked' }).mockResolvedValueOnce({ kind: 'locked' });               // e2

    const { result } = renderHook(() => useBatchDrain('c', 0));
    await act(async () => { await result.current.start([{ id: 'e1', name: 'One' }, { id: 'e2', name: 'Two' }]); });

    expect(drainMock).toHaveBeenCalledTimes(4); // each entity attempted twice (initial + one retry)
    expect(result.current.state.summary).toMatchObject({ entitiesRun: 1, passed: 1, entitiesLocked: 1 });
  });

  it('cancel stops the loop AFTER the in-flight entity completes (its result is kept)', async () => {
    const d1 = deferred<DrainOutcome>();
    drainMock.mockReturnValueOnce(d1.promise); // e1 in flight; e2/e3 should never be requested

    const { result } = renderHook(() => useBatchDrain('c', 0));
    let run!: Promise<void>;
    act(() => { run = result.current.start(ents); });
    await waitFor(() => expect(drainMock).toHaveBeenCalledTimes(1));

    act(() => { result.current.cancel(); });               // cancel while e1 is still running
    await act(async () => { d1.resolve(okOutcome({ ran: 1, passed: 1 })); await run; });

    expect(drainMock).toHaveBeenCalledTimes(1);             // e2, e3 never started
    expect(result.current.state.running).toBe(false);
    expect(result.current.state.doneEntityIds.has('e1')).toBe(true); // in-flight entity was folded
    expect(result.current.state.summary).toMatchObject({ entitiesRun: 1, passed: 1 });
  });

  it('ignores a second start() while a run is already in flight (no parallel drains)', async () => {
    const d1 = deferred<DrainOutcome>();
    drainMock.mockReturnValueOnce(d1.promise).mockResolvedValue(okOutcome());

    const { result } = renderHook(() => useBatchDrain('c', 0));
    let run!: Promise<void>;
    act(() => { run = result.current.start([{ id: 'e1', name: 'One' }]); });
    await waitFor(() => expect(drainMock).toHaveBeenCalledTimes(1));
    act(() => { void result.current.start(ents); }); // ignored: already running
    await act(async () => { d1.resolve(okOutcome()); await run; });

    expect(drainMock).toHaveBeenCalledTimes(1);
  });
});
