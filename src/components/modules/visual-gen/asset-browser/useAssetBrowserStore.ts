import { create } from 'zustand';
import { tryApiFetch } from '@/lib/api-utils';
import { logger } from '@/lib/logger';
import type { AssetSearchResult, AssetSource, AssetCategory } from '@/lib/visual-gen/asset-sources';

export type DownloadStatus = 'idle' | 'downloading' | 'completed' | 'failed';

export interface DownloadItem {
  assetId: string;
  name: string;
  status: DownloadStatus;
  progress: number;
}

/** A failed Blender import, kept with the asset id so the banner can retry THAT asset. */
export interface ImportFailure {
  assetId: string;
  source: AssetSource;
  message: string;
}

interface AssetBrowserState {
  query: string;
  activeSource: AssetSource;
  activeCategory: AssetCategory;
  results: AssetSearchResult[];
  isSearching: boolean;
  isImporting: string | null;
  downloads: DownloadItem[];
  /**
   * Why the last search failed, or null. An empty `results` used to mean three different
   * things at once — never searched, found nothing, and the request blew up — and the panel
   * rendered the same "Click Search" line for all three.
   */
  error: string | null;
  /** Has a search actually completed for the current source/category? Separates "empty" from "not yet". */
  hasSearched: boolean;
  /** Why the last Blender import failed, or null. */
  importError: ImportFailure | null;

  setQuery: (query: string) => void;
  setActiveSource: (source: AssetSource) => void;
  setActiveCategory: (category: AssetCategory) => void;
  setResults: (results: AssetSearchResult[]) => void;
  setSearching: (searching: boolean) => void;
  setError: (error: string | null) => void;
  clearImportError: () => void;
  addDownload: (assetId: string, name: string) => void;
  updateDownload: (assetId: string, updates: Partial<DownloadItem>) => void;
  removeDownload: (assetId: string) => void;
  search: () => Promise<void>;
  importToBlender: (source: AssetSource, id: string) => Promise<void>;
}

export const useAssetBrowserStore = create<AssetBrowserState>((set, get) => ({
  query: '',
  activeSource: 'polyhaven',
  activeCategory: 'textures',
  results: [],
  isSearching: false,
  isImporting: null,
  downloads: [],
  error: null,
  hasSearched: false,
  importError: null,

  setQuery: (query) => set({ query }),
  // Switching source/category invalidates the last result set AND the fact that a search
  // ran — otherwise a stale "No assets matched" would describe a search of a different feed.
  setActiveSource: (source) => set({ activeSource: source, results: [], hasSearched: false, error: null }),
  setActiveCategory: (category) => set({ activeCategory: category, results: [], hasSearched: false, error: null }),
  setResults: (results) => set({ results, hasSearched: true, error: null }),
  setSearching: (searching) => set({ isSearching: searching }),
  setError: (error) => set({ error }),
  clearImportError: () => set({ importError: null }),

  addDownload: (assetId, name) =>
    set((s) => ({
      downloads: [...s.downloads, { assetId, name, status: 'downloading', progress: 0 }],
    })),

  updateDownload: (assetId, updates) =>
    set((s) => ({
      downloads: s.downloads.map((d) =>
        d.assetId === assetId ? { ...d, ...updates } : d,
      ),
    })),

  removeDownload: (assetId) =>
    set((s) => ({
      downloads: s.downloads.filter((d) => d.assetId !== assetId),
    })),

  /**
   * Search the current source/category. A failure NEVER lands as an empty result set: the
   * reason is kept in `error` so the panel can render it with a retry, and `hasSearched`
   * stays false so the empty state can never be mistaken for "we found nothing".
   */
  search: async () => {
    const { activeSource, activeCategory, query } = get();
    set({ isSearching: true, error: null });
    try {
      const params = new URLSearchParams({ source: activeSource, category: activeCategory });
      const q = query.trim();
      if (q) params.set('q', q);

      const result = await tryApiFetch<AssetSearchResult[]>(`/api/visual-gen/browse?${params}`);
      if (result.ok) {
        set({ results: result.data ?? [], hasSearched: true, error: null });
      } else {
        logger.error('[AssetBrowser] search failed:', activeSource, activeCategory, result.error);
        set({ results: [], hasSearched: false, error: result.error });
      }
    } finally {
      set({ isSearching: false });
    }
  },

  /** Import into the live Blender session. A failure is reported, not swallowed. */
  importToBlender: async (source: AssetSource, id: string) => {
    set({ isImporting: id, importError: null });
    try {
      const result = await tryApiFetch<{ success: boolean }>('/api/blender-mcp/assets/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source, id }),
      });
      if (!result.ok) {
        logger.error('[AssetBrowser] Blender import failed:', source, id, result.error);
        set({ importError: { assetId: id, source, message: result.error } });
      }
    } finally {
      set({ isImporting: null });
    }
  },
}));
