import { create } from 'zustand';
import { tryApiFetch } from '@/lib/api-utils';
import type { AssetSearchResult } from '@/lib/visual-gen/asset-sources';
import type { LibraryAsset, Collection, LibraryFilter } from '@/types/asset-library';

const LIBRARY_URL = '/api/visual-gen/library';
const COLLECTIONS_URL = '/api/visual-gen/library/collections';

interface AssetLibraryState {
  assets: LibraryAsset[];
  collections: Collection[];
  filter: LibraryFilter;
  loaded: boolean;
  isLoading: boolean;
  error: string | null;

  setFilter: (partial: Partial<LibraryFilter>) => void;
  loadLibrary: () => Promise<void>;
  /** Persist a freshly-downloaded asset to the library (upsert) and cache it. */
  recordDownload: (asset: AssetSearchResult) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  removeAsset: (id: string) => Promise<void>;
  createCollection: (name: string) => Promise<Collection | null>;
  renameCollection: (id: string, name: string) => Promise<void>;
  deleteCollection: (id: string) => Promise<void>;
  addToCollection: (collectionId: string, assetId: string) => Promise<void>;
  removeFromCollection: (collectionId: string, assetId: string) => Promise<void>;
}

/** Replace an asset in the list by id, or prepend it if it's new. */
function upsertAsset(assets: LibraryAsset[], next: LibraryAsset): LibraryAsset[] {
  const idx = assets.findIndex((a) => a.id === next.id);
  if (idx === -1) return [next, ...assets];
  const copy = assets.slice();
  copy[idx] = next;
  return copy;
}

export const useAssetLibraryStore = create<AssetLibraryState>((set, get) => ({
  assets: [],
  collections: [],
  filter: { source: 'all', category: 'all', favoritesOnly: false, collectionId: null, query: '' },
  loaded: false,
  isLoading: false,
  error: null,

  setFilter: (partial) => set((s) => ({ filter: { ...s.filter, ...partial } })),

  loadLibrary: async () => {
    set({ isLoading: true, error: null });
    const [assetsRes, collectionsRes] = await Promise.all([
      tryApiFetch<LibraryAsset[]>(LIBRARY_URL),
      tryApiFetch<Collection[]>(COLLECTIONS_URL),
    ]);
    if (!assetsRes.ok) {
      set({ isLoading: false, error: assetsRes.error });
      return;
    }
    set({
      assets: assetsRes.data,
      collections: collectionsRes.ok ? collectionsRes.data : [],
      loaded: true,
      isLoading: false,
    });
  },

  recordDownload: async (asset) => {
    const res = await tryApiFetch<LibraryAsset>(LIBRARY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assetId: asset.id,
        name: asset.name,
        source: asset.source,
        category: asset.category,
        license: asset.license,
        thumbnailUrl: asset.thumbnailUrl,
        downloadUrl: asset.downloadUrl,
        tags: asset.tags ?? [],
      }),
    });
    if (res.ok) set((s) => ({ assets: upsertAsset(s.assets, res.data) }));
  },

  toggleFavorite: async (id) => {
    const current = get().assets.find((a) => a.id === id);
    if (!current) return;
    const res = await tryApiFetch<LibraryAsset>(`${LIBRARY_URL}/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ favorite: !current.favorite }),
    });
    if (res.ok) set((s) => ({ assets: upsertAsset(s.assets, res.data) }));
  },

  removeAsset: async (id) => {
    const res = await tryApiFetch<{ deleted: string }>(`${LIBRARY_URL}/${id}`, { method: 'DELETE' });
    if (res.ok) set((s) => ({ assets: s.assets.filter((a) => a.id !== id) }));
  },

  createCollection: async (name) => {
    const res = await tryApiFetch<Collection>(COLLECTIONS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) return null;
    set((s) => ({ collections: [res.data, ...s.collections] }));
    return res.data;
  },

  renameCollection: async (id, name) => {
    const res = await tryApiFetch<Collection>(`${COLLECTIONS_URL}/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      set((s) => ({ collections: s.collections.map((c) => (c.id === id ? res.data : c)) }));
    }
  },

  deleteCollection: async (id) => {
    const res = await tryApiFetch<{ deleted: string }>(`${COLLECTIONS_URL}/${id}`, { method: 'DELETE' });
    if (res.ok) {
      set((s) => ({
        collections: s.collections.filter((c) => c.id !== id),
        // Drop the membership locally and clear the filter if it pointed here.
        assets: s.assets.map((a) =>
          a.collectionIds.includes(id)
            ? { ...a, collectionIds: a.collectionIds.filter((cid) => cid !== id) }
            : a,
        ),
        filter: s.filter.collectionId === id ? { ...s.filter, collectionId: null } : s.filter,
      }));
    }
  },

  addToCollection: async (collectionId, assetId) => {
    const res = await tryApiFetch<{ added: boolean }>(`${COLLECTIONS_URL}/${collectionId}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assetId }),
    });
    if (res.ok && res.data.added) {
      set((s) => ({
        assets: s.assets.map((a) =>
          a.id === assetId && !a.collectionIds.includes(collectionId)
            ? { ...a, collectionIds: [...a.collectionIds, collectionId] }
            : a,
        ),
        collections: s.collections.map((c) =>
          c.id === collectionId ? { ...c, assetCount: c.assetCount + 1 } : c,
        ),
      }));
    }
  },

  removeFromCollection: async (collectionId, assetId) => {
    const res = await tryApiFetch<{ removed: boolean }>(
      `${COLLECTIONS_URL}/${collectionId}/items?assetId=${encodeURIComponent(assetId)}`,
      { method: 'DELETE' },
    );
    if (res.ok && res.data.removed) {
      set((s) => ({
        assets: s.assets.map((a) =>
          a.id === assetId
            ? { ...a, collectionIds: a.collectionIds.filter((cid) => cid !== collectionId) }
            : a,
        ),
        collections: s.collections.map((c) =>
          c.id === collectionId ? { ...c, assetCount: Math.max(0, c.assetCount - 1) } : c,
        ),
      }));
    }
  },
}));
