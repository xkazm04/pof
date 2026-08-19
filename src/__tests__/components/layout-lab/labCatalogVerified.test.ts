/**
 * `LabCatalog` used to carry a `verified` count derived from `entity.lifecycle === 'verified'`.
 * Every catalog seed in the product hardcodes `lifecycle: 'planned'`, `catalog_lifecycle` holds
 * zero rows, and the only writer of that field lives in the legacy shell — so the number was
 * structurally incapable of being anything but `0` while 817 pipeline artifacts sat on disk.
 *
 * The field is GONE from the shape: the tree counts from the server-derived lifecycle (the same
 * derivation its entity dots use) and says `—` where it has none. This pins that the seed field
 * cannot come back in through the data hook.
 */
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useLabCatalogData, useLabDetail } from '@/components/layout-lab/useLabCatalogData';

describe('useLabCatalogData — no seed-derived verified count', () => {
  it('does not expose a `verified` field on any catalog', () => {
    const { result } = renderHook(() => useLabCatalogData());
    const catalogs = result.current.flatMap((g) => g.catalogs);
    expect(catalogs.length).toBeGreaterThan(0);
    for (const c of catalogs) expect('verified' in c).toBe(false);
  });

  it('still reports a real entity total per catalog', () => {
    const { result } = renderHook(() => useLabCatalogData());
    const items = result.current.flatMap((g) => g.catalogs).find((c) => c.catalogId === 'items');
    expect(items).toBeTruthy();
    expect(items!.total).toBeGreaterThan(0);
  });

  it('the per-catalog detail shape drops it too', () => {
    const { result } = renderHook(() => useLabDetail('items'));
    expect(result.current).toBeTruthy();
    expect('verified' in result.current!.catalog).toBe(false);
  });
});
