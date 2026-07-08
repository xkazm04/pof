'use client';

import { AnimatePresence } from 'framer-motion';
import {
  Search, ScanLine, Loader2, AlertCircle, FolderOpen,
} from 'lucide-react';
import type { AssetType } from '@/app/api/filesystem/scan-assets/route';
import { ACCENT, TYPE_CONFIG } from './constants';
import { formatBytes } from './helpers';
import { AssetCard } from './AssetCard';
import { BridgeManifestCard } from './BridgeManifestCard';
import { FilterChip } from './FilterChip';
import { useAssetInventory } from './useAssetInventory';

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
    expandedAsset,
    setExpandedAsset,
    handleScan,
    typeCounts,
    displayAssets,
    edgeCount,
  } = useAssetInventory();

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
          <p className="text-xs text-red-400/70">Set your project path in Project Setup first</p>
        )}
      </div>
    );
  }

  // ── Scanning state ──
  if (isScanning) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: ACCENT }} />
        <p className="text-xs text-text-muted">Scanning Content/ directory...</p>
      </div>
    );
  }

  // ── Error state ──
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <AlertCircle className="w-6 h-6 text-red-400" />
        <p className="text-xs text-red-400">{error}</p>
        <button
          onClick={handleScan}
          className="text-xs underline hover:no-underline"
          style={{ color: ACCENT }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!scanResult) return null;

  const depCount = scanResult.dependencies.length;

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

      {/* Bridge Assets summary */}
      {bridgeConnected && bridgeSummary && (
        <BridgeManifestCard summary={bridgeSummary} />
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
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
        <input
          type="text"
          placeholder="Search by name or path..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-8 pr-3 py-1.5 rounded-md bg-surface-deep border border-border text-xs text-text placeholder-text-muted focus-ring-inset"
        />
      </div>

      {/* Asset Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-4">
        <AnimatePresence mode="popLayout">
          {displayAssets.length === 0 ? (
            <div className="col-span-full py-16 text-center text-xs text-text-muted bg-surface/30 rounded-xl border border-dashed border-border">
              {search || typeFilter !== 'all' ? 'No assets match your filters' : 'No assets found in Content/'}
            </div>
          ) : (
            displayAssets.map(asset => (
              <AssetCard
                key={asset.relativePath}
                asset={asset}
                isExpanded={expandedAsset === asset.relativePath}
                edgeCount={edgeCount}
                allAssets={scanResult.assets}
                dependencies={scanResult.dependencies}
                setExpandedAsset={setExpandedAsset}
              />
            ))
          )}
        </AnimatePresence>
      </div>

      {/* Showing count */}
      {displayAssets.length > 0 && (
        <div className="text-xs text-text-muted text-right font-mono mt-2 opacity-60">
          Showing {displayAssets.length} of {scanResult.assets.length} assets
        </div>
      )}
    </div>
  );
}
