import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act, cleanup } from '@testing-library/react';
import type { PipelineArtifact } from '@/lib/pipeline-artifacts-db';

// Controllable fetch: return a promise the test resolves by hand, so the LOADING
// window is observable (an auto-resolving mock would flip to ready too fast to see).
const fetchMock = vi.fn();
vi.mock('@/components/layout-lab/labArtifactClient', () => ({
  fetchArtifacts: (...args: unknown[]) => fetchMock(...args),
}));

import {
  useCachedArtifacts,
  invalidateArtifacts,
  _resetArtifactCache,
} from '@/components/layout-lab/labArtifactCache';

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

const art = (step: string, status: PipelineArtifact['status'] = 'pass'): PipelineArtifact => ({
  catalogId: 'items', entityId: 'e1', step, data: {}, ueAssets: [], status, tier: 'L0',
});

beforeEach(() => { _resetArtifactCache(); fetchMock.mockReset(); });
afterEach(cleanup);

describe('labArtifactCache', () => {
  it('transitions loading → ready when the fetch resolves (the honest hydration signal)', async () => {
    const d = deferred<PipelineArtifact[]>();
    fetchMock.mockReturnValueOnce(d.promise);

    const { result } = renderHook(() => useCachedArtifacts('items', 'e1'));

    // The mount effect kicks off exactly one fetch and the entry reads LOADING (not "empty/pending").
    await waitFor(() => expect(result.current.loading).toBe(true));
    expect(result.current.loaded).toBe(false);
    expect(result.current.arts).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => { d.resolve([art('Concept Brief')]); });

    expect(result.current.loading).toBe(false);
    expect(result.current.loaded).toBe(true);
    expect(result.current.arts).toHaveLength(1);
  });

  it('dedups concurrent readers of the same key into ONE fetch (no fetch storm)', async () => {
    const d = deferred<PipelineArtifact[]>();
    fetchMock.mockReturnValue(d.promise);

    renderHook(() => useCachedArtifacts('items', 'e1'));
    renderHook(() => useCachedArtifacts('items', 'e1'));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await act(async () => { d.resolve([]); });
  });

  it('invalidation on produce drops the entry and refetches server truth', async () => {
    fetchMock.mockResolvedValueOnce([art('Economy', 'pass')]);
    const { result } = renderHook(() => useCachedArtifacts('items', 'e1'));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.arts[0].status).toBe('pass');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // A produce POSTs, the server re-grades, and the cache is invalidated → the next
    // read refetches and now sees the server verdict (fail).
    fetchMock.mockResolvedValueOnce([art('Economy', 'fail')]);
    await act(async () => { invalidateArtifacts('items', 'e1'); });

    await waitFor(() => expect(result.current.arts[0]?.status).toBe('fail'));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('an entity-scoped invalidation also stales the catalog-wide (matrix) key', async () => {
    fetchMock.mockResolvedValueOnce([art('Economy')]); // catalog-wide read (matrix)
    const { result } = renderHook(() => useCachedArtifacts('items'));
    await waitFor(() => expect(result.current.loaded).toBe(true));

    fetchMock.mockResolvedValueOnce([art('Economy', 'fail')]);
    await act(async () => { invalidateArtifacts('items', 'e1'); }); // an entity produce

    await waitFor(() => expect(result.current.arts[0]?.status).toBe('fail'));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('discards a stale in-flight response superseded by an invalidation', async () => {
    const first = deferred<PipelineArtifact[]>();
    fetchMock.mockReturnValueOnce(first.promise);
    const { result } = renderHook(() => useCachedArtifacts('items', 'e1'));
    await waitFor(() => expect(result.current.loading).toBe(true));

    // Invalidate mid-flight, then a NEW fetch resolves first.
    const second = deferred<PipelineArtifact[]>();
    fetchMock.mockReturnValueOnce(second.promise);
    await act(async () => { invalidateArtifacts('items', 'e1'); });
    await act(async () => { second.resolve([art('Economy', 'fail')]); });
    // The stale first response now resolves — it must NOT clobber the newer data.
    await act(async () => { first.resolve([art('Economy', 'pass')]); });

    expect(result.current.arts[0].status).toBe('fail');
  });
});
