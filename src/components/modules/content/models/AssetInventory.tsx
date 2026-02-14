'use client';

import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, ScanLine, ArrowUpDown, ArrowDown, ArrowUp,
  Box, Image, Paintbrush, Film, Cpu, Volume2, Map, HelpCircle,
  ChevronRight, Loader2, AlertCircle, FolderOpen,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import type { AssetScanResult, ScannedAsset, AssetType, AssetDependencyEdge } from '@/app/api/filesystem/scan-assets/route';

// ── Constants ──

const ACCENT = '#a78bfa';

const TYPE_CONFIG: Record<AssetType, { label: string; icon: LucideIcon; color: string }> = {
  mesh:      { label: 'Mesh',      icon: Box,        color: '#3b82f6' },
  texture:   { label: 'Texture',   icon: Image,      color: '#f59e0b' },
  material:  { label: 'Material',  icon: Paintbrush,  color: '#8b5cf6' },
  animation: { label: 'Animation', icon: Film,        color: '#ef4444' },
  blueprint: { label: 'Blueprint', icon: Cpu,         color: '#00ff88' },
  sound:     { label: 'Sound',     icon: Volume2,     color: '#06b6d4' },
  map:       { label: 'Map',       icon: Map,         color: '#f97316' },
  other:     { label: 'Other',     icon: HelpCircle,  color: 'var(--text-muted)' },
};

type SortKey = 'name' | 'type' | 'size' | 'modified';
type SortDir = 'asc' | 'desc';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const val = bytes / Math.pow(1024, i);
  return `${val < 10 ? val.toFixed(1) : Math.round(val)} ${units[i]}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Dependency Graph (SVG mini-view) ──

interface DependencyGraphProps {
  asset: ScannedAsset;
  allAssets: ScannedAsset[];
  dependencies: AssetDependencyEdge[];
}

function DependencyGraph({ asset, allAssets, dependencies }: DependencyGraphProps) {
  // Find edges where this asset is from or to
  const outEdges = dependencies.filter(e => e.from === asset.name);
  const inEdges = dependencies.filter(e => e.to === asset.name);

  if (outEdges.length === 0 && inEdges.length === 0) {
    return (
      <div className="text-xs text-[#4a4e6a] italic py-2 pl-2">
        No known dependencies
      </div>
    );
  }

  const assetMap: Record<string, ScannedAsset> = {};
  for (const a of allAssets) assetMap[a.name] = a;

  // Build node list: center = this asset, left = sources (things that reference this), right = targets (things this references)
  const sources = inEdges.map(e => ({ name: e.from, relation: e.relation, asset: assetMap[e.from] as ScannedAsset | undefined }));
  const targets = outEdges.map(e => ({ name: e.to, relation: e.relation, asset: assetMap[e.to] as ScannedAsset | undefined }));

  const nodeH = 28;
  const maxNodes = Math.max(sources.length, targets.length, 1);
  const svgH = Math.max(maxNodes * (nodeH + 6) + 20, 60);
  const svgW = 520;
  const centerX = svgW / 2;
  const centerY = svgH / 2;

  function nodeY(idx: number, total: number) {
    if (total === 0) return centerY;
    const spacing = Math.min(nodeH + 6, (svgH - 20) / total);
    const startY = centerY - ((total - 1) * spacing) / 2;
    return startY + idx * spacing;
  }

  const typeConf = TYPE_CONFIG[asset.type];

  return (
    <svg width={svgW} height={svgH} className="block">
      <defs>
        <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="#4a4e6a" />
        </marker>
      </defs>

      {/* Source nodes (left) */}
      {sources.map((s, i) => {
        const y = nodeY(i, sources.length);
        const conf = s.asset ? TYPE_CONFIG[s.asset.type] : TYPE_CONFIG.other;
        return (
          <g key={`src-${s.name}`}>
            <line x1={160} y1={y} x2={centerX - 60} y2={centerY}
              stroke="#2a2a4a" strokeWidth={1} markerEnd="url(#arrowhead)" />
            <rect x={10} y={y - 12} width={150} height={24} rx={4} fill="var(--surface-deep)" stroke={conf.color + '40'} strokeWidth={1} />
            <circle cx={22} cy={y} r={4} fill={conf.color} />
            <text x={30} y={y + 3.5} fill="#a0a4c0" fontSize={10} fontFamily="monospace">{s.name.length > 18 ? s.name.slice(0, 17) + '…' : s.name}</text>
          </g>
        );
      })}

      {/* Center node */}
      <rect x={centerX - 55} y={centerY - 14} width={110} height={28} rx={6}
        fill={typeConf.color + '18'} stroke={typeConf.color} strokeWidth={1.5} />
      <circle cx={centerX - 38} cy={centerY} r={5} fill={typeConf.color} />
      <text x={centerX - 28} y={centerY + 3.5} fill="var(--text)" fontSize={11} fontWeight="600" fontFamily="monospace">
        {asset.name.length > 12 ? asset.name.slice(0, 11) + '…' : asset.name}
      </text>

      {/* Target nodes (right) */}
      {targets.map((t, i) => {
        const y = nodeY(i, targets.length);
        const conf = t.asset ? TYPE_CONFIG[t.asset.type] : TYPE_CONFIG.other;
        return (
          <g key={`tgt-${t.name}`}>
            <line x1={centerX + 55} y1={centerY} x2={svgW - 160} y2={y}
              stroke="#2a2a4a" strokeWidth={1} markerEnd="url(#arrowhead)" />
            <rect x={svgW - 160} y={y - 12} width={150} height={24} rx={4} fill="var(--surface-deep)" stroke={conf.color + '40'} strokeWidth={1} />
            <circle cx={svgW - 148} cy={y} r={4} fill={conf.color} />
            <text x={svgW - 140} y={y + 3.5} fill="#a0a4c0" fontSize={10} fontFamily="monospace">{t.name.length > 18 ? t.name.slice(0, 17) + '…' : t.name}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Main Component ──

export function AssetInventory() {
  const projectPath = useProjectStore((s) => s.projectPath);
  const [scanResult, setScanResult] = useState<AssetScanResult | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<AssetType | 'all'>('all');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [expandedAsset, setExpandedAsset] = useState<string | null>(null);

  const handleScan = useCallback(async () => {
    if (!projectPath) return;
    setIsScanning(true);
    setError(null);
    try {
      const res = await fetch('/api/filesystem/scan-assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectPath }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Scan failed' }));
        throw new Error(data.error ?? `Scan failed (${res.status})`);
      }
      const result: AssetScanResult = await res.json();
      setScanResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to scan assets');
    } finally {
      setIsScanning(false);
    }
  }, [projectPath]);

  // Type counts for filter chips
  const typeCounts = useMemo(() => {
    if (!scanResult) return {};
    const counts: Partial<Record<AssetType, number>> = {};
    for (const a of scanResult.assets) {
      counts[a.type] = (counts[a.type] ?? 0) + 1;
    }
    return counts;
  }, [scanResult]);

  // Filtered + sorted assets
  const displayAssets = useMemo(() => {
    if (!scanResult) return [];
    let list = scanResult.assets;

    if (typeFilter !== 'all') {
      list = list.filter(a => a.type === typeFilter);
    }

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(a => a.name.toLowerCase().includes(q) || a.relativePath.toLowerCase().includes(q));
    }

    list = [...list].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'name': cmp = a.name.localeCompare(b.name); break;
        case 'type': cmp = a.type.localeCompare(b.type) || a.name.localeCompare(b.name); break;
        case 'size': cmp = a.sizeBytes - b.sizeBytes; break;
        case 'modified': cmp = new Date(a.modifiedAt).getTime() - new Date(b.modifiedAt).getTime(); break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [scanResult, typeFilter, search, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const SortIcon = sortDir === 'asc' ? ArrowUp : ArrowDown;

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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-xs text-text-muted">
            <span className="text-text font-semibold">{scanResult.assets.length}</span> assets
          </span>
          <span className="text-xs text-text-muted">
            <span className="text-text font-semibold">{formatBytes(scanResult.totalSizeBytes)}</span> total
          </span>
          <span className="text-xs text-text-muted">
            <span className="text-text font-semibold">{depCount}</span> dependencies
          </span>
          <span className="text-xs text-[#4a4e6a]">
            scanned in {scanResult.scanDurationMs}ms
          </span>
        </div>
        <button
          onClick={handleScan}
          disabled={isScanning}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all hover:brightness-110"
          style={{ backgroundColor: `${ACCENT}12`, color: ACCENT, border: `1px solid ${ACCENT}25` }}
        >
          <ScanLine className="w-3 h-3" />
          Rescan
        </button>
      </div>

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
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#4a4e6a]" />
        <input
          type="text"
          placeholder="Search by name or path..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-8 pr-3 py-1.5 rounded-md bg-surface-deep border border-border text-xs text-text placeholder-[#4a4e6a] focus:outline-none focus:border-[#3b3b6a]"
        />
      </div>

      {/* Asset table */}
      <div className="border border-border rounded-lg overflow-hidden">
        {/* Header row */}
        <div className="grid grid-cols-[1fr_90px_80px_100px] gap-2 px-3 py-2 bg-background border-b border-border text-xs font-semibold uppercase tracking-wider text-[#4a4e6a]">
          <button className="flex items-center gap-1 text-left hover:text-text-muted-hover transition-colors" onClick={() => toggleSort('name')}>
            Name {sortKey === 'name' && <SortIcon className="w-3 h-3" />}
            {sortKey !== 'name' && <ArrowUpDown className="w-3 h-3 opacity-30" />}
          </button>
          <button className="flex items-center gap-1 hover:text-text-muted-hover transition-colors" onClick={() => toggleSort('type')}>
            Type {sortKey === 'type' && <SortIcon className="w-3 h-3" />}
            {sortKey !== 'type' && <ArrowUpDown className="w-3 h-3 opacity-30" />}
          </button>
          <button className="flex items-center gap-1 text-right justify-end hover:text-text-muted-hover transition-colors" onClick={() => toggleSort('size')}>
            Size {sortKey === 'size' && <SortIcon className="w-3 h-3" />}
            {sortKey !== 'size' && <ArrowUpDown className="w-3 h-3 opacity-30" />}
          </button>
          <button className="flex items-center gap-1 text-right justify-end hover:text-text-muted-hover transition-colors" onClick={() => toggleSort('modified')}>
            Modified {sortKey === 'modified' && <SortIcon className="w-3 h-3" />}
            {sortKey !== 'modified' && <ArrowUpDown className="w-3 h-3 opacity-30" />}
          </button>
        </div>

        {/* Rows */}
        <div className="max-h-[400px] overflow-y-auto">
          {displayAssets.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-[#4a4e6a]">
              {search || typeFilter !== 'all' ? 'No assets match your filters' : 'No assets found in Content/'}
            </div>
          ) : (
            displayAssets.map(asset => {
              const conf = TYPE_CONFIG[asset.type];
              const Icon = conf.icon;
              const isExpanded = expandedAsset === asset.relativePath;
              const hasEdges = scanResult.dependencies.some(
                e => e.from === asset.name || e.to === asset.name
              );

              return (
                <div key={asset.relativePath}>
                  <button
                    onClick={() => setExpandedAsset(isExpanded ? null : asset.relativePath)}
                    className="w-full grid grid-cols-[1fr_90px_80px_100px] gap-2 px-3 py-2 text-left hover:bg-surface transition-colors border-b border-border/50 group"
                  >
                    {/* Name cell */}
                    <div className="flex items-center gap-2 min-w-0">
                      {hasEdges ? (
                        <ChevronRight
                          className="w-3 h-3 flex-shrink-0 text-[#4a4e6a] transition-transform"
                          style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
                        />
                      ) : (
                        <span className="w-3 flex-shrink-0" />
                      )}
                      <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: conf.color }} />
                      <div className="min-w-0">
                        <span className="text-xs text-text truncate block">{asset.name}</span>
                        <span className="text-2xs text-[#4a4e6a] truncate block">{asset.relativePath}</span>
                      </div>
                    </div>

                    {/* Type cell */}
                    <div className="flex items-center">
                      <span
                        className="text-2xs px-1.5 py-0.5 rounded font-medium"
                        style={{ color: conf.color, backgroundColor: conf.color + '15', border: `1px solid ${conf.color}25` }}
                      >
                        {conf.label}
                      </span>
                    </div>

                    {/* Size cell */}
                    <div className="flex items-center justify-end">
                      <span className="text-xs text-[#a0a4c0] tabular-nums">{formatBytes(asset.sizeBytes)}</span>
                    </div>

                    {/* Modified cell */}
                    <div className="flex items-center justify-end">
                      <span className="text-xs text-text-muted">{formatDate(asset.modifiedAt)}</span>
                    </div>
                  </button>

                  {/* Expanded dependency graph */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden border-b border-border/50"
                      >
                        <div className="px-4 py-3 bg-[#080818]">
                          <div className="text-xs text-text-muted font-semibold uppercase tracking-wider mb-2">
                            Dependency Graph
                          </div>
                          <div className="overflow-x-auto">
                            <DependencyGraph
                              asset={asset}
                              allAssets={scanResult.assets}
                              dependencies={scanResult.dependencies}
                            />
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Showing count */}
      {displayAssets.length > 0 && (
        <div className="text-xs text-[#4a4e6a] text-right">
          Showing {displayAssets.length} of {scanResult.assets.length} assets
        </div>
      )}
    </div>
  );
}

// ── Filter Chip ──

function FilterChip({ label, count, active, color, onClick }: {
  label: string;
  count: number;
  active: boolean;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all"
      style={{
        backgroundColor: active ? color + '18' : 'transparent',
        color: active ? color : 'var(--text-muted)',
        border: `1px solid ${active ? color + '35' : 'var(--border)'}`,
      }}
    >
      {label}
      <span className="opacity-60">{count}</span>
    </button>
  );
}
