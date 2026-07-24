import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { MODULE_FEATURE_DEFINITIONS, buildDependencyMap, computeBlockers } from '@/lib/feature-definitions';
import { tryApiFetch } from '@/lib/api-utils';
import { MODULE_LABELS } from '@/lib/module-registry';
import { useManifest } from '@/hooks/useManifest';
import type { SubModuleId } from '@/types/modules';
import { MODULE_COLORS, COL_WIDTH, ROW_HEIGHT, NODE_W, NODE_H, PAD_X, PAD_Y, getNodeCenter } from './constants';
import type { ModuleNode, Edge } from './types';

export function useDependencyGraph() {
  const [statusMap, setStatusMap] = useState<Map<string, string>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [hoveredModule, setHoveredModule] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const svgRef = useRef<SVGSVGElement>(null);
  const { manifest, isConnected: bridgeConnected } = useManifest();

  const manifestCrossRefs = useMemo(() => {
    if (!manifest) return new Map<string, Set<string>>();
    const refs = new Map<string, Set<string>>();
    const addRefs = (path: string, crossRefs: string[]) => {
      for (const ref of crossRefs) {
        const existing = refs.get(path) ?? new Set<string>();
        existing.add(ref);
        refs.set(path, existing);
      }
    };
    for (const bp of manifest.blueprints) addRefs(bp.path, bp.crossReferences);
    for (const mat of manifest.materials) addRefs(mat.path, mat.crossReferences);
    for (const anim of manifest.animAssets) addRefs(anim.path, anim.crossReferences);
    for (const dt of manifest.dataTables) addRefs(dt.path, dt.crossReferences);
    for (const oa of manifest.otherAssets) addRefs(oa.path, oa.crossReferences);
    return refs;
  }, [manifest]);

  const fetchStatuses = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Route returns apiSuccess({ statuses }); tryApiFetch unwraps the envelope so
      // the status map isn't silently empty (which hid all cross-module blockers).
      const result = await tryApiFetch<{ statuses: { moduleId: string; featureName: string; status: string }[] }>('/api/feature-matrix/all-statuses');
      if (result.ok) {
        const map = new Map<string, string>();
        for (const row of result.data.statuses ?? []) {
          map.set(`${row.moduleId}::${row.featureName}`, row.status);
        }
        setStatusMap(map);
      } else {
        // A failed fetch must not masquerade as "no feature data yet" — that empty
        // state claims the project has no reviewed features, which is a different
        // (and actionable) fact. Surface the reason and let the user retry.
        setError(result.error);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchStatuses(); }, [fetchStatuses]);

  // Build dep map with blocker info
  const depMap = useMemo(() => {
    const base = buildDependencyMap();
    return computeBlockers(base, statusMap);
  }, [statusMap]);

  // Build nodes
  const nodes: ModuleNode[] = useMemo(() => {
    return Object.keys(MODULE_FEATURE_DEFINITIONS).map((moduleId) => {
      const features = MODULE_FEATURE_DEFINITIONS[moduleId as SubModuleId] ?? [];
      const center = getNodeCenter(moduleId as SubModuleId);
      let blockedCount = 0;
      let implementedCount = 0;

      for (const feat of features) {
        const key = `${moduleId}::${feat.featureName}`;
        const status = statusMap.get(key) ?? 'unknown';
        if (status === 'implemented') implementedCount++;
        const info = depMap.get(key);
        if (info?.isBlocked && status !== 'implemented') blockedCount++;
      }

      return {
        moduleId: moduleId as SubModuleId,
        label: MODULE_LABELS[moduleId] ?? moduleId,
        color: MODULE_COLORS[moduleId] ?? 'var(--text-muted)',
        featureCount: features.length,
        blockedCount,
        implementedCount,
        cx: center.x,
        cy: center.y,
      };
    });
  }, [depMap, statusMap]);

  // Build cross-module edges
  const edges: Edge[] = useMemo(() => {
    const edgeMap = new Map<string, { count: number; hasBlockers: boolean }>();

    for (const [moduleId, features] of Object.entries(MODULE_FEATURE_DEFINITIONS)) {
      for (const feat of features) {
        const key = `${moduleId}::${feat.featureName}`;
        const info = depMap.get(key);
        if (!info) continue;

        for (const dep of info.deps) {
          if (dep.moduleId === moduleId) continue; // skip same-module
          const edgeKey = `${dep.moduleId}->${moduleId}`;
          const existing = edgeMap.get(edgeKey);
          const isBlocker = info.blockers.some((b) => b.key === dep.key);
          if (existing) {
            existing.count++;
            if (isBlocker) existing.hasBlockers = true;
          } else {
            edgeMap.set(edgeKey, { count: 1, hasBlockers: isBlocker });
          }
        }
      }
    }

    return Array.from(edgeMap.entries()).map(([key, val]) => {
      const [from, to] = key.split('->');
      return { from, to, count: val.count, hasBlockers: val.hasBlockers };
    });
  }, [depMap]);

  // Feature-level details for selected module
  const selectedDetails = useMemo(() => {
    if (!selectedModule) return null;
    const features = MODULE_FEATURE_DEFINITIONS[selectedModule as SubModuleId] ?? [];
    return features.map((feat) => {
      const key = `${selectedModule}::${feat.featureName}`;
      const status = statusMap.get(key) ?? 'unknown';
      const info = depMap.get(key);
      return {
        featureName: feat.featureName,
        status,
        deps: info?.deps ?? [],
        blockers: info?.blockers ?? [],
        isBlocked: (info?.isBlocked ?? false) && status !== 'implemented',
      };
    });
  }, [selectedModule, depMap, statusMap]);

  // Per-module cross-ref counts from manifest (best-effort path matching)
  const moduleCrossRefCounts = useMemo(() => {
    const counts = new Map<string, number>();
    if (!manifest) return counts;
    const allPaths = [
      ...manifest.blueprints.map((a) => a.path),
      ...manifest.materials.map((a) => a.path),
      ...manifest.animAssets.map((a) => a.path),
      ...manifest.dataTables.map((a) => a.path),
      ...manifest.otherAssets.map((a) => a.path),
    ];
    for (const moduleId of Object.keys(MODULE_FEATURE_DEFINITIONS)) {
      // Match paths containing a segment similar to the module name (strip "arpg-" prefix)
      const shortName = moduleId.replace('arpg-', '').toLowerCase();
      const matching = allPaths.filter((p) => p.toLowerCase().includes(shortName));
      let refCount = 0;
      for (const path of matching) {
        const refs = manifestCrossRefs.get(path);
        if (refs) refCount += refs.size;
      }
      if (refCount > 0) counts.set(moduleId, refCount);
    }
    return counts;
  }, [manifest, manifestCrossRefs]);

  const svgWidth = PAD_X * 2 + 3 * COL_WIDTH + NODE_W;
  const svgHeight = PAD_Y * 2 + 2 * ROW_HEIGHT + NODE_H;

  const highlightModule = hoveredModule ?? selectedModule;

  return {
    statusMap,
    isLoading,
    error,
    refetch: fetchStatuses,
    selectedModule,
    setSelectedModule,
    setHoveredModule,
    zoom,
    setZoom,
    svgRef,
    bridgeConnected,
    manifestCrossRefs,
    nodes,
    edges,
    selectedDetails,
    moduleCrossRefCounts,
    svgWidth,
    svgHeight,
    highlightModule,
  };
}
