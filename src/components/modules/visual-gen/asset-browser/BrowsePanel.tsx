'use client';

import { useCallback } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { useAssetBrowserStore } from './useAssetBrowserStore';
import { AssetCard } from './AssetCard';
import type { AssetSearchResult, AssetSource, AssetCategory } from '@/lib/visual-gen/asset-sources';

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
  const setQuery = useAssetBrowserStore((s) => s.setQuery);
  const setActiveSource = useAssetBrowserStore((s) => s.setActiveSource);
  const setActiveCategory = useAssetBrowserStore((s) => s.setActiveCategory);
  const setResults = useAssetBrowserStore((s) => s.setResults);
  const setSearching = useAssetBrowserStore((s) => s.setSearching);

  const handleSearch = useCallback(async () => {
    setSearching(true);
    try {
      const params = new URLSearchParams({
        source: activeSource,
        category: activeCategory,
      });
      if (query.trim()) params.set('q', query.trim());

      const res = await fetch(`/api/visual-gen/browse?${params}`);
      const json = await res.json();
      if (json.success) {
        setResults(json.data ?? []);
      }
    } catch {
      // Silent fail
    } finally {
      setSearching(false);
    }
  }, [activeSource, activeCategory, query, setResults, setSearching]);

  const handleDownload = useCallback((asset: AssetSearchResult) => {
    // For now, open download URL in new tab
    if (asset.downloadUrl) {
      window.open(asset.downloadUrl, '_blank');
    }
  }, []);

  const availableCategories = CATEGORIES.filter((c) => c.sources.includes(activeSource));

  return (
    <div className="space-y-4">
      {/* Source selector */}
      <div className="flex gap-2">
        {SOURCES.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setActiveSource(value)}
            className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors border ${
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
            className={`px-2.5 py-1 rounded text-xs transition-colors ${
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
            {isSearching ? 'Searching...' : 'Click Search to browse free CC0 assets.'}
          </p>
        </div>
      )}
    </div>
  );
}
