import { create } from 'zustand';
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
  downloads: DownloadItem[];

  setQuery: (query: string) => void;
  setActiveSource: (source: AssetSource) => void;
  setActiveCategory: (category: AssetCategory) => void;
  setResults: (results: AssetSearchResult[]) => void;
  setSearching: (searching: boolean) => void;
  addDownload: (assetId: string, name: string) => void;
  updateDownload: (assetId: string, updates: Partial<DownloadItem>) => void;
  removeDownload: (assetId: string) => void;
}

export const useAssetBrowserStore = create<AssetBrowserState>((set) => ({
  query: '',
  activeSource: 'polyhaven',
  activeCategory: 'textures',
  results: [],
  isSearching: false,
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
}));
