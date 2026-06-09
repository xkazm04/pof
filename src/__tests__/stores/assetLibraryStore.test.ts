import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAssetLibraryStore } from '@/components/modules/visual-gen/asset-browser/useAssetLibraryStore';
import type { LibraryAsset, Collection } from '@/types/asset-library';
import type { AssetSearchResult } from '@/lib/visual-gen/asset-sources';

function libAsset(over: Partial<LibraryAsset> = {}): LibraryAsset {
  return {
    id: 'lib-1',
    assetId: 'src-1',
    name: 'Wood',
    source: 'polyhaven',
    category: 'textures',
    license: 'CC0',
    thumbnailUrl: 't',
    downloadUrl: 'd',
    tags: ['wood'],
    favorite: false,
    collectionIds: [],
    createdAt: 1,
    ...over,
  };
}

/** Method-aware fetch mock: keyed on `${METHOD} ${pathPrefix}`. */
function installFetch(handlers: Array<{ method: string; match: RegExp; data: unknown; ok?: boolean }>) {
  const mock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    const method = (init?.method ?? 'GET').toUpperCase();
    const h = handlers.find((x) => x.method === method && x.match.test(url));
    const ok = h?.ok ?? true;
    return Promise.resolve({
      ok,
      status: ok ? 200 : 500,
      json: () => Promise.resolve(h ? { success: ok, data: h.data, error: ok ? undefined : 'err' } : { success: false, error: 'no route' }),
    });
  });
  globalThis.fetch = mock as unknown as typeof fetch;
  return mock;
}

beforeEach(() => {
  useAssetLibraryStore.setState({
    assets: [],
    collections: [],
    filter: { source: 'all', category: 'all', favoritesOnly: false, collectionId: null, query: '' },
    loaded: false,
    isLoading: false,
    error: null,
  });
});

describe('useAssetLibraryStore', () => {
  it('loadLibrary populates assets and collections', async () => {
    const collection: Collection = { id: 'c1', name: 'Faves', assetCount: 0, createdAt: 1 };
    installFetch([
      { method: 'GET', match: /\/library\/collections$/, data: [collection] },
      { method: 'GET', match: /\/library$/, data: [libAsset()] },
    ]);

    await useAssetLibraryStore.getState().loadLibrary();

    const s = useAssetLibraryStore.getState();
    expect(s.loaded).toBe(true);
    expect(s.assets).toHaveLength(1);
    expect(s.collections).toEqual([collection]);
  });

  it('recordDownload posts and upserts the returned asset (no duplicate)', async () => {
    const search: AssetSearchResult = {
      id: 'src-1', name: 'Wood', source: 'polyhaven', category: 'textures',
      thumbnailUrl: 't', downloadUrl: 'd', license: 'CC0', tags: ['wood'],
    };
    const mock = installFetch([{ method: 'POST', match: /\/library$/, data: libAsset() }]);

    await useAssetLibraryStore.getState().recordDownload(search);
    await useAssetLibraryStore.getState().recordDownload(search);

    expect(useAssetLibraryStore.getState().assets).toHaveLength(1);
    expect(mock).toHaveBeenCalledTimes(2);
    const [, init] = mock.mock.calls[0];
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body).assetId).toBe('src-1');
  });

  it('toggleFavorite flips the flag from the server response', async () => {
    useAssetLibraryStore.setState({ assets: [libAsset({ favorite: false })] });
    installFetch([{ method: 'PATCH', match: /\/library\/lib-1$/, data: libAsset({ favorite: true }) }]);

    await useAssetLibraryStore.getState().toggleFavorite('lib-1');
    expect(useAssetLibraryStore.getState().assets[0].favorite).toBe(true);
  });

  it('removeAsset drops it from the cache', async () => {
    useAssetLibraryStore.setState({ assets: [libAsset()] });
    installFetch([{ method: 'DELETE', match: /\/library\/lib-1$/, data: { deleted: 'lib-1' } }]);

    await useAssetLibraryStore.getState().removeAsset('lib-1');
    expect(useAssetLibraryStore.getState().assets).toHaveLength(0);
  });

  it('add/remove collection membership updates assets and counts', async () => {
    useAssetLibraryStore.setState({
      assets: [libAsset()],
      collections: [{ id: 'c1', name: 'Faves', assetCount: 0, createdAt: 1 }],
    });
    installFetch([
      { method: 'POST', match: /\/collections\/c1\/items$/, data: { added: true } },
      { method: 'DELETE', match: /\/collections\/c1\/items/, data: { removed: true } },
    ]);

    await useAssetLibraryStore.getState().addToCollection('c1', 'lib-1');
    expect(useAssetLibraryStore.getState().assets[0].collectionIds).toEqual(['c1']);
    expect(useAssetLibraryStore.getState().collections[0].assetCount).toBe(1);

    await useAssetLibraryStore.getState().removeFromCollection('c1', 'lib-1');
    expect(useAssetLibraryStore.getState().assets[0].collectionIds).toEqual([]);
    expect(useAssetLibraryStore.getState().collections[0].assetCount).toBe(0);
  });

  it('deleteCollection removes it and clears membership locally', async () => {
    useAssetLibraryStore.setState({
      assets: [libAsset({ collectionIds: ['c1'] })],
      collections: [{ id: 'c1', name: 'Faves', assetCount: 1, createdAt: 1 }],
      filter: { source: 'all', category: 'all', favoritesOnly: false, collectionId: 'c1', query: '' },
    });
    installFetch([{ method: 'DELETE', match: /\/collections\/c1$/, data: { deleted: 'c1' } }]);

    await useAssetLibraryStore.getState().deleteCollection('c1');
    const s = useAssetLibraryStore.getState();
    expect(s.collections).toHaveLength(0);
    expect(s.assets[0].collectionIds).toEqual([]);
    expect(s.filter.collectionId).toBeNull();
  });
});
