import { create } from 'zustand';
import { tryApiFetch } from '@/lib/api-utils';
import { logger } from '@/lib/logger';
import { downloadBlob } from '@/lib/download';
import { ok, err, type Result } from '@/types/result';
import { flattenGltfUris, gltfIncludeMap, type DownloadVariant } from '@/lib/visual-gen/download-variants';
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

/** What the variant picker is opened for: a search row, or a library row being re-acquired. */
export interface PickTarget {
  id: string;
  name: string;
  source: AssetSource;
  category: AssetCategory;
  license: string;
  thumbnailUrl: string;
  tags?: string[];
  /** Present when the search row already carries them (ambientCG) — then no fetch is made. */
  variants?: DownloadVariant[];
}

export type VariantList =
  | { status: 'loading' }
  | { status: 'ready'; variants: DownloadVariant[] }
  | { status: 'error'; error: string };

/** Progress of a multi-file save (a glTF bundle or a map set), or null. */
export interface VariantSave {
  variantId: string;
  done: number;
  total: number;
}

export const variantKey = (t: Pick<PickTarget, 'source' | 'id' | 'category'>) => `${t.source}:${t.id}:${t.category}`;

/**
 * Hand one URL to the browser as a download. No fetch: the browser streams it to disk, so a
 * 1 GB ambientCG zip is never held in page memory.
 */
function downloadDirect(url: string, filename: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener noreferrer';
  a.target = '_blank';
  a.click();
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
  /** Each asset's download variants, keyed by {@link variantKey}; loaded once, on picker open. */
  variantLists: Record<string, VariantList>;
  saving: VariantSave | null;

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
  /** List the target's variants (one `/browse/files` call for Poly Haven; none for ambientCG). */
  loadVariants: (target: PickTarget, force?: boolean) => Promise<void>;
  /** Save the variant's files: a single file direct, a multi-file set fetched one file at a time. */
  saveVariant: (variant: DownloadVariant) => Promise<Result<void, string>>;
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
  variantLists: {},
  saving: null,

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

  loadVariants: async (target, force = false) => {
    const key = variantKey(target);
    const setList = (list: VariantList) => set((s) => ({ variantLists: { ...s.variantLists, [key]: list } }));
    if (target.variants) { setList({ status: 'ready', variants: target.variants }); return; }
    const current = get().variantLists[key];
    if (!force && current && current.status !== 'error') return;
    if (target.source !== 'polyhaven') {
      setList({ status: 'error', error: `${target.source} lists its files on the search row — search it again to choose a file.` });
      return;
    }
    setList({ status: 'loading' });
    const params = new URLSearchParams({ source: target.source, id: target.id, category: target.category });
    const result = await tryApiFetch<{ variants: DownloadVariant[] }>(`/api/visual-gen/browse/files?${params}`);
    if (result.ok) setList({ status: 'ready', variants: result.data.variants });
    else {
      logger.error('[AssetBrowser] listing files failed:', target.source, target.id, result.error);
      setList({ status: 'error', error: result.error });
    }
  },

  saveVariant: async (variant) => {
    if (variant.files.length === 1) {
      downloadDirect(variant.files[0].url, variant.files[0].path);
      return ok(undefined);
    }
    // A bundle is saved flat, one file at a time, so page memory holds at most one file.
    const include = gltfIncludeMap(variant);
    set({ saving: { variantId: variant.id, done: 0, total: variant.files.length } });
    try {
      for (const [i, file] of variant.files.entries()) {
        const res = await fetch(file.url);
        if (!res.ok) return err(`${file.path}: HTTP ${res.status}`);
        const blob = file.path.endsWith('.gltf')
          ? new Blob([JSON.stringify(flattenGltfUris(JSON.parse(await res.text()), include))], { type: 'model/gltf+json' })
          : await res.blob();
        downloadBlob(blob, file.path);
        set({ saving: { variantId: variant.id, done: i + 1, total: variant.files.length } });
      }
      return ok(undefined);
    } catch (e) {
      return err(e instanceof Error ? e.message : String(e));
    } finally {
      set({ saving: null });
    }
  },
}));
