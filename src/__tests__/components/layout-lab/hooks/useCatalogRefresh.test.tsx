/**
 * The Matrix's catalog-wide refresh keeps its result per catalog. It used to hold ONE landed
 * slot for every catalog the hook instance had seen, so with two refreshes in flight (refresh
 * A, switch boards, refresh B) whichever response landed LAST overwrote the other: B's report
 * vanished from B's board when A's slower answer arrived, and A's was gone when you went back.
 * Within one catalog, an older refresh answering after a newer one must not win either.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import type { CatalogRefreshOutcome } from '@/components/layout-lab/labCatalogRefresh';
import type { Result } from '@/types/result';

type Res = Result<CatalogRefreshOutcome, string>;
const pending: { catalogId: string; resolve: (r: Res) => void }[] = [];
vi.mock('@/components/layout-lab/labCatalogRefresh', () => ({
  refreshCatalogFromServer: (catalogId: string) => new Promise<Res>((resolve) => { pending.push({ catalogId, resolve }); }),
}));

import { useCatalogRefresh } from '@/components/layout-lab/hooks/useCatalogRefresh';

const outcome = (rows: number): Res => ({
  ok: true, data: { entities: [], rows, reconciled: 0, adopted: 0, removed: 0, kept: 0, unchanged: 0 },
});
const ENTITIES: { id: string; name: string }[] = [];

beforeEach(() => { pending.length = 0; });
afterEach(cleanup);

describe('useCatalogRefresh — a result belongs to its catalog and its latest attempt', () => {
  it('two catalogs in flight: each board keeps its own report whichever lands last', async () => {
    const { result, rerender } = renderHook(({ c }) => useCatalogRefresh(c, ENTITIES), { initialProps: { c: 'items' } });
    act(() => { result.current.refresh(); });
    rerender({ c: 'spellbook' });
    act(() => { result.current.refresh(); });
    await act(async () => { pending[1].resolve(outcome(2)); }); // spellbook lands first
    await act(async () => { pending[0].resolve(outcome(7)); }); // items lands after
    expect(result.current.outcome?.rows).toBe(2);
    rerender({ c: 'items' });
    expect(result.current.outcome?.rows).toBe(7);
  });

  it('one catalog refreshed twice: the older answer landing last does not win', async () => {
    const { result } = renderHook(() => useCatalogRefresh('items', ENTITIES));
    act(() => { result.current.refresh(); });
    act(() => { result.current.refresh(); });
    await act(async () => { pending[1].resolve(outcome(9)); });
    await act(async () => { pending[0].resolve(outcome(1)); });
    expect(result.current.outcome?.rows).toBe(9);
    expect(result.current.refreshing).toBe(false);
  });
});
