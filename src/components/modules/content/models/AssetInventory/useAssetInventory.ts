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

  // Scan state is tagged with the project it was taken of: a switch of project
  // (the module LRU keeps this tab mounted) or a scan resolving after one never
  // shows the previous project's assets as this project's.
  const [scan, setScan] = useState<{ projectPath: string; result: AssetScanResult } | null>(null);
  const [scanningFor, setScanningFor] = useState<string | null>(null);
  const [failure, setFailure] = useState<{ projectPath: string; message: string } | null>(null);
  const scanResult = scan && scan.projectPath === projectPath ? scan.result : null;
  const isScanning = scanningFor !== null && scanningFor === projectPath;
  const error = failure && failure.projectPath === projectPath ? failure.message : null;
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<AssetType | 'all'>('all');
  const [ueFilterChoice, setUeFilter] = useState<'all' | 'not-in-manifest'>('all');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [expandedAsset, setExpandedAsset] = useState<string | null>(null);

  const handleScan = useCallback(async () => {
    if (!projectPath) return;
    setScanningFor(projectPath);
    setFailure(null);
    // The route answers in the {success, data} envelope; unwrap it here, once.
    const result = await tryApiFetch<AssetScanResult>('/api/filesystem/scan-assets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectPath }),
    });
    if (result.ok) setScan({ projectPath, result: result.data });
    else setFailure({ projectPath, message: result.error || 'Failed to scan assets' });
    setScanningFor((cur) => (cur === projectPath ? null : cur));
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

  // Epoch per asset, parsed once per scan: the 'modified' comparator runs ~2 n log2 n
  // times per sort (every search keystroke), so it must not construct Dates itself.
  const modifiedEpoch = useMemo(() => {
    const epochs: Record<string, number> = {};
    if (scanResult) for (const a of scanResult.assets) epochs[a.relativePath] = new Date(a.modifiedAt).getTime() || 0;
    return epochs;
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
        case 'modified': cmp = (modifiedEpoch[a.relativePath] ?? 0) - (modifiedEpoch[b.relativePath] ?? 0); break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [scanResult, reconcile, ueFilter, typeFilter, search, sortKey, sortDir, modifiedEpoch]);

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
