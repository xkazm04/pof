import { useState, useEffect, useCallback, useMemo } from 'react';
import { MODULE_FEATURE_DEFINITIONS, buildDependencyMap, computeBlockers } from '@/lib/feature-definitions';
import { tryApiFetch } from '@/lib/api-utils';
import { MODULE_LABELS, SUB_MODULE_MAP } from '@/lib/module-registry';
import { countChecklist } from '@/lib/checklist-progress';
import { useModuleStore } from '@/stores/moduleStore';
import { usePatternLibraryStore } from '@/stores/patternLibraryStore';
import { useEvaluatorStore } from '@/stores/evaluatorStore';
import { useCLIPanelStore } from '@/components/cli/store/cliPanelStore';
import type { ImplementationPattern } from '@/types/pattern-library';
import type { SubModuleId } from '@/types/modules';
import { EMPTY_PATTERNS, EMPTY_HISTORY, COL_WIDTH, ROW_HEIGHT, NODE_W, NODE_H, PAD_X, PAD_Y } from './constants';
import type { LayerId } from './constants';
import type { NexusNode, NexusEdge } from './types';
import { getNodeCenter, computeGenreCoverage } from './helpers';

export function useNexusView() {
  // State
  const [statusMap, setStatusMap] = useState<Map<string, string>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [hoveredModule, setHoveredModule] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [activeLayers, setActiveLayers] = useState<Set<LayerId>>(new Set(['patterns', 'builds']));

  // Stores
  const patterns = usePatternLibraryStore((s) => s.patterns) ?? EMPTY_PATTERNS;
  const checklistProgress = useModuleStore((s) => s.checklistProgress);
  const moduleHealth = useModuleStore((s) => s.moduleHealth);
  const moduleHistory = useModuleStore((s) => s.moduleHistory);
  const lastScan = useEvaluatorStore((s) => s.lastScan);
  const sessions = useCLIPanelStore((s) => s.sessions);

  // Fetch feature statuses. Route returns apiSuccess({ statuses }); tryApiFetch
  // unwraps the envelope so the status map isn't silently empty (which previously
  // left every cross-module dependency edge uncolored / unblocked).
  const fetchStatuses = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await tryApiFetch<{ statuses: { moduleId: string; featureName: string; status: string }[] }>('/api/feature-matrix/all-statuses');
      if (result.ok) {
        const map = new Map<string, string>();
        for (const row of result.data.statuses ?? []) {
          map.set(`${row.moduleId}::${row.featureName}`, row.status);
        }
        setStatusMap(map);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchStatuses(); }, [fetchStatuses]);

  // Build dep map
  const depMap = useMemo(() => {
    const base = buildDependencyMap();
    return computeBlockers(base, statusMap);
  }, [statusMap]);

  // Genre coverage
  const genreCoverage = useMemo(() => computeGenreCoverage(), []);

  // Compute pattern stats per module
  const patternStats = useMemo(() => {
    const stats: Record<string, { rate: number; count: number }> = {};
    const grouped: Record<string, ImplementationPattern[]> = {};
    for (const p of patterns) {
      if (!grouped[p.moduleId]) grouped[p.moduleId] = [];
      grouped[p.moduleId].push(p);
    }
    for (const [moduleId, pats] of Object.entries(grouped)) {
      const avgRate = pats.reduce((s, p) => s + p.successRate, 0) / pats.length;
      stats[moduleId] = { rate: avgRate, count: pats.length };
    }
    return stats;
  }, [patterns]);

  // Session stats per module from CLI store
  const sessionStats = useMemo(() => {
    const stats: Record<string, { count: number; lastSuccess: boolean | null }> = {};
    for (const session of Object.values(sessions)) {
      if (!session.moduleId) continue;
      const existing = stats[session.moduleId];
      if (!existing) {
        stats[session.moduleId] = { count: 1, lastSuccess: session.lastTaskSuccess };
      } else {
        existing.count++;
        if (session.lastActivityAt > 0) {
          existing.lastSuccess = session.lastTaskSuccess;
        }
      }
    }
    return stats;
  }, [sessions]);

  // Build nodes
  const nodes: NexusNode[] = useMemo(() => {
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

      const ps = patternStats[moduleId];
      const ss = sessionStats[moduleId];
      const health = moduleHealth[moduleId];
      const moduleDef = SUB_MODULE_MAP[moduleId as SubModuleId];
      const { done: checklistDone, total: checklistTotal } = countChecklist(
        moduleDef ?? {},
        checklistProgress[moduleId],
      );

      // Build failure: check if last scan has critical recs for this module
      const hasBuildFailure = lastScan?.recommendations.some(
        (r) => r.moduleId === moduleId && r.priority === 'critical',
      ) ?? false;

      // Session average duration from module history
      const history = moduleHistory[moduleId] ?? EMPTY_HISTORY;
      const avgDuration = history.length > 0
        ? history.reduce((s, h) => s + (h.duration ?? 0), 0) / history.length
        : 0;

      return {
        moduleId: moduleId as SubModuleId,
        label: MODULE_LABELS[moduleId] ?? moduleId,
        cx: center.x,
        cy: center.y,
        featureCount: features.length,
        implementedCount,
        blockedCount,
        patternSuccessRate: ps?.rate ?? null,
        patternCount: ps?.count ?? 0,
        hasBuildFailure,
        sessionCount: ss?.count ?? 0,
        avgDurationMs: avgDuration,
        lastTaskSuccess: ss?.lastSuccess ?? null,
        genreItemCount: genreCoverage[moduleId] ?? 0,
        checklistTotal,
        checklistDone,
        healthScore: health?.score ?? 0,
        healthStatus: health?.status ?? 'not-started',
      };
    });
  }, [depMap, statusMap, patternStats, sessionStats, moduleHealth, checklistProgress, moduleHistory, lastScan, genreCoverage]);

  // Build edges
  const edges: NexusEdge[] = useMemo(() => {
    const edgeMap = new Map<string, { count: number; hasBlockers: boolean }>();
    for (const [moduleId, features] of Object.entries(MODULE_FEATURE_DEFINITIONS)) {
      for (const feat of features) {
        const key = `${moduleId}::${feat.featureName}`;
        const info = depMap.get(key);
        if (!info) continue;
        for (const dep of info.deps) {
          if (dep.moduleId === moduleId) continue;
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

  // Layer toggle
  const toggleLayer = (id: LayerId) => {
    setActiveLayers((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const svgWidth = PAD_X * 2 + 3 * COL_WIDTH + NODE_W;
  const svgHeight = PAD_Y * 2 + 2 * ROW_HEIGHT + NODE_H;
  const highlightModule = hoveredModule ?? selectedModule;

  // Selected module data for deep-dive
  const selectedNode = nodes.find((n) => n.moduleId === selectedModule);

  return {
    isLoading,
    selectedModule,
    setSelectedModule,
    setHoveredModule,
    zoom,
    setZoom,
    activeLayers,
    toggleLayer,
    patterns,
    moduleHistory,
    lastScan,
    nodes,
    edges,
    svgWidth,
    svgHeight,
    highlightModule,
    selectedNode,
  };
}
