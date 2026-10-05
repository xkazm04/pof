import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAssetLibraryStore } from '@/components/modules/visual-gen/asset-browser/useAssetLibraryStore';
import type { LibraryAsset, Collection } from '@/types/asset-library';

vi.mock('@/lib/api-utils', () => ({
  tryApiFetch: vi.fn(),
}));

import { tryApiFetch } from '@/lib/api-utils';

function makeAsset(overrides: Partial<LibraryAsset> = {}): LibraryAsset {
  return {
    id: 'asset-1',
    name: 'Brick Wall',
    source: 'polyhaven',
    category: 'textures',
    license: 'CC0',
    thumbnailUrl: '',
    downloadUrl: '',
    tags: [],
    favorite: false,
    collectionIds: [],
    ...overrides,
  } as LibraryAsset;
}

function makeCollection(overrides: Partial<Collection> = {}): Collection {
  return { id: 'col-1', name: 'My Collection', assetCount: 1, ...overrides } as Collection;
}

describe('useAssetLibraryStore.removeAsset', () => {
  beforeEach(() => {
    vi.mocked(tryApiFetch).mockReset();
    useAssetLibraryStore.setState({
      assets: [],
      collections: [],
      filter: { source: 'all', category: 'all', favoritesOnly: false, collectionId: null, query: '' },
      loaded: false,
      isLoading: false,
      error: null,
    });
  });

  it('decrements every collection the deleted asset belonged to', async () => {
    const asset = makeAsset({ collectionIds: ['col-1', 'col-2'] });
    useAssetLibraryStore.setState({
      assets: [asset],
      collections: [makeCollection({ id: 'col-1', assetCount: 1 }), makeCollection({ id: 'col-2', assetCount: 3 })],
    });
    vi.mocked(tryApiFetch).mockResolvedValue({ ok: true, data: { deleted: asset.id } });

    await useAssetLibraryStore.getState().removeAsset(asset.id);

    const state = useAssetLibraryStore.getState();
    expect(state.assets).toHaveLength(0);
    expect(state.collections.find((c) => c.id === 'col-1')?.assetCount).toBe(0);
    expect(state.collections.find((c) => c.id === 'col-2')?.assetCount).toBe(2);
  });

  it('never drops a collection count below zero', async () => {
    const asset = makeAsset({ collectionIds: ['col-1'] });
    useAssetLibraryStore.setState({
      assets: [asset],
      collections: [makeCollection({ id: 'col-1', assetCount: 0 })],
    });
    vi.mocked(tryApiFetch).mockResolvedValue({ ok: true, data: { deleted: asset.id } });

    await useAssetLibraryStore.getState().removeAsset(asset.id);

    expect(useAssetLibraryStore.getState().collections[0].assetCount).toBe(0);
  });

  it('leaves unrelated collections untouched', async () => {
    const asset = makeAsset({ collectionIds: ['col-1'] });
    useAssetLibraryStore.setState({
      assets: [asset],
      collections: [makeCollection({ id: 'col-1', assetCount: 1 }), makeCollection({ id: 'col-2', assetCount: 5 })],
    });
    vi.mocked(tryApiFetch).mockResolvedValue({ ok: true, data: { deleted: asset.id } });

    await useAssetLibraryStore.getState().removeAsset(asset.id);

    expect(useAssetLibraryStore.getState().collections.find((c) => c.id === 'col-2')?.assetCount).toBe(5);
  });

  it('does not touch collections when the DELETE fails', async () => {
    const asset = makeAsset({ collectionIds: ['col-1'] });
    useAssetLibraryStore.setState({
      assets: [asset],
      collections: [makeCollection({ id: 'col-1', assetCount: 1 })],
    });
    vi.mocked(tryApiFetch).mockResolvedValue({ ok: false, error: 'server error' });

    await useAssetLibraryStore.getState().removeAsset(asset.id);

    const state = useAssetLibraryStore.getState();
    expect(state.assets).toHaveLength(1);
    expect(state.collections[0].assetCount).toBe(1);
  });
});
