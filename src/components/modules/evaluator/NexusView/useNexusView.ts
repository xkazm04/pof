import { useState, useMemo } from 'react';
import { buildModuleTopology, TOPOLOGY_ROOMY } from '@/lib/topology/moduleGraph';
import { useFeatureStatuses } from '@/hooks/useFeatureStatuses';
import { SUB_MODULE_MAP } from '@/lib/module-registry';
import { countChecklist } from '@/lib/checklist-progress';
import { useModuleStore } from '@/stores/moduleStore';
import { usePatternLibraryStore } from '@/stores/patternLibraryStore';
import { useEvaluatorStore } from '@/stores/evaluatorStore';
import { useCLIPanelStore } from '@/components/cli/store/cliPanelStore';
import type { ImplementationPattern } from '@/types/pattern-library';
import { EMPTY_PATTERNS, EMPTY_HISTORY } from './constants';
import type { LayerId } from './constants';
import type { NexusNode } from './types';
import { computeGenreCoverage } from './helpers';

export function useNexusView() {
  // Feature statuses come from the ONE shared all-statuses path (this view and
  // the other Evaluator dashboards mount together; each used to run the same
  // full-table scan). Only the first load shows the spinner.
  const { statusMap, isLoading: statusesLoading, loaded: statusesLoaded } = useFeatureStatuses();
  const isLoading = statusesLoading && !statusesLoaded;

  // State
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

  // Nodes (counts + placement), cross-module edges and viewport: the ONE
  // module-topology projection shared with DependencyGraph. This view layers its
  // pattern / build / session / genre overlays onto the same nodes.
  const topology = useMemo(() => buildModuleTopology(statusMap, TOPOLOGY_ROOMY), [statusMap]);
  const { edges } = topology;

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
    return topology.nodes.map((t) => {
      const { moduleId } = t;
      const ps = patternStats[moduleId];
      const ss = sessionStats[moduleId];
      const health = moduleHealth[moduleId];
      const moduleDef = SUB_MODULE_MAP[moduleId];
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
        moduleId,
        label: t.label,
        cx: t.cx,
        cy: t.cy,
        featureCount: t.featureCount,
        implementedCount: t.implementedCount,
        blockedCount: t.blockedCount,
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
  }, [topology, patternStats, sessionStats, moduleHealth, checklistProgress, moduleHistory, lastScan, genreCoverage]);

  // Layer toggle
  const toggleLayer = (id: LayerId) => {
    setActiveLayers((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const { width: svgWidth, height: svgHeight } = topology;
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
