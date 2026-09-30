import { useState, useMemo, useRef, useCallback } from 'react';
import { MODULE_FEATURE_DEFINITIONS } from '@/lib/feature-definitions';
import { buildModuleTopology, isOpenBlocked, TOPOLOGY_COMPACT } from '@/lib/topology/moduleGraph';
import {
  unblockFrontier, previewUnblock, criticalUnblocker, clearedEdgeIds,
} from '@/lib/topology/unblockFrontier';
import { generatePlan } from '@/lib/implementation-planner/plan-generator';
import { MODULE_COLORS as CHART_MODULE_COLORS } from '@/lib/chart-colors';
import { useFeatureStatuses } from '@/hooks/useFeatureStatuses';
import { useManifest } from '@/hooks/useManifest';
import { usePlanDispatch } from '@/hooks/usePlanDispatch';
import type { SubModuleId } from '@/types/modules';
import { MODULE_COLORS } from './constants';
import type { BuildTarget, ModuleNode } from './types';

const NO_EDGES: ReadonlySet<string> = new Set();

/** `moduleId::featureName` -> its module id (the part before the first `::`). */
const moduleOf = (key: string) => key.slice(0, key.indexOf('::')) as SubModuleId;

/** A buildable feature plus what building it clears. */
function toBuildTarget(statusMap: ReadonlyMap<string, string>, key: string): BuildTarget {
  const { newlyReady } = previewUnblock(statusMap, key);
  return {
    key,
    moduleId: moduleOf(key),
    featureName: key.slice(key.indexOf('::') + 2),
    newlyReady,
    moduleCount: new Set(newlyReady.map(moduleOf)).size,
  };
}

export function useDependencyGraph() {
  // Statuses come from the ONE shared all-statuses path. A failed load must not
  // masquerade as "no feature data yet" — that empty state claims the project has
  // no reviewed features, which is a different (and actionable) fact — so the
  // hook's `error` is surfaced and `refetch` invalidates the shared cache.
  const {
    statusMap, isLoading, loaded, failed, error: statusError, refresh: refetch,
  } = useFeatureStatuses();
  const error = failed ? (statusError ?? 'Failed to load feature statuses') : null;
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [hoveredModule, setHoveredModule] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  // Feature whose Build is being previewed (hover / focus on a Build affordance).
  const [previewKey, setPreviewKey] = useState<string | null>(null);
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

  // Nodes, cross-module edges, placement and viewport: the ONE module-topology
  // projection shared with NexusView and the Overview roll-up.
  const topology = useMemo(() => buildModuleTopology(statusMap, TOPOLOGY_COMPACT), [statusMap]);
  const { depMap, edges } = topology;
  const nodes: ModuleNode[] = useMemo(
    () => topology.nodes.map((n) => ({ ...n, color: MODULE_COLORS[n.moduleId] ?? 'var(--text-muted)' })),
    [topology],
  );

  // The single best next build across every module (impact-scorer ranked).
  const criticalBuild = useMemo(() => {
    const key = criticalUnblocker(statusMap);
    return key ? toBuildTarget(statusMap, key) : null;
  }, [statusMap]);

  // Cross-module edges the previewed build would stop blocking.
  const previewEdges = useMemo(
    () => (previewKey ? clearedEdgeIds(statusMap, previewKey) : NO_EDGES),
    [previewKey, statusMap],
  );

  // One-click build: resolve the feature's PlanItem and dispatch it through the
  // ONE plan dispatch door (usePlanDispatch — the ImplementationPlan path):
  // gated on readiness, feature-fix task, and a confirmed landing refreshes the
  // shared statuses this graph reads. No prompt is built here.
  const { dispatch, isRunning: isBuilding } = usePlanDispatch({
    sessionKey: 'dependency-graph-build',
    label: 'Dependencies Build',
    accentColor: CHART_MODULE_COLORS.evaluator,
  });
  const buildFeature = useCallback((key: string) => {
    const item = generatePlan(statusMap).items.find((i) => i.key === key);
    if (!item) return;
    dispatch(item);
  }, [statusMap, dispatch]);

  // Feature-level details for selected module
  const selectedDetails = useMemo(() => {
    if (!selectedModule) return null;
    const features = MODULE_FEATURE_DEFINITIONS[selectedModule as SubModuleId] ?? [];
    // Rows share frontier features (AARPGCharacterBase fronts many): preview each once.
    const targets = new Map<string, BuildTarget>();
    const targetFor = (k: string) => {
      if (!targets.has(k)) targets.set(k, toBuildTarget(statusMap, k));
      return targets.get(k)!;
    };
    return features.map((feat) => {
      const key = `${selectedModule}::${feat.featureName}`;
      const status = statusMap.get(key) ?? 'unknown';
      const info = depMap.get(key);
      const isBlocked = isOpenBlocked(info, status);
      return {
        featureName: feat.featureName,
        status,
        deps: info?.deps ?? [],
        blockers: info?.blockers ?? [],
        isBlocked,
        frontier: isBlocked ? unblockFrontier(statusMap, key).map(targetFor) : [],
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

  const { width: svgWidth, height: svgHeight } = topology;

  const highlightModule = hoveredModule ?? selectedModule;

  return {
    statusMap,
    // Only the FIRST load blocks the graph: a background refresh keeps the
    // rendered graph on screen instead of flashing back to the spinner.
    isLoading: isLoading && !loaded,
    error,
    refetch,
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
    criticalBuild,
    buildFeature,
    isBuilding,
    setPreviewKey,
    previewEdges,
  };
}
