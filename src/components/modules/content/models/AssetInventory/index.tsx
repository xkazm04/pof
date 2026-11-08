'use client';

import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import {
  Search, ScanLine, Loader2, FolderOpen, ArrowUpDown,
} from 'lucide-react';
import { STATUS_ERROR } from '@/lib/chart-colors';
import { InlineErrorRetry } from '@/components/modules/shared/InlineErrorRetry';
import type { AssetType } from '@/app/api/filesystem/scan-assets/route';
import { ACCENT, TYPE_CONFIG } from './constants';
import { formatBytes } from '@/lib/format';
import { AssetCard } from './AssetCard';
import { BridgeManifestCard } from './BridgeManifestCard';
import { FilterChip } from './FilterChip';
import { useAssetInventory } from './useAssetInventory';
import type { SortKey } from './types';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'name', label: 'Name' },
  { key: 'type', label: 'Type' },
  { key: 'size', label: 'Size' },
  { key: 'modified', label: 'Modified' },
];

/**
 * Cards mounted per page. Every card is a framer `layout` node, so an unbounded grid
 * (a UE Content/ folder holds thousands of assets) costs a layout pass per node on
 * every search keystroke. The grid mounts one page and grows by one page on demand.
 */
export const GRID_PAGE_SIZE = 200;

const PATH_HINT_ID = 'asset-inventory-path-hint';

// ── Main Component ──

export function AssetInventory() {
  const {
    projectPath,
    bridgeConnected,
    bridgeSummary,
    scanResult,
    isScanning,
    error,
    search,
    setSearch,
    typeFilter,
    setTypeFilter,
    ueFilter,
    setUeFilter,
    sortKey,
    sortDir,
    toggleSort,
    SortIcon,
    expandedAsset,
    setExpandedAsset,
    handleScan,
    typeCounts,
    displayAssets,
    edges,
    edgeProvenance,
    unresolvedRefs,
    reconcile,
    ueListed,
    edgeCount,
  } = useAssetInventory();

  // Page limit, tagged with the view it was grown for: a new search / filter / sort / scan
  // starts over at one page (derived, so no reset effect is needed).
  const viewSig = `${scanResult?.scannedAt ?? ''}|${search}|${typeFilter}|${String(ueFilter)}|${sortKey}|${sortDir}`;
  const [grown, setGrown] = useState({ sig: '', limit: GRID_PAGE_SIZE });
  const limit = grown.sig === viewSig ? grown.limit : GRID_PAGE_SIZE;
  const visibleAssets = displayAssets.length <= limit
    ? displayAssets
    : displayAssets.filter((a, i) => i < limit || a.relativePath === expandedAsset);
  const hiddenCount = displayAssets.length - visibleAssets.length;

  // ── Pre-scan state ──
  if (!scanResult && !isScanning && !error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="w-14 h-14 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: `${ACCENT}12`, border: `1px solid ${ACCENT}25` }}>
          <FolderOpen className="w-7 h-7" style={{ color: ACCENT }} />
        </div>
        <div className="text-center">
          <h3 className="text-sm font-semibold text-text mb-1">Asset Inventory</h3>
          <p className="text-xs text-text-muted max-w-xs">
            Scan your UE5 project&apos;s Content/ directory to discover imported meshes, textures, materials, and more.
          </p>
        </div>
        <button
          onClick={handleScan}
          disabled={!projectPath}
          aria-describedby={projectPath ? undefined : PATH_HINT_ID}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all hover:brightness-110 disabled:opacity-40"
          style={{ backgroundColor: `${ACCENT}18`, color: ACCENT, border: `1px solid ${ACCENT}35` }}
        >
          <ScanLine className="w-3.5 h-3.5" />
          Scan Content/
        </button>
        {bridgeConnected && bridgeSummary && (
          <BridgeManifestCard summary={bridgeSummary} className="w-full max-w-sm" />
        )}
        {!projectPath && (
          <p id={PATH_HINT_ID} className="text-xs" style={{ color: STATUS_ERROR }}>Set your project path in Project Setup first</p>
        )}
      </div>
    );
  }

  // ── Scanning state ──
  if (isScanning) {
    return (
      <div role="status" className="flex flex-col items-center justify-center py-16 gap-3">
        <Loader2 className="w-6 h-6 animate-spin" aria-hidden="true" style={{ color: ACCENT }} />
        <p className="text-xs text-text-muted">Scanning Content/ directory...</p>
      </div>
    );
  }

  // ── Error state ── (the shared error + Retry surface: role="alert", focus ring)
  if (error) {
    return (
      <div className="flex justify-center py-16">
        <InlineErrorRetry message={error} onRetry={handleScan} className="w-full max-w-md" />
      </div>
    );
  }

  if (!scanResult) return null;

  const depCount = edges.length;

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-x-4 gap-y-1.5 flex-wrap text-[13px] text-text-muted">
          <span>
            <span className="text-text font-semibold tabular-nums">{scanResult.assets.length}</span> assets
          </span>
          <span>
            <span className="text-text font-semibold tabular-nums">{formatBytes(scanResult.totalSizeBytes)}</span> total
          </span>
          <span>
            <span className="text-text font-semibold tabular-nums">{depCount}</span> dependencies
            {/* Provenance: UE-declared edges vs name guesses, never blended. */}
            <span className="ml-1 text-xs opacity-80">
              {reconcile.available
                ? `(${edgeProvenance.declared} UE-declared, ${edgeProvenance.inferred} guessed from names${unresolvedRefs > 0 ? `; ${unresolvedRefs} UE refs with no file` : ''})`
                : '(guessed from names)'}
            </span>
          </span>
          <span className="text-xs tabular-nums opacity-80">
            scanned in {scanResult.scanDurationMs}ms
          </span>
        </div>
        <button
          onClick={handleScan}
          disabled={isScanning}
          aria-label="Rescan content directory"
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[13px] font-semibold transition-all hover:brightness-110"
          style={{ backgroundColor: `${ACCENT}12`, color: ACCENT, border: `1px solid ${ACCENT}25` }}
        >
          <ScanLine className="w-3.5 h-3.5" />
          Rescan
        </button>
      </div>

      {/* The route stops at its file cap: a capped scan must not read as the whole project. */}
      {scanResult.truncated && (
        <p role="status" className="text-xs text-amber-400 rounded-md px-3 py-2 border border-amber-400/30">
          Partial scan: it stopped at its file limit after {scanResult.assets.length} assets, so
          the totals and dependencies here cover only part of Content/.
        </p>
      )}

      {/* Bridge Assets summary */}
      {bridgeConnected && bridgeSummary && (
        <BridgeManifestCard
          summary={bridgeSummary}
          missingOnDisk={reconcile.available ? reconcile.missingOnDisk : undefined}
        />
      )}

      {/* Type filter chips */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <FilterChip
          label="All"
          count={scanResult.assets.length}
          active={typeFilter === 'all'}
          color="var(--text-muted)"
          onClick={() => setTypeFilter('all')}
        />
        {(Object.keys(TYPE_CONFIG) as AssetType[]).map(type => {
          const count = typeCounts[type];
          if (!count) return null;
          const conf = TYPE_CONFIG[type];
          return (
            <FilterChip
              key={type}
              label={conf.label}
              count={count}
              active={typeFilter === type}
              color={conf.color}
              onClick={() => setTypeFilter(type === typeFilter ? 'all' : type)}
            />
          );
        })}
        {ueFilter !== null && reconcile.available && (
          <FilterChip
            label="Not in UE manifest"
            count={reconcile.notInManifest.length}
            active={ueFilter === 'not-in-manifest'}
            color={ACCENT}
            onClick={() => setUeFilter(ueFilter === 'not-in-manifest' ? 'all' : 'not-in-manifest')}
          />
        )}
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" aria-hidden="true" />
        <input
          type="text"
          placeholder="Search by name or path..."
          aria-label="Search assets by name or path"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-8 pr-3 py-1.5 rounded-md bg-surface-deep border border-border text-xs text-text placeholder-text-muted focus-ring-inset"
        />
      </div>

      {/* Sort controls */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span id="asset-sort-label" className="text-xs text-text-muted mr-0.5">Sort</span>
        <div className="flex items-center gap-1.5 flex-wrap" role="group" aria-labelledby="asset-sort-label">
          {SORT_OPTIONS.map(({ key, label }) => {
            const active = sortKey === key;
            const Icon = active ? SortIcon : ArrowUpDown;
            return (
              <button
                key={key}
                onClick={() => toggleSort(key)}
                aria-pressed={active}
                aria-label={
                  active
                    ? `Sort by ${label}, currently ${sortDir === 'asc' ? 'ascending' : 'descending'}. Activate to reverse`
                    : `Sort by ${label}`
                }
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all focus-ring"
                style={{
                  backgroundColor: active ? `${ACCENT}18` : 'transparent',
                  color: active ? ACCENT : 'var(--text-muted)',
                  border: `1px solid ${active ? `${ACCENT}35` : 'var(--border)'}`,
                }}
              >
                {label}
                <Icon className="w-3 h-3" aria-hidden="true" style={{ opacity: active ? 1 : 0.5 }} />
              </button>
            );
          })}
        </div>
      </div>

      {/* Asset Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-4">
        <AnimatePresence mode="popLayout">
          {displayAssets.length === 0 ? (
            <div className="col-span-full py-16 text-center text-xs text-text-muted bg-surface/30 rounded-xl border border-dashed border-border">
              {search || typeFilter !== 'all' || ueFilter === 'not-in-manifest' ? 'No assets match your filters' : 'No assets found in Content/'}
            </div>
          ) : (
            visibleAssets.map(asset => (
              <AssetCard
                key={asset.relativePath}
                asset={asset}
                isExpanded={expandedAsset === asset.relativePath}
                edgeCount={edgeCount}
                allAssets={scanResult.assets}
                dependencies={edges}
                ueListed={ueListed ? ueListed[asset.relativePath] ?? false : null}
                setExpandedAsset={setExpandedAsset}
              />
            ))
          )}
        </AnimatePresence>
      </div>

      {hiddenCount > 0 && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setGrown({ sig: viewSig, limit: limit + GRID_PAGE_SIZE })}
            className="focus-ring px-3 py-1.5 rounded-md text-xs font-medium text-text-muted border border-border hover:text-text transition-colors"
          >
            Show {Math.min(GRID_PAGE_SIZE, hiddenCount)} more ({hiddenCount} hidden)
          </button>
        </div>
      )}

      {/* Showing count */}
      {displayAssets.length > 0 && (
        <div className="text-xs text-text-muted text-right font-mono mt-2 opacity-60">
          Showing {visibleAssets.length} of {scanResult.assets.length} assets
        </div>
      )}
    </div>
  );
}
