import { useState, useMemo } from 'react';
import { buildModuleTopology, TOPOLOGY_ROOMY } from '@/lib/topology/moduleGraph';
import { useFeatureStatuses } from '@/hooks/useFeatureStatuses';
import { SUB_MODULE_MAP } from '@/lib/module-registry';
import { countChecklist } from '@/lib/checklist-progress';
import { useModuleStore } from '@/stores/moduleStore';
import { projectNexusSignals } from '@/lib/evaluator/nexus-signals';
import type { LayerId } from './constants';
import type { NexusNode } from './types';
import { computeGenreCoverage } from './helpers';
import { useNexusSignals } from './useNexusSignals';

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

  // Checklist progress is the one client store read here (the checklist writes it).
  // Every overlay signal comes from a durable table via useNexusSignals.
  const checklistProgress = useModuleStore((s) => s.checklistProgress);
  const signals = useNexusSignals(selectedModule);

  // Nodes (counts + placement), cross-module edges and viewport: the ONE
  // module-topology projection shared with DependencyGraph. This view layers its
  // pattern / findings / session / genre overlays onto the same nodes.
  const topology = useMemo(() => buildModuleTopology(statusMap, TOPOLOGY_ROOMY), [statusMap]);
  const { edges } = topology;

  // Genre coverage
  const genreCoverage = useMemo(() => computeGenreCoverage(), []);

  const baseNodes = useMemo(() => {
    return topology.nodes.map((t) => {
      const { moduleId } = t;
      const { done: checklistDone, total: checklistTotal } = countChecklist(
        SUB_MODULE_MAP[moduleId] ?? {},
        checklistProgress[moduleId],
      );
      return {
        moduleId,
        label: t.label,
        cx: t.cx,
        cy: t.cy,
        featureCount: t.featureCount,
        implementedCount: t.implementedCount,
        blockedCount: t.blockedCount,
        genreItemCount: genreCoverage[moduleId] ?? 0,
        checklistTotal,
        checklistDone,
      };
    });
  }, [topology, checklistProgress, genreCoverage]);

  // Overlay signals: ONE pure projection over the durable sources.
  const projection = useMemo(
    () => projectNexusSignals(baseNodes, signals.sources),
    [baseNodes, signals.sources],
  );
  const nodes: NexusNode[] = projection.nodes;

  // Layer toggle
  const toggleLayer = (id: LayerId) => {
    setActiveLayers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const retryLayer = (id: LayerId) => {
    if (id === 'sessions') signals.retryRuns();
    else if (id === 'builds') signals.retryFindings();
    else if (id === 'patterns') signals.retryPatterns();
  };

  // Why a layer's source could not be read (null unless that source failed).
  const layerError = (id: LayerId): string | null => {
    const { runs, findings, patterns } = signals.sources;
    const source = id === 'sessions' ? runs : id === 'builds' ? findings : id === 'patterns' ? patterns : null;
    return source?.state === 'failed' ? source.error : null;
  };

  const { width: svgWidth, height: svgHeight } = topology;
  const highlightModule = hoveredModule ?? selectedModule;

  // Selected module data for deep-dive
  const selectedNode = nodes.find((n) => n.moduleId === selectedModule);
  const selectedPatterns = useMemo(
    () => (signals.patterns.state === 'ready' ? signals.patterns.data.filter((p) => p.moduleId === selectedModule) : []),
    [signals.patterns, selectedModule],
  );
  const selectedRecommendations = useMemo(
    () => (selectedModule ? projection.recommendationsByModule.get(selectedModule) ?? [] : []),
    [projection, selectedModule],
  );

  return {
    isLoading,
    selectedModule,
    setSelectedModule,
    setHoveredModule,
    zoom,
    setZoom,
    activeLayers,
    toggleLayer,
    layerState: projection.layerState,
    retryLayer,
    layerError,
    nodes,
    edges,
    svgWidth,
    svgHeight,
    highlightModule,
    selectedNode,
    selectedPatterns,
    selectedRecommendations,
    moduleSessions: signals.moduleSessions,
  };
}
