'use client';

import { useState, useMemo, useCallback } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { useManifest } from '@/hooks/useManifest';
import { tryApiFetch } from '@/lib/api-utils';
import { declaredEdges, mergeInventoryEdges, reconcileInventory } from '@/lib/asset-inventory/declared-edges';
import type { AssetScanResult, AssetType } from '@/app/api/filesystem/scan-assets/route';
import type { SortKey, SortDir, UeFilter } from './types';

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
  const [ueFilterChoice, setUeFilter] = useState<'all' | 'not-in-manifest'>('all');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [expandedAsset, setExpandedAsset] = useState<string | null>(null);

  const handleScan = useCallback(async () => {
    if (!projectPath) return;
    setIsScanning(true);
    setError(null);
    // The route answers in the {success, data} envelope; unwrap it here, once.
    const result = await tryApiFetch<AssetScanResult>('/api/filesystem/scan-assets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectPath }),
    });
    if (result.ok) setScanResult(result.data);
    else setError(result.error || 'Failed to scan assets');
    setIsScanning(false);
  }, [projectPath]);

  // Edges: UE's declared references (bridge connected) over the route's name
  // guesses. Every edge carries its provenance ('declared' | 'inferred').
  const declared = useMemo(
    () => (scanResult && manifest ? declaredEdges(manifest, scanResult.assets) : null),
    [scanResult, manifest],
  );
  const edges = useMemo(
    () => (scanResult ? mergeInventoryEdges(scanResult.dependencies, declared?.edges ?? [], manifest) : []),
    [scanResult, declared, manifest],
  );
  const edgeProvenance = useMemo(() => {
    let declaredCount = 0;
    for (const e of edges) if (e.provenance === 'declared') declaredCount++;
    return { declared: declaredCount, inferred: edges.length - declaredCount };
  }, [edges]);
  const unresolvedRefs = declared?.unresolvedRefs ?? 0;

  const reconcile = useMemo(
    () => reconcileInventory(scanResult?.assets ?? [], manifest),
    [scanResult, manifest],
  );
  /** relativePath -> listed by UE's manifest; null when no manifest is connected. */
  const ueListed = useMemo(() => {
    if (!reconcile.available || !scanResult) return null;
    const listed: Record<string, boolean> = {};
    for (const a of scanResult.assets) listed[a.relativePath] = true;
    for (const a of reconcile.notInManifest) listed[a.relativePath] = false;
    return listed;
  }, [reconcile, scanResult]);
  // No manifest -> no reconcile filter (a stale choice is ignored, never applied).
  const ueFilter: UeFilter = reconcile.available ? ueFilterChoice : null;

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

    if (ueFilter === 'not-in-manifest' && reconcile.available) {
      const unlisted = new Set(reconcile.notInManifest.map(a => a.relativePath));
      list = list.filter(a => unlisted.has(a.relativePath));
    }

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
  }, [scanResult, reconcile, ueFilter, typeFilter, search, sortKey, sortDir]);

  // Precompute per-asset dependency edge counts once, so each card reads from
  // the map instead of re-filtering the full edge list on every render.
  // Each edge is counted once per endpoint, and a self-loop (from === to)
  // counts once. Plain object (same Record pattern as DependencyGraph's
  // assetMap) because the `Map` identifier is shadowed by the lucide-react Map
  // icon import.
  const edgeCount = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of edges) {
      counts[e.from] = (counts[e.from] ?? 0) + 1;
      if (e.to !== e.from) {
        counts[e.to] = (counts[e.to] ?? 0) + 1;
      }
    }
    return counts;
  }, [edges]);

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
    ueFilter,
    setUeFilter,
    sortKey,
    sortDir,
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
    toggleSort,
    SortIcon,
  };
}
