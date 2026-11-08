/**
 * A background refresh that READ the table before a mutation landed must not
 * overwrite that mutation.
 *
 * `useDesignDocument` merges every create/update/delete response into local state
 * directly, and the level-design commit buffer clears its overlay as soon as the PUT
 * resolves. A background `refetch()` (the sync CLI's completion fires one) dispatched
 * BEFORE that PUT then resolved with the pre-PUT row and replaced the list wholesale:
 * the saved edit snapped back on screen, a created doc vanished, a deleted one came back.
 *
 * RED before the fix: the stale GET won in all three cases.
 */
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { renderHook, cleanup, waitFor, act } from '@testing-library/react';
import type { LevelDesignDocument } from '@/types/level-design';

type Deferred = { url: string; init?: RequestInit; resolve: (v: unknown) => void };
const h = vi.hoisted(() => ({ calls: [] as Deferred[] }));

vi.mock('@/lib/api-utils', async (orig) => {
  const real = await orig<typeof import('@/lib/api-utils')>();
  return {
    ...real,
    apiFetch: vi.fn((url: string, init?: RequestInit) =>
      new Promise((resolve) => { h.calls.push({ url, init, resolve }); })),
  };
});

import { useDesignDocument } from '@/hooks/useDesignDocument';

function doc(id: number, name: string): LevelDesignDocument {
  return { id, name, rooms: [], connections: [], syncStatus: 'unlinked' } as unknown as LevelDesignDocument;
}

const gets = () => h.calls.filter((c) => !c.init?.method);
const lastGet = () => gets()[gets().length - 1];
const byMethod = (m: string) => h.calls.find((c) => c.init?.method === m)!;

beforeEach(() => { h.calls.length = 0; });
afterEach(cleanup);

async function mountWith(initial: LevelDesignDocument[]) {
  const hook = renderHook(() => useDesignDocument());
  await waitFor(() => expect(gets().length).toBe(1));
  await act(async () => { gets()[0].resolve({ docs: initial }); });
  await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
  return hook;
}

/** Answer every GET issued after the stale one with the post-mutation table. */
async function answerFreshGets(fromIndex: number, docs: LevelDesignDocument[]) {
  for (let i = fromIndex; i < gets().length; i++) {
    await act(async () => { gets()[i].resolve({ docs }); });
  }
}

describe('useDesignDocument — background refresh vs. mutation', () => {
  it('a PUT that lands during a refresh is not reverted by the stale GET', async () => {
    const { result } = await mountWith([doc(1, 'v1')]);

    let refresh!: Promise<void>;
    act(() => { refresh = result.current.refetch(); });
    const staleIdx = gets().length - 1;

    let saved!: Promise<unknown>;
    act(() => { saved = result.current.updateDoc({ id: 1, name: 'v2' } as never); });
    await act(async () => { byMethod('PUT').resolve({ doc: doc(1, 'v2') }); await saved; });
    expect(result.current.docs[0].name).toBe('v2');

    // The refresh read the table before the PUT: it answers with v1.
    await act(async () => { gets()[staleIdx].resolve({ docs: [doc(1, 'v1')] }); });
    await answerFreshGets(staleIdx + 1, [doc(1, 'v2')]);
    await act(async () => { await refresh; });

    expect(result.current.docs[0].name).toBe('v2');
  });

  it('a doc created during a refresh does not vanish', async () => {
    const { result } = await mountWith([doc(1, 'a')]);
    act(() => { void result.current.refetch(); });
    const staleIdx = gets().length - 1;

    let made!: Promise<unknown>;
    act(() => { made = result.current.createDoc({ name: 'b' } as never); });
    await act(async () => { byMethod('POST').resolve({ doc: doc(2, 'b') }); await made; });

    await act(async () => { gets()[staleIdx].resolve({ docs: [doc(1, 'a')] }); });
    await answerFreshGets(staleIdx + 1, [doc(2, 'b'), doc(1, 'a')]);

    expect(result.current.docs.map((d) => d.id).sort()).toEqual([1, 2]);
    expect(result.current.activeDoc?.id).toBe(2);
  });

  it('a doc deleted during a refresh does not come back', async () => {
    const { result } = await mountWith([doc(1, 'a'), doc(2, 'b')]);
    act(() => { void result.current.refetch(); });
    const staleIdx = gets().length - 1;

    let gone!: Promise<unknown>;
    act(() => { gone = result.current.deleteDoc(2); });
    await act(async () => { byMethod('DELETE').resolve({}); await gone; });

    await act(async () => { gets()[staleIdx].resolve({ docs: [doc(1, 'a'), doc(2, 'b')] }); });
    await answerFreshGets(staleIdx + 1, [doc(1, 'a')]);

    expect(result.current.docs.map((d) => d.id)).toEqual([1]);
  });

  it('[control] a refresh with no mutation in flight applies its rows', async () => {
    const { result } = await mountWith([doc(1, 'v1')]);
    act(() => { void result.current.refetch(); });
    await act(async () => { lastGet().resolve({ docs: [doc(1, 'server-side')] }); });
    expect(result.current.docs[0].name).toBe('server-side');
    expect(gets().length).toBe(2);
  });
});
