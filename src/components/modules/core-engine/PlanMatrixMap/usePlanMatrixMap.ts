'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useCanvasTransform } from '@/hooks/useCanvasTransform';
import { useImplementationPlan } from '@/hooks/useImplementationPlan';
import {
  computeCanvasLayout, findCriticalPath,
  type CanvasNode, type ModuleCluster, type CanvasLayout,
} from '@/lib/implementation-planner/layout-engine';
import { getModuleLabel, type PlanItem } from '@/lib/implementation-planner/plan-generator';
import { MODULE_FEATURE_DEFINITIONS } from '@/lib/feature-definitions';
import { usePlanDispatch } from '@/hooks/usePlanDispatch';
import type { SubModuleId } from '@/types/modules';

export function usePlanMatrixMap(initialModuleId?: string) {
  const rootRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isPanningRef = useRef(false);
  const dragCountRef = useRef(0);

  const { plan, loading, error } = useImplementationPlan();
  const { transform, startPan, onPointerMove, endPan, zoomToFit, zoomToCenter, reset, setTransform } = useCanvasTransform();
  const [isPanningState, setIsPanningState] = useState(false);

  // The ONE plan dispatch door (gated, feature-fix task, refresh on land) —
  // the same door as the plan table; no prompt is built here.
  const { dispatch } = usePlanDispatch({
    sessionKey: 'plan-matrix-map',
    label: 'Plan Map',
  });

  // --- UI State ---
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });
  const [showDeps, setShowDeps] = useState(false);
  const [criticalPathMode, setCriticalPathMode] = useState(false);
  const [filterModuleId, setFilterModuleId] = useState(initialModuleId ?? '');
  const [selectedSectorId, setSelectedSectorId] = useState('');
  const [canvasHeight, setCanvasHeight] = useState(560);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [containerSize, setContainerSize] = useState({ w: 800, h: 560 });

  // --- Computed ---

  const layout = useMemo<CanvasLayout | null>(() => {
    if (!plan) return null;
    return computeCanvasLayout(plan.items);
  }, [plan]);

  const cpSet = useMemo<Set<string>>(() => {
    if (!plan || !criticalPathMode) return new Set();
    return findCriticalPath(plan.items);
  }, [plan, criticalPathMode]);

  const moduleIds = useMemo(() => {
    return Object.keys(MODULE_FEATURE_DEFINITIONS).sort((a, b) => {
      const labelA = getModuleLabel(a as SubModuleId);
      const labelB = getModuleLabel(b as SubModuleId);
      return labelA.localeCompare(labelB);
    });
  }, []);

  const edges = useMemo(() => {
    if (!plan || !showDeps || !layout) return [];
    return plan.items.flatMap((item) =>
      item.dependsOn
        .filter((dep) => layout.allNodes.has(dep))
        .map((dep) => ({ from: dep, to: item.key }))
    );
  }, [plan, showDeps, layout]);

  const readyCount = plan?.items.filter((i) => i.isReady).length ?? 0;
  const visibleNodes = useMemo(() => [...layout?.allNodes.values() ?? []], [layout]);
  const showNodes = transform.zoom >= 0.45;
  const labelScale = useMemo(() => Math.max(1, Math.min(2.2, 1 / Math.max(0.35, transform.zoom))), [transform.zoom]);
  const moduleSectors = useMemo(() => {
    if (!layout) {
      return [] as Array<{
        id: string;
        moduleId: SubModuleId;
        label: string;
        rect: { minX: number; minY: number; maxX: number; maxY: number };
        count: number;
        ready: number;
      }>;
    }

    return layout.clusters.map((cluster) => {
      const ready = cluster.nodes.filter((n) => n.item.isReady).length;
      return {
        id: `sector-${cluster.moduleId}`,
        moduleId: cluster.moduleId,
        label: cluster.label,
        rect: {
          minX: cluster.x,
          minY: cluster.y,
          maxX: cluster.x + cluster.width,
          maxY: cluster.y + cluster.height,
        },
        count: cluster.nodes.length,
        ready,
      };
    });
  }, [layout]);

  const selectedNode = selectedKey && layout ? layout.allNodes.get(selectedKey) ?? null : null;
  const hoveredNode = hoveredKey && layout ? layout.allNodes.get(hoveredKey) ?? null : null;

  // --- Effects ---

  // Zoom to fit on first layout
  const hasAutoFit = useRef(false);
  useEffect(() => {
    if (layout && containerRef.current && !hasAutoFit.current) {
      hasAutoFit.current = true;
      const rect = containerRef.current.getBoundingClientRect();
      zoomToFit(layout.bounds, rect.width, rect.height);
    }
  }, [layout, zoomToFit]);

  // Dynamic full-height canvas based on viewport and component position
  useEffect(() => {
    const recalc = () => {
      const el = rootRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const viewportBottomPadding = 16;
      const available = window.innerHeight - rect.top - viewportBottomPadding;
      setCanvasHeight(Math.max(560, Math.floor(available)));
    };

    recalc();
    window.addEventListener('resize', recalc);
    return () => window.removeEventListener('resize', recalc);
  }, []);

  // Track container dimensions for minimap viewport calculation
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      setContainerSize({ w: el.clientWidth, h: el.clientHeight });
    });
    observer.observe(el);
    setContainerSize({ w: el.clientWidth, h: el.clientHeight });
    return () => observer.disconnect();
  }, []);

  // --- Handlers ---

  const handleZoomToFit = useCallback(() => {
    if (layout && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      zoomToFit(layout.bounds, rect.width, rect.height);
    }
  }, [layout, zoomToFit]);

  const handleModuleDblClick = useCallback((cluster: ModuleCluster) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    zoomToFit(
      { minX: cluster.x - 20, minY: cluster.y - 20, maxX: cluster.x + cluster.width + 20, maxY: cluster.y + cluster.height + 20 },
      rect.width, rect.height,
    );
  }, [zoomToFit]);

  const handleSectorSelect = useCallback((sectorId: string) => {
    setSelectedSectorId(sectorId);
    const sector = moduleSectors.find((s) => s.id === sectorId);
    if (!sector || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    // Add padding around the sector when zooming
    const padding = 100;
    zoomToFit({
      minX: sector.rect.minX - padding,
      minY: sector.rect.minY - padding,
      maxX: sector.rect.maxX + padding,
      maxY: sector.rect.maxY + padding
    }, rect.width, rect.height);
    setFilterModuleId(sector.moduleId);
  }, [moduleSectors, zoomToFit]);

  const toggleModuleExpansion = useCallback((moduleId: string) => {
    setExpandedModules(prev => {
      const next = new Set(prev);
      if (next.has(moduleId)) next.delete(moduleId);
      else next.add(moduleId);
      return next;
    });
  }, []);

  const handleExecute = useCallback((item: PlanItem) => {
    if (dispatch(item).ok) setSelectedKey(null);
  }, [dispatch]);

  const nodeOpacity = useCallback((node: CanvasNode): number => {
    if (filterModuleId && node.item.moduleId !== filterModuleId) return 0.08;
    if (criticalPathMode && cpSet.size > 0 && !cpSet.has(node.key)) return 0.15;
    return 1;
  }, [filterModuleId, criticalPathMode, cpSet]);

  return {
    // refs
    rootRef, containerRef, isPanningRef, dragCountRef,
    // plan / transform
    plan, loading, error,
    transform, startPan, onPointerMove, endPan, zoomToFit, zoomToCenter, reset, setTransform,
    isPanningState, setIsPanningState,
    // ui state
    selectedKey, setSelectedKey,
    hoveredKey, setHoveredKey,
    hoverPos, setHoverPos,
    showDeps, setShowDeps,
    criticalPathMode, setCriticalPathMode,
    filterModuleId, setFilterModuleId,
    selectedSectorId,
    canvasHeight,
    isSidebarOpen, setIsSidebarOpen,
    expandedModules,
    containerSize,
    // computed
    layout, cpSet, moduleIds, edges, readyCount, visibleNodes, showNodes, labelScale,
    moduleSectors, selectedNode, hoveredNode,
    // handlers
    handleZoomToFit, handleModuleDblClick, handleSectorSelect, toggleModuleExpansion,
    handleExecute, nodeOpacity,
  };
}

export type PlanMatrixState = ReturnType<typeof usePlanMatrixMap>;
