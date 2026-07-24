'use client';

import { Link2, Loader2 } from 'lucide-react';
import { MODULE_COLORS as CHART_MODULE_COLORS } from '@/lib/chart-colors';
import { EmptyState } from '@/components/ui/EmptyState';
import { InlineErrorRetry } from '@/components/modules/shared/InlineErrorRetry';
import { useDependencyGraph } from './useDependencyGraph';
import { GraphControls } from './GraphControls';
import { GraphCanvas } from './GraphCanvas';
import { GraphLegend } from './GraphLegend';
import { SelectedModuleDetail } from './SelectedModuleDetail';
import type { DependencyGraphProps } from './types';

export function DependencyGraph({ onNavigateTab }: DependencyGraphProps) {
  const {
    statusMap,
    isLoading,
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
  } = useDependencyGraph();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16" role="status" aria-live="polite">
        <Loader2 className="w-5 h-5 animate-spin text-text-muted" />
        <span className="text-xs text-text-muted">Loading feature statuses…</span>
      </div>
    );
  }

  // Distinct from the empty state below: the request failed, so we do NOT know
  // whether feature data exists. Say so, and offer a retry.
  if (error) {
    return (
      <InlineErrorRetry
        message={`Could not load feature statuses: ${error}`}
        onRetry={refetch}
      />
    );
  }

  if (statusMap.size === 0) {
    return (
      <EmptyState
        icon={Link2}
        title="No feature data yet"
        description="Review your module features first so the dependency graph can show implementation status and blockers across modules."
        iconColor={CHART_MODULE_COLORS.evaluator}
        action={onNavigateTab ? {
          label: 'Review Features',
          onClick: () => onNavigateTab('features'),
          color: CHART_MODULE_COLORS.evaluator,
        } : undefined}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <GraphControls edgeCount={edges.length} nodeCount={nodes.length} zoom={zoom} setZoom={setZoom} />

      {/* Graph */}
      <GraphCanvas
        svgRef={svgRef}
        svgWidth={svgWidth}
        svgHeight={svgHeight}
        zoom={zoom}
        edges={edges}
        nodes={nodes}
        highlightModule={highlightModule}
        selectedModule={selectedModule}
        setSelectedModule={setSelectedModule}
        setHoveredModule={setHoveredModule}
        bridgeConnected={bridgeConnected}
        moduleCrossRefCounts={moduleCrossRefCounts}
      />

      {/* Legend */}
      <GraphLegend bridgeConnected={bridgeConnected} manifestCrossRefs={manifestCrossRefs} />

      {/* Selected module detail */}
      <SelectedModuleDetail selectedModule={selectedModule} selectedDetails={selectedDetails} />
    </div>
  );
}
