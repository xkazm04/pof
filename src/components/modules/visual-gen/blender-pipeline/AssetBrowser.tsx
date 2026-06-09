'use client';

import { Search, Loader2, Boxes, AlertTriangle } from 'lucide-react';
import { TabHeader } from '@/components/modules/shared/TabHeader';
import { BlenderConnectionBar } from '@/components/blender-mcp/BlenderConnectionBar';
import { ViewportPreview } from '@/components/blender-mcp/ViewportPreview';
import { McpErrorBanner } from '@/components/blender-mcp/McpErrorBanner';
import { useBlenderMCPStore } from '@/stores/blenderMCPStore';
import { WARNING_TEXT } from '@/lib/blender-mcp/status-tokens';
import {
  POLYHAVEN_CATEGORIES,
  POLYHAVEN_RESOLUTIONS,
  assetKey,
} from '@/lib/blender-mcp/assetBrowser';
import { AssetCard } from './AssetCard';
import { useAssetBrowser } from './useAssetBrowser';

export function AssetBrowser() {
  const connected = useBlenderMCPStore((s) => s.connection.connected);
  const b = useAssetBrowser();

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <TabHeader
        title="Asset Browser"
        description="Search PolyHaven + Sketchfab in one place, then one-click import straight into your Blender scene."
      />

      <BlenderConnectionBar />

      {/* Search + facets */}
      <div className="rounded-lg border border-border bg-surface-secondary p-3 space-y-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (connected && !b.isSearching) void b.search();
          }}
          className="flex items-center gap-2"
        >
          <div className="relative flex-1">
            <Search
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted"
              aria-hidden="true"
            />
            <input
              type="search"
              value={b.query}
              onChange={(e) => b.setQuery(e.target.value)}
              placeholder="Search models, textures, HDRIs…"
              aria-label="Search PolyHaven and Sketchfab assets"
              data-testid="asset-browser-search-input"
              className="focus-ring w-full bg-surface-tertiary border border-border rounded-lg pl-8 pr-3 h-9 text-xs text-text placeholder:text-text-muted"
            />
          </div>
          <button
            type="submit"
            disabled={!connected || b.isSearching}
            data-testid="asset-browser-search-button"
            className="focus-ring inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-xs font-semibold bg-[var(--visual-gen)] text-white hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {b.isSearching ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <Search className="w-4 h-4" aria-hidden="true" />
            )}
            Search
          </button>
        </form>

        {/* Category chips (PolyHaven facet) */}
        <div
          className="flex flex-wrap items-center gap-1.5"
          role="group"
          aria-label="PolyHaven category filter"
        >
          <Chip
            label="All"
            active={b.category === null}
            onClick={() => b.setCategory(null)}
            testId="asset-cat-all"
          />
          {POLYHAVEN_CATEGORIES.map((cat) => (
            <Chip
              key={cat}
              label={cat}
              active={b.category === cat}
              onClick={() => b.setCategory(b.category === cat ? null : cat)}
              testId={`asset-cat-${cat}`}
            />
          ))}
        </div>

        {/* Resolution selector (PolyHaven downloads) */}
        <div className="flex items-center gap-2">
          <span className="text-2xs font-medium text-text-muted">
            PolyHaven resolution
          </span>
          <div
            className="inline-flex rounded-md border border-border overflow-hidden"
            role="group"
            aria-label="PolyHaven download resolution"
          >
            {POLYHAVEN_RESOLUTIONS.map((res) => (
              <button
                key={res}
                type="button"
                onClick={() => b.setResolution(res)}
                aria-pressed={b.resolution === res}
                data-testid={`asset-res-${res}`}
                className={`focus-ring px-2.5 h-7 text-2xs font-semibold uppercase transition-colors ${
                  b.resolution === res
                    ? 'bg-[var(--visual-gen)] text-white'
                    : 'bg-surface-tertiary text-text-muted hover:text-text'
                }`}
              >
                {res}
              </button>
            ))}
          </div>
        </div>

        {!connected && (
          <p className={`text-xs ${WARNING_TEXT}`}>
            Connect to Blender MCP above to search and import assets.
          </p>
        )}
      </div>

      {/* Hard error — both sources failed */}
      <McpErrorBanner show={!!b.searchError} motionKey="asset-search-error">
        <span>{b.searchError}</span>
      </McpErrorBanner>

      {/* Import error */}
      <McpErrorBanner show={!!b.importError} motionKey="asset-import-error">
        <span>Import failed — {b.importError}</span>
      </McpErrorBanner>

      {/* Soft warning — one source failed */}
      {b.searchWarning && !b.searchError && (
        <p className="flex items-center gap-1.5 text-xs text-amber-400">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          Showing partial results — {b.searchWarning}
        </p>
      )}

      {/* Results grid */}
      {b.results.length > 0 ? (
        <div
          data-testid="asset-browser-grid"
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3"
        >
          {b.results.map((asset) => {
            const key = assetKey(asset);
            return (
              <AssetCard
                key={key}
                asset={asset}
                isImporting={b.importingKey === key}
                isImported={b.importedKeys.has(key)}
                disabled={!connected || b.importingKey !== null}
                onImport={b.importAsset}
              />
            );
          })}
        </div>
      ) : (
        <EmptyState hasSearched={b.hasSearched} isSearching={b.isSearching} />
      )}

      {/* The asset lands here — auto-captured snapshot after each import */}
      <ViewportPreview />
    </div>
  );
}

/* ─── Subcomponents ─────────────────────────────────────────────────────────── */

function Chip({
  label,
  active,
  onClick,
  testId,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  testId: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      data-testid={testId}
      className={`focus-ring rounded-full px-2.5 h-6 text-2xs font-medium capitalize transition-colors ${
        active
          ? 'bg-[var(--visual-gen)] text-white'
          : 'bg-surface-tertiary text-text-muted hover:text-text'
      }`}
    >
      {label}
    </button>
  );
}

function EmptyState({
  hasSearched,
  isSearching,
}: {
  hasSearched: boolean;
  isSearching: boolean;
}) {
  if (isSearching) return null;
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      <Boxes className="w-8 h-8 text-text-muted" aria-hidden="true" />
      <p className="text-xs text-text-muted">
        {hasSearched
          ? 'No assets matched. Try a different term or category.'
          : 'Search PolyHaven and Sketchfab to browse importable 3D assets.'}
      </p>
    </div>
  );
}
