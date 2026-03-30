import { create } from 'zustand';
import { tryApiFetch } from '@/lib/api-utils';
import type { AssetSearchResult, AssetSource, AssetCategory } from '@/lib/visual-gen/asset-sources';

export type DownloadStatus = 'idle' | 'downloading' | 'completed' | 'failed';

export interface DownloadItem {
  assetId: string;
  name: string;
  status: DownloadStatus;
  progress: number;
}

interface AssetBrowserState {
  query: string;
  activeSource: AssetSource;
  activeCategory: AssetCategory;
  results: AssetSearchResult[];
  isSearching: boolean;
  isImporting: string | null;
  downloads: DownloadItem[];

  setQuery: (query: string) => void;
  setActiveSource: (source: AssetSource) => void;
  setActiveCategory: (category: AssetCategory) => void;
  setResults: (results: AssetSearchResult[]) => void;
  setSearching: (searching: boolean) => void;
  addDownload: (assetId: string, name: string) => void;
  updateDownload: (assetId: string, updates: Partial<DownloadItem>) => void;
  removeDownload: (assetId: string) => void;
  searchSketchfab: (query: string) => Promise<void>;
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

  setQuery: (query) => set({ query }),
  setActiveSource: (source) => set({ activeSource: source, results: [] }),
  setActiveCategory: (category) => set({ activeCategory: category, results: [] }),
  setResults: (results) => set({ results }),
  setSearching: (searching) => set({ isSearching: searching }),

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

  searchSketchfab: async (query: string) => {
    set({ isSearching: true });
    try {
      const params = new URLSearchParams({ source: 'sketchfab', query });
      const result = await tryApiFetch<AssetSearchResult[]>(
        `/api/blender-mcp/assets?${params}`,
      );
      if (result.ok) {
        set({ results: result.data });
      }
    } finally {
      set({ isSearching: false });
    }
  },

  importToBlender: async (source: AssetSource, id: string) => {
    set({ isImporting: id });
    try {
      await tryApiFetch<{ success: boolean }>('/api/blender-mcp/assets/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source, id }),
      });
    } finally {
      set({ isImporting: null });
    }
  },
}));
