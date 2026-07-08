'use client';

import { useState, useMemo, useCallback } from 'react';
import { ArrowUpDown, ArrowDown, ArrowUp, ChevronRight } from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { useManifest } from '@/hooks/useManifest';
import type { AssetScanResult, AssetType } from '@/app/api/filesystem/scan-assets/route';
import type { SortKey, SortDir } from './types';

export function useAssetInventory() {
  const projectPath = useProjectStore((s) => s.projectPath);
  const { manifest, isConnected: bridgeConnected } = useManifest();

  const bridgeSummary = useMemo(() => {
    if (!manifest) return null;
    return {
      blueprints: manifest.blueprints.length,
      materials: manifest.materials.length,
      animations: manifest.animAssets.length,
      dataTables: manifest.dataTables.length,
      other: manifest.otherAssets.length,
      total: manifest.assetCount,
      checksum: manifest.checksumSha256.slice(0, 8),
      generatedAt: manifest.generatedAt,
    };
  }, [manifest]);

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

  // Precompute per-asset dependency edge counts once, so each card reads from
  // the map instead of re-filtering the full edge list on every render.
  // Matches the inline `e.from === name || e.to === name` count: each edge is
  // counted once per endpoint, and a self-loop (from === to) counts once.
  // Plain object (same Record pattern as DependencyGraph's assetMap) because
  // the `Map` identifier is shadowed by the lucide-react Map icon import.
  const edgeCount = useMemo(() => {
    const counts: Record<string, number> = {};
    if (!scanResult) return counts;
    for (const e of scanResult.dependencies) {
      counts[e.from] = (counts[e.from] ?? 0) + 1;
      if (e.to !== e.from) {
        counts[e.to] = (counts[e.to] ?? 0) + 1;
      }
    }
    return counts;
  }, [scanResult]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const SortIcon = sortDir === 'asc' ? ArrowUp : ArrowDown;

  return {
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
    sortKey,
    sortDir,
    expandedAsset,
    setExpandedAsset,
    handleScan,
    typeCounts,
    displayAssets,
    edgeCount,
    toggleSort,
    SortIcon,
  };
}
