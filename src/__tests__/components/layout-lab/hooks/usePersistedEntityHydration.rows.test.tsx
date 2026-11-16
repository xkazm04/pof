/**
 * The hydration checks the ENVELOPE's shape (an `entities` array) but used to trust every ROW in
 * it. One malformed row (null, or missing its ids) threw inside the merge — an unhandled
 * rejection that also discarded every good row beside it, so the tree lost all persisted
 * entities over one bad record. Malformed rows are dropped and named; good rows still land.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { usePersistedEntityHydration } from '@/components/layout-lab/hooks/usePersistedEntityHydration';
import { useCatalogStore } from '@/stores/catalogStore';
import { logger } from '@/lib/logger';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  useCatalogStore.setState({ draftEntitiesByCatalog: {} });
});

describe('usePersistedEntityHydration — one bad row never sinks the batch', () => {
  it('drops a malformed row, names it, and still hydrates the good rows', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const good = { catalogId: 'bestiary', entityId: 'persisted-ok', source: 'intake', entity: { name: 'Ok', categoryPath: [], tags: [], lifecycle: 'planned' } };
    const entities = [null, { catalogId: 'bestiary' }, good];
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ success: true, data: { entities } }) }) as unknown as Response));
    useCatalogStore.setState({ draftEntitiesByCatalog: {} });
    renderHook(() => usePersistedEntityHydration());
    await waitFor(() => expect(useCatalogStore.getState().draftEntitiesByCatalog.bestiary?.['persisted-ok']).toBeDefined());
    expect(warn.mock.calls.some(([m]) => /2 malformed row/.test(String(m)))).toBe(true);
  });
});
