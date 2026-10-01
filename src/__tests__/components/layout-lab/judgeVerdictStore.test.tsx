/**
 * The lab's judge-verdict cache as a LIVE store: stale-while-revalidate, never an empty expiry.
 *
 * Honest floor pinned here: an expired (or invalidated) verdict list must never make a step
 * read greener than the truth. While revalidating, the held verdicts stay on screen (marked
 * stale), never `[]`; a failed refetch keeps the last verdicts and surfaces the error, without
 * a fetch loop; mounted readers are told when a read lands or an invalidation retires theirs.
 *
 * scan-sweep --challenge run challenge-2026-10-01b, card lab-hooks/A.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor, cleanup } from '@testing-library/react';
import type { JudgeVerdict } from '@/lib/status/judge-verdicts-db';
import type { Result } from '@/types/result';

const fetchMock = vi.fn<(url: string) => Promise<Result<JudgeVerdict[], string>>>();
vi.mock('@/lib/api-utils', () => ({ tryApiFetch: (url: string) => fetchMock(url) }));

import {
  useCatalogJudgeVerdicts,
  useCatalogJudgeVerdictState,
  useStepJudgeVerdicts,
  invalidateJudgeVerdicts,
  clearJudgeVerdictCache,
  readAllJudgeVerdicts,
  peekAllJudgeVerdicts,
  JUDGE_VERDICT_CACHE_TTL_MS,
} from '@/components/layout-lab/hooks/useStepJudgeVerdicts';

const verdict = (v: 'pass' | 'fail', score: number): JudgeVerdict => ({
  catalogId: 'items', entityId: 'e1', step: 'Concept Brief', judge: 'llm-panel', verdict: v,
  score, model: 'm', findings: 'f', rubricVersion: 3,
} as JudgeVerdict);
const V1 = [verdict('fail', 40)];
const V2 = [verdict('pass', 95)];

/** A fetch whose answer the test releases by hand. */
function deferred() {
  let resolve!: (r: Result<JudgeVerdict[], string>) => void;
  const promise = new Promise<Result<JudgeVerdict[], string>>((r) => { resolve = r; });
  return { promise, resolve };
}

let now = 1_000_000;
beforeEach(() => {
  now = 1_000_000;
  vi.spyOn(Date, 'now').mockImplementation(() => now);
  clearJudgeVerdictCache();
  fetchMock.mockReset();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** Mount `useCatalogJudgeVerdicts('items')` and let the first read land V1. */
async function mountWithV1() {
  fetchMock.mockResolvedValue({ ok: true, data: V1 });
  let renders = 0;
  const hook = renderHook(() => { renders++; return useCatalogJudgeVerdicts('items'); });
  await waitFor(() => expect(hook.result.current).toEqual(V1));
  return { ...hook, renders: () => renders };
}

describe('judge-verdict store — stale-while-revalidate', () => {
  it('past the TTL a rerender serves the held rows (never []) and issues one revalidation', async () => {
    const { result, rerender } = await mountWithV1();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const pending = deferred();
    fetchMock.mockReturnValue(pending.promise);
    now += JUDGE_VERDICT_CACHE_TTL_MS + 1;
    rerender();
    expect(result.current).toEqual(V1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('the revalidation landing re-renders the mounted hook to the new rows, no prop change', async () => {
    const { result, rerender } = await mountWithV1();
    fetchMock.mockResolvedValue({ ok: true, data: V2 });
    now += JUDGE_VERDICT_CACHE_TTL_MS + 1;
    rerender();
    await waitFor(() => expect(result.current).toEqual(V2));
  });

  it('invalidateJudgeVerdicts notifies a mounted reader: one refetch, held rows until it lands', async () => {
    const { result, renders } = await mountWithV1();
    const before = renders();
    const pending = deferred();
    fetchMock.mockReturnValue(pending.promise);
    act(() => invalidateJudgeVerdicts('items'));
    expect(renders()).toBeGreaterThan(before);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current).toEqual(V1);
    await act(async () => { pending.resolve({ ok: true, data: V2 }); await pending.promise; });
    expect(result.current).toEqual(V2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('a failed revalidation keeps the held rows, surfaces the error, and does not loop', async () => {
    fetchMock.mockResolvedValue({ ok: true, data: V1 });
    const { result, rerender } = renderHook(() => ({
      rows: useCatalogJudgeVerdicts('items'),
      state: useCatalogJudgeVerdictState('items'),
    }));
    await waitFor(() => expect(result.current.rows).toEqual(V1));
    fetchMock.mockResolvedValue({ ok: false, error: 'HTTP 500' });
    now += JUDGE_VERDICT_CACHE_TTL_MS + 1;
    rerender();
    await waitFor(() => expect(result.current.state.error).toBe('HTTP 500'));
    expect(result.current.rows).toEqual(V1);
    expect(result.current.state.stale).toBe(true);
    rerender();
    rerender();
    await act(async () => { await Promise.resolve(); });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // …until the next expiry, which retries once.
    fetchMock.mockResolvedValue({ ok: true, data: V2 });
    now += JUDGE_VERDICT_CACHE_TTL_MS + 1;
    rerender();
    await waitFor(() => expect(result.current.rows).toEqual(V2));
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result.current.state).toMatchObject({ stale: false, error: undefined });
  });

  it('two stale readers of one key share ONE revalidation request', async () => {
    fetchMock.mockResolvedValue({ ok: true, data: V1 });
    const { result, rerender } = renderHook(() => ({
      all: useCatalogJudgeVerdicts('items'),
      step: useStepJudgeVerdicts('items', 'e1', 'Concept Brief'),
    }));
    await waitFor(() => expect(result.current.step).toEqual(V1));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockReturnValue(deferred().promise);
    now += JUDGE_VERDICT_CACHE_TTL_MS + 1;
    rerender();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current.all).toEqual(V1);
    expect(result.current.step).toEqual(V1);
  });

  it('[guard] an invalidation retires the in-flight read: its pre-write answer is never stored', async () => {
    const first = deferred();
    const second = deferred();
    fetchMock.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { result } = renderHook(() => useCatalogJudgeVerdicts('items'));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    act(() => invalidateJudgeVerdicts('items'));
    await act(async () => { first.resolve({ ok: true, data: V1 }); await first.promise; });
    expect(result.current).toEqual([]);
    await act(async () => { second.resolve({ ok: true, data: V2 }); await second.promise; });
    expect(result.current).toEqual(V2);
  });

  it('[guard] a never-successful first read serves [] and is never cached as an empty list', async () => {
    fetchMock.mockResolvedValue({ ok: false, error: 'HTTP 500' });
    const { result } = renderHook(() => useCatalogJudgeVerdicts('items'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await act(async () => { await Promise.resolve(); });
    expect(result.current).toEqual([]);
    expect(await readAllJudgeVerdicts()).toEqual({ ok: false, error: 'HTTP 500' });
    expect(peekAllJudgeVerdicts()).toBeUndefined();
  });
});
