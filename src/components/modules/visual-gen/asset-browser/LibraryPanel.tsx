'use client';

import { useEffect, useMemo } from 'react';
import { Search, Library as LibraryIcon } from 'lucide-react';
import { useAssetLibraryStore } from '@/components/modules/visual-gen/asset-browser/useAssetLibraryStore';
import { LibraryAssetCard } from '@/components/modules/visual-gen/asset-browser/LibraryAssetCard';
import { CollectionSidebar } from '@/components/modules/visual-gen/asset-browser/CollectionSidebar';
import { filterLibraryAssets } from '@/lib/visual-gen/library-filter';
import { VISUAL_GEN_FOCUS_RING } from '@/lib/visual-gen/ui';
import type { AssetSource, AssetCategory } from '@/types/asset-library';

const SOURCES: { value: AssetSource | 'all'; label: string }[] = [
  { value: 'all', label: 'All sources' },
  { value: 'polyhaven', label: 'Poly Haven' },
  { value: 'ambientcg', label: 'ambientCG' },
  { value: 'sketchfab', label: 'Sketchfab' },
];

const CATEGORIES: { value: AssetCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'All types' },
  { value: 'textures', label: 'Textures' },
  { value: 'hdris', label: 'HDRIs' },
  { value: 'models', label: 'Models' },
  { value: 'materials', label: 'Materials' },
];

export function LibraryPanel() {
  const assets = useAssetLibraryStore((s) => s.assets);
  const collections = useAssetLibraryStore((s) => s.collections);
  const filter = useAssetLibraryStore((s) => s.filter);
  const setFilter = useAssetLibraryStore((s) => s.setFilter);
  const loaded = useAssetLibraryStore((s) => s.loaded);
  const isLoading = useAssetLibraryStore((s) => s.isLoading);
  const loadLibrary = useAssetLibraryStore((s) => s.loadLibrary);

  useEffect(() => {
    if (!loaded) loadLibrary();
  }, [loaded, loadLibrary]);

  const filtered = useMemo(() => filterLibraryAssets(assets, filter), [assets, filter]);
  const favoriteCount = useMemo(() => assets.filter((a) => a.favorite).length, [assets]);

  const chipClass = (active: boolean) =>
    `px-2.5 py-1 rounded text-xs transition-colors ${VISUAL_GEN_FOCUS_RING} ${
      active ? 'bg-[var(--visual-gen)] text-white' : 'text-text-muted hover:text-text border border-border'
    }`;

  return (
    <div className="flex gap-4">
      <CollectionSidebar collections={collections} totalCount={assets.length} favoriteCount={favoriteCount} />

      <div className="flex-1 min-w-0 space-y-3">
        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={filter.query ?? ''}
            onChange={(e) => setFilter({ query: e.target.value })}
            placeholder="Search your library by name or tag..."
            aria-label="Search library"
            className="w-full bg-surface border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-[var(--visual-gen)]"
          />
        </div>

        {/* Filter chips */}
        <div className="flex flex-wrap gap-1.5">
          {SOURCES.map(({ value, label }) => (
            <button key={value} onClick={() => setFilter({ source: value })} aria-pressed={filter.source === value} className={chipClass(filter.source === value)}>
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map(({ value, label }) => (
            <button key={value} onClick={() => setFilter({ category: value })} aria-pressed={filter.category === value} className={chipClass(filter.category === value)}>
              {label}
            </button>
          ))}
        </div>

        {/* Grid */}
        {filtered.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {filtered.map((asset) => (
              <LibraryAssetCard key={asset.id} asset={asset} collections={collections} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <LibraryIcon size={28} className="mx-auto text-text-muted mb-2 opacity-50" />
            <p className="text-xs text-text-muted">
              {isLoading && !loaded
                ? 'Loading library...'
                : assets.length === 0
                  ? 'Your library is empty. Download assets from the Browse tab to track them here.'
                  : 'No assets match your filters.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
