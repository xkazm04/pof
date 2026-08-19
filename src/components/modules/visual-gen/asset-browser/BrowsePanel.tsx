'use client';

import { useCallback } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { useAssetBrowserStore } from './useAssetBrowserStore';
import { useAssetLibraryStore } from './useAssetLibraryStore';
import { AssetCard } from './AssetCard';
import { InlineErrorRetry } from '@/components/modules/shared/InlineErrorRetry';
import { VISUAL_GEN_FOCUS_RING } from '@/lib/visual-gen/ui';
import type { AssetSearchResult, AssetSource, AssetCategory } from '@/lib/visual-gen/asset-sources';

/**
 * Only sources `/api/visual-gen/browse` can actually serve. Sketchfab used to sit here as a
 * third chip with no implementation on this route (it answered `400 Unknown source`) — the
 * panel dodged the error by routing that one source to the Blender MCP bridge instead, which
 * returned a differently-shaped envelope and silently rendered nothing. Sketchfab is also not
 * CC0, which this browser's `license: 'CC0'` result type asserts of everything it returns.
 * The real Sketchfab surface is the Blender pipeline's own AssetBrowser
 * (`visual-gen/blender-pipeline/AssetBrowser.tsx` over `/api/blender-mcp/assets`).
 */
const SOURCES: { value: AssetSource; label: string }[] = [
  { value: 'polyhaven', label: 'Poly Haven' },
  { value: 'ambientcg', label: 'ambientCG' },
];

const CATEGORIES: { value: AssetCategory; label: string; sources: AssetSource[] }[] = [
  { value: 'textures', label: 'Textures', sources: ['polyhaven'] },
  { value: 'hdris', label: 'HDRIs', sources: ['polyhaven'] },
  { value: 'models', label: '3D Models', sources: ['polyhaven'] },
  { value: 'materials', label: 'PBR Materials', sources: ['ambientcg'] },
];

export function BrowsePanel() {
  const query = useAssetBrowserStore((s) => s.query);
  const activeSource = useAssetBrowserStore((s) => s.activeSource);
  const activeCategory = useAssetBrowserStore((s) => s.activeCategory);
  const results = useAssetBrowserStore((s) => s.results);
  const isSearching = useAssetBrowserStore((s) => s.isSearching);
  const error = useAssetBrowserStore((s) => s.error);
  const hasSearched = useAssetBrowserStore((s) => s.hasSearched);
  const importError = useAssetBrowserStore((s) => s.importError);
  const setQuery = useAssetBrowserStore((s) => s.setQuery);
  const setActiveSource = useAssetBrowserStore((s) => s.setActiveSource);
  const setActiveCategory = useAssetBrowserStore((s) => s.setActiveCategory);
  const search = useAssetBrowserStore((s) => s.search);
  const importToBlender = useAssetBrowserStore((s) => s.importToBlender);
  const clearImportError = useAssetBrowserStore((s) => s.clearImportError);
  const recordDownload = useAssetLibraryStore((s) => s.recordDownload);

  const handleSearch = useCallback(() => { void search(); }, [search]);

  const handleDownload = useCallback((asset: AssetSearchResult) => {
    // Track every download in the local library (source/category/license/tags +
    // thumbnail), then open the download URL. Recording is fire-and-forget so a
    // persistence hiccup never blocks the actual download.
    void recordDownload(asset);
    if (asset.downloadUrl) {
      window.open(asset.downloadUrl, '_blank');
    }
  }, [recordDownload]);

  const handleRetryImport = useCallback(() => {
    if (importError) void importToBlender(importError.source, importError.assetId);
  }, [importError, importToBlender]);

  const availableCategories = CATEGORIES.filter((c) => c.sources.includes(activeSource));

  return (
    <div className="space-y-4">
      {/* Source selector */}
      <div className="flex gap-2">
        {SOURCES.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setActiveSource(value)}
            aria-pressed={activeSource === value}
            className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors border ${VISUAL_GEN_FOCUS_RING} ${
              activeSource === value
                ? 'border-[var(--visual-gen)] bg-[var(--visual-gen)]/10 text-[var(--visual-gen)]'
                : 'border-border text-text-muted hover:text-text'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Category tabs */}
      <div className="flex gap-1.5">
        {availableCategories.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setActiveCategory(value)}
            aria-pressed={activeCategory === value}
            className={`px-2.5 py-1 rounded text-xs transition-colors ${VISUAL_GEN_FOCUS_RING} ${
              activeCategory === value
                ? 'bg-[var(--visual-gen)] text-white'
                : 'text-text-muted hover:text-text border border-border'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search free assets..."
          aria-label="Search free assets"
          className="flex-1 bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-[var(--visual-gen)]"
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <button
          onClick={handleSearch}
          disabled={isSearching}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium
                     bg-[var(--visual-gen)] text-white hover:brightness-110 transition-all
                     disabled:opacity-50"
        >
          {isSearching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          Search
        </button>
      </div>

      {/* A failed search states its reason and offers a retry — it never falls through to
          the empty state, which now means EMPTY and nothing else. */}
      {error && <InlineErrorRetry message={`Search failed — ${error}`} onRetry={handleSearch} />}

      {importError && (
        <InlineErrorRetry
          message={`Blender import failed — ${importError.message}`}
          onRetry={handleRetryImport}
          onDismiss={clearImportError}
          dense
        />
      )}

      {/* Results grid */}
      {results.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {results.map((asset) => (
            <AssetCard key={asset.id} asset={asset} onDownload={handleDownload} />
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <p className="text-xs text-text-muted">
            {isSearching
              ? 'Searching...'
              : error
                ? 'No results — the search above did not complete.'
                : hasSearched
                  ? `No CC0 assets matched${query.trim() ? ` "${query.trim()}"` : ''} on this source.`
                  : 'Click Search to browse free CC0 assets.'}
          </p>
        </div>
      )}
    </div>
  );
}
