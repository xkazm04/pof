import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act, cleanup } from '@testing-library/react';
import type { PipelineArtifact } from '@/lib/pipeline-artifacts-db';

// Controllable fetch: return a promise the test resolves by hand, so the LOADING
// window is observable (an auto-resolving mock would flip to ready too fast to see).
const fetchMock = vi.fn();
vi.mock('@/components/layout-lab/labArtifactClient', () => ({
  fetchArtifactsResult: (...args: unknown[]) => fetchMock(...args),
}));

import {
  useCachedArtifacts,
  invalidateArtifacts,
  retryArtifacts,
  _resetArtifactCache,
} from '@/components/layout-lab/labArtifactCache';
import type { Result } from '@/types/result';

type ArtsResult = Result<PipelineArtifact[], string>;
/** The client's success envelope - the cache reads a `Result`, not a bare array. */
const ok = (arts: PipelineArtifact[]): ArtsResult => ({ ok: true, data: arts });

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
    const d = deferred<ArtsResult>();
    fetchMock.mockReturnValueOnce(d.promise);

    const { result } = renderHook(() => useCachedArtifacts('items', 'e1'));

    // The mount effect kicks off exactly one fetch and the entry reads LOADING (not "empty/pending").
    await waitFor(() => expect(result.current.loading).toBe(true));
    expect(result.current.loaded).toBe(false);
    expect(result.current.arts).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => { d.resolve(ok([art('Concept Brief')])); });

    expect(result.current.loading).toBe(false);
    expect(result.current.loaded).toBe(true);
    expect(result.current.arts).toHaveLength(1);
  });

  it('dedups concurrent readers of the same key into ONE fetch (no fetch storm)', async () => {
    const d = deferred<ArtsResult>();
    fetchMock.mockReturnValue(d.promise);

    renderHook(() => useCachedArtifacts('items', 'e1'));
    renderHook(() => useCachedArtifacts('items', 'e1'));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await act(async () => { d.resolve(ok([])); });
  });

  it('invalidation on produce drops the entry and refetches server truth', async () => {
    fetchMock.mockResolvedValueOnce(ok([art('Economy', 'pass')]));
    const { result } = renderHook(() => useCachedArtifacts('items', 'e1'));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.arts[0].status).toBe('pass');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // A produce POSTs, the server re-grades, and the cache is invalidated → the next
    // read refetches and now sees the server verdict (fail).
    fetchMock.mockResolvedValueOnce(ok([art('Economy', 'fail')]));
    await act(async () => { invalidateArtifacts('items', 'e1'); });

    await waitFor(() => expect(result.current.arts[0]?.status).toBe('fail'));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('an entity-scoped invalidation also stales the catalog-wide (matrix) key', async () => {
    fetchMock.mockResolvedValueOnce(ok([art('Economy')])); // catalog-wide read (matrix)
    const { result } = renderHook(() => useCachedArtifacts('items'));
    await waitFor(() => expect(result.current.loaded).toBe(true));

    fetchMock.mockResolvedValueOnce(ok([art('Economy', 'fail')]));
    await act(async () => { invalidateArtifacts('items', 'e1'); }); // an entity produce

    await waitFor(() => expect(result.current.arts[0]?.status).toBe('fail'));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('discards a stale in-flight response superseded by an invalidation', async () => {
    const first = deferred<ArtsResult>();
    fetchMock.mockReturnValueOnce(first.promise);
    const { result } = renderHook(() => useCachedArtifacts('items', 'e1'));
    await waitFor(() => expect(result.current.loading).toBe(true));

    // Invalidate mid-flight, then a NEW fetch resolves first.
    const second = deferred<ArtsResult>();
    fetchMock.mockReturnValueOnce(second.promise);
    await act(async () => { invalidateArtifacts('items', 'e1'); });
    await act(async () => { second.resolve(ok([art('Economy', 'fail')])); });
    // The stale first response now resolves — it must NOT clobber the newer data.
    await act(async () => { first.resolve(ok([art('Economy', 'pass')])); });

    expect(result.current.arts[0].status).toBe('fail');
  });

  // ── failed fetch ≠ empty catalog ────────────────────────────────────────────
  it('stores a 500 as an ERROR, never as a successful empty load', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, error: 'HTTP 500' } satisfies ArtsResult);
    const { result } = renderHook(() => useCachedArtifacts('items', 'e1'));

    await waitFor(() => expect(result.current.error).toBe('HTTP 500'));
    // The three states are distinguishable: not loading, not loaded, and the empty
    // `arts` means UNKNOWN — a genuinely empty catalog reads `loaded: true, error: null`.
    expect(result.current.loading).toBe(false);
    expect(result.current.loaded).toBe(false);
    expect(result.current.arts).toEqual([]);
  });

  it('does not auto-retry an errored key (a dead server must not spin a fetch loop)', async () => {
    fetchMock.mockResolvedValue({ ok: false, error: 'HTTP 500' } satisfies ArtsResult);
    const { result } = renderHook(() => useCachedArtifacts('items', 'e1'));
    await waitFor(() => expect(result.current.error).toBe('HTTP 500'));

    // Re-render + a second subscriber must not re-issue while the error stands.
    renderHook(() => useCachedArtifacts('items', 'e1'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });

  it('retryArtifacts clears the error and re-reads server truth', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, error: 'HTTP 500' } satisfies ArtsResult);
    const { result } = renderHook(() => useCachedArtifacts('items', 'e1'));
    await waitFor(() => expect(result.current.error).toBe('HTTP 500'));

    fetchMock.mockResolvedValueOnce(ok([art('Economy', 'pass')]));
    await act(async () => { retryArtifacts('items', 'e1'); });

    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.error).toBeNull();
    expect(result.current.arts).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
