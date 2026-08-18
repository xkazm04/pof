/**
 * The last-visit stamp: the baseline the changed-since digest compares against.
 *
 * Two properties matter. A FIRST visit has no baseline (which must never read as "everything
 * changed"), and the baseline is FROZEN for the page session — otherwise opening a catalog
 * would stamp itself and the digest would always be empty.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, cleanup, act } from '@testing-library/react';
import { useLastVisit, _resetLastVisits } from '@/components/layout-lab/hooks/useLastVisit';
import { setLabPrefs } from '@/components/layout-lab/hooks/useLabPrefs';

const stored = () => JSON.parse(localStorage.getItem('pof-lab-prefs') ?? '{}') as {
  lastCatalogId?: string;
  lastVisitByCatalog?: Record<string, string>;
};

beforeEach(() => { localStorage.clear(); _resetLastVisits(); });
afterEach(cleanup);

describe('useLastVisit', () => {
  it('has NO baseline on a first visit, and records one for next time', async () => {
    const { result } = renderHook(() => useLastVisit('items'));

    await waitFor(() => expect(result.current.recorded).toBe(true));
    expect(result.current.since).toBeNull(); // not "everything changed" — nothing to compare
    expect(typeof stored().lastVisitByCatalog?.items).toBe('string');
  });

  it('compares a later session against the PREVIOUS visit, and re-stamps', async () => {
    const first = renderHook(() => useLastVisit('items'));
    await waitFor(() => expect(first.result.current.recorded).toBe(true));
    const firstStamp = stored().lastVisitByCatalog!.items;

    // A new page session: the freeze is per session, the stamp is persisted.
    cleanup();
    _resetLastVisits();
    const second = renderHook(() => useLastVisit('items'));
    await waitFor(() => expect(second.result.current.recorded).toBe(true));

    expect(second.result.current.since).toBe(firstStamp);
    expect(stored().lastVisitByCatalog!.items >= firstStamp).toBe(true); // re-stamped
  });

  it('keeps the baseline frozen while the catalog stays open', async () => {
    const { result, rerender } = renderHook(() => useLastVisit('items'));
    await waitFor(() => expect(result.current.recorded).toBe(true));
    rerender();
    rerender();
    // Still the first visit's answer — a re-render must not make this visit its own baseline.
    expect(result.current.since).toBeNull();
  });

  it('stamps per catalog, not per app', async () => {
    const a = renderHook(() => useLastVisit('items'));
    await waitFor(() => expect(a.result.current.recorded).toBe(true));
    const b = renderHook(() => useLastVisit('spellbook'));
    await waitFor(() => expect(b.result.current.recorded).toBe(true));

    const visits = stored().lastVisitByCatalog!;
    expect(Object.keys(visits).sort()).toEqual(['items', 'spellbook']);
  });

  it('does not clobber prefs written by another consumer', async () => {
    // The shell records where you were; the visit stamp must merge into the SAME prefs, not
    // overwrite them from a stale per-hook copy (which is what per-hook state used to do).
    act(() => setLabPrefs({ lastCatalogId: 'spellbook', lastEntityId: 'e1' }));

    const { result } = renderHook(() => useLastVisit('items'));
    await waitFor(() => expect(result.current.recorded).toBe(true));

    expect(stored().lastCatalogId).toBe('spellbook');
    expect(stored().lastVisitByCatalog?.items).toBeDefined();
  });
});
