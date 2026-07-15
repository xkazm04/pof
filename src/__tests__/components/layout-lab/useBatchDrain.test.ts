import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor, cleanup } from '@testing-library/react';
import type { DrainOutcome } from '@/components/layout-lab/batchDrainModel';
import type { DrainSummary } from '@/lib/test-gate-runner/types';

const drainMock = vi.fn();
const invalidateMock = vi.fn();
vi.mock('@/components/layout-lab/labArtifactClient', () => ({
  drainCatalogGates: (...a: unknown[]) => drainMock(...a),
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
const failResult = (entityId: string, step: string, reason: string) => ({
  job: { catalogId: 'c', entityId, step, tier: 'L3' as const },
  verdict: { status: 'fail' as const, detail: reason },
});
const ents: BatchEntity[] = [{ id: 'e1', name: 'One' }, { id: 'e2', name: 'Two' }, { id: 'e3', name: 'Three' }];

beforeEach(() => { drainMock.mockReset(); invalidateMock.mockReset(); });
afterEach(cleanup);

describe('useBatchDrain — one-boot batch', () => {
  it('sends the WHOLE set in a SINGLE request (catalogId + entityIds), never one per entity', async () => {
    const d = deferred<DrainOutcome>();
    drainMock.mockReturnValueOnce(d.promise);

    const { result } = renderHook(() => useBatchDrain('c', 0));
    let run!: Promise<void>;
    act(() => { run = result.current.start(ents); });

    await waitFor(() => expect(drainMock).toHaveBeenCalledTimes(1));
    // ONE POST with the full id list — not three per-entity calls.
    expect(drainMock).toHaveBeenCalledWith('c', ['e1', 'e2', 'e3']);
    // While in flight, all requested entities are marked active (for the grid highlight).
    expect([...result.current.state.activeEntityIds]).toEqual(['e1', 'e2', 'e3']);
    expect(result.current.state.running).toBe(true);
    expect(result.current.state.total).toBe(3);

    await act(async () => {
      d.resolve(okOutcome({ ran: 3, passed: 2, failed: 1, results: [failResult('e2', 'Gate', 'bad')] }));
      await run;
    });

    // Still a single request after completion.
    expect(drainMock).toHaveBeenCalledTimes(1);
    expect(result.current.state.running).toBe(false);
    expect(result.current.state.activeEntityIds.size).toBe(0);
    expect([...result.current.state.doneEntityIds]).toEqual(['e1', 'e2', 'e3']);
    // Result mapping from the aggregate batch summary.
    expect(result.current.state.summary).toMatchObject({ entitiesRun: 1, passed: 2, failed: 1 });
    expect(result.current.state.summary?.fails).toEqual([{ entityId: 'e2', entityName: 'Two', step: 'Gate', reason: 'bad' }]);
    // One whole-catalog cache invalidation (grid refetches every entity).
    expect(invalidateMock).toHaveBeenCalledTimes(1);
    expect(invalidateMock).toHaveBeenCalledWith('c');
  });

  it('on a 409 batch lease it retries the whole batch once, then records ALL entities locked', async () => {
    drainMock
      .mockResolvedValueOnce({ kind: 'locked' })  // initial attempt refused
      .mockResolvedValueOnce({ kind: 'locked' }); // retry still refused

    const { result } = renderHook(() => useBatchDrain('c', 0));
    await act(async () => { await result.current.start(ents); });

    expect(drainMock).toHaveBeenCalledTimes(2); // batch attempted twice (initial + one retry)
    expect(drainMock).toHaveBeenNthCalledWith(1, 'c', ['e1', 'e2', 'e3']);
    expect(drainMock).toHaveBeenNthCalledWith(2, 'c', ['e1', 'e2', 'e3']);
    // All-or-nothing: every requested entity is locked, none run.
    expect(result.current.state.summary).toMatchObject({ entitiesLocked: 3, entitiesRun: 0 });
  });

  it('a 409 that clears on retry drains the whole set in the second attempt', async () => {
    drainMock
      .mockResolvedValueOnce({ kind: 'locked' })
      .mockResolvedValueOnce(okOutcome({ ran: 2, passed: 2 }));

    const { result } = renderHook(() => useBatchDrain('c', 0));
    await act(async () => { await result.current.start(ents); });

    expect(drainMock).toHaveBeenCalledTimes(2);
    expect(result.current.state.summary).toMatchObject({ passed: 2, entitiesLocked: 0 });
  });

  it('cancel() only skips the retry (the in-flight boot is not interruptible)', async () => {
    const d1 = deferred<DrainOutcome>();
    drainMock.mockReturnValueOnce(d1.promise); // initial attempt; a retry must NOT happen after cancel

    const { result } = renderHook(() => useBatchDrain('c', 0));
    let run!: Promise<void>;
    act(() => { run = result.current.start(ents); });
    await waitFor(() => expect(drainMock).toHaveBeenCalledTimes(1));

    act(() => { result.current.cancel(); }); // cancel while the batch is in flight
    await act(async () => { d1.resolve({ kind: 'locked' }); await run; }); // it comes back locked

    // The retry is skipped because cancel was requested → still exactly one call.
    expect(drainMock).toHaveBeenCalledTimes(1);
    expect(result.current.state.running).toBe(false);
    expect(result.current.state.summary).toMatchObject({ entitiesLocked: 3 });
  });

  it('ignores a second start() while a batch is already in flight (no overlapping drains)', async () => {
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
