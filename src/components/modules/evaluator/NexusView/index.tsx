'use client';

import { AnimatePresence } from 'framer-motion';
import {
  Loader2, ZoomIn, ZoomOut, Maximize2,
  Network, Eye, EyeOff, RefreshCw,
} from 'lucide-react';
import { STATUS_BLOCKER, MODULE_COLORS, ACCENT_VIOLET } from '@/lib/chart-colors';
import type { SourceStatus } from '@/lib/evaluator/nexus-signals';
import { LAYERS } from './constants';
import type { LayerConfig } from './constants';
import { InlineErrorRetry } from '@/components/modules/shared/InlineErrorRetry';
import { useNexusView } from './useNexusView';
import { NexusGraph, PATTERN_HEAT_BANDS } from './NexusGraph';
import { NodeDeepDivePanel } from './NodeDeepDivePanel';

// ─── Component ─────────────────────────────────────────────────────────────

export function NexusView() {
  const {
    isLoading,
    statusError,
    retryStatuses,
    selectedModule,
    setSelectedModule,
    setHoveredModule,
    zoom,
    setZoom,
    activeLayers,
    toggleLayer,
    layerState,
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
    moduleSessions,
  } = useNexusView();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16" role="status" aria-live="polite">
        <Loader2 className="w-5 h-5 animate-spin text-text-muted" />
        <span className="text-xs text-text-muted">Loading feature statuses…</span>
      </div>
    );
  }

  // Same rule as DependencyGraph / FeatureConstellation: a failed status read is not
  // drawn — every node would read "0/N", i.e. "nothing implemented", not "nothing loaded".
  if (statusError) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Network className="w-4 h-4" style={{ color: ACCENT_VIOLET }} />
          <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
            Nexus Intelligence Map
          </span>
        </div>
        <InlineErrorRetry message={`Could not load feature statuses: ${statusError}`} onRetry={retryStatuses} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header + Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Network className="w-4 h-4" style={{ color: ACCENT_VIOLET }} />
          <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
            Nexus Intelligence Map
          </span>
          <span className="text-2xs text-text-muted">
            {nodes.length} modules · {edges.length} connections
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Layer toggles — each reads its source's state; a failed source is unavailable + Retry, never an empty layer */}
          {LAYERS.map((layer) => (
            <LayerToggle
              key={layer.id}
              layer={layer}
              active={activeLayers.has(layer.id)}
              state={layerState[layer.id]}
              error={layerError(layer.id)}
              onToggle={() => toggleLayer(layer.id)}
              onRetry={() => retryLayer(layer.id)}
            />
          ))}

          {/* Zoom */}
          <div className="flex items-center gap-0.5 ml-2">
            <button
              onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))}
              disabled={zoom <= 0.5}
              aria-label="Zoom out"
              className="focus-ring p-1 rounded-md text-text-muted hover:text-text hover:bg-border transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <ZoomOut className="w-3 h-3" />
            </button>
            <span className="text-2xs text-text-muted w-8 text-center" role="status" aria-live="polite">{Math.round(zoom * 100)}%</span>
            <button
              onClick={() => setZoom((z) => Math.min(1.5, z + 0.1))}
              disabled={zoom >= 1.5}
              aria-label="Zoom in"
              className="focus-ring p-1 rounded-md text-text-muted hover:text-text hover:bg-border transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <ZoomIn className="w-3 h-3" />
            </button>
            <button
              onClick={() => setZoom(1)}
              aria-label="Reset zoom to 100%"
              className="focus-ring p-1 rounded-md text-text-muted hover:text-text hover:bg-border transition-colors"
            >
              <Maximize2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* SVG Graph */}
      <NexusGraph
        edges={edges}
        nodes={nodes}
        highlightModule={highlightModule}
        activeLayers={activeLayers}
        selectedModule={selectedModule}
        setSelectedModule={setSelectedModule}
        setHoveredModule={setHoveredModule}
        zoom={zoom}
        svgWidth={svgWidth}
        svgHeight={svgHeight}
      />

      {/* Legend */}
      <div className="flex items-center gap-4 text-2xs text-text-muted flex-wrap">
        <span className="flex items-center gap-1.5">
          <span className="w-5 h-px bg-text-muted" /> Dependency
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-5 border-t border-dashed" style={{ borderColor: STATUS_BLOCKER }} /> Blocker
        </span>
        {activeLayers.has('patterns') && (
          <span className="flex items-center gap-3">
            {PATTERN_HEAT_BANDS.map((b) => (
              <span key={b.min} className="flex items-center gap-1.5">
                <span data-pattern-legend-swatch="" className="w-1.5 h-4 rounded-sm" style={{ backgroundColor: b.color }} /> Pattern success {b.label}
              </span>
            ))}
          </span>
        )}
        {activeLayers.has('builds') && (
          <span className="flex items-center gap-1.5">
            <span
              className="w-3 h-3 rounded border opacity-60"
              style={{ borderColor: MODULE_COLORS.evaluator, boxShadow: `0 0 4px ${MODULE_COLORS.evaluator}` }}
            /> Critical findings (newest deep eval)
          </span>
        )}
        {activeLayers.has('genre') && (
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded border opacity-60" style={{ borderColor: ACCENT_VIOLET, boxShadow: `0 0 4px ${ACCENT_VIOLET}` }} /> Genre feature
          </span>
        )}
      </div>

      {/* Deep-dive panel */}
      <AnimatePresence>
        {selectedModule && selectedNode && (
          <NodeDeepDivePanel
            node={selectedNode}
            patterns={selectedPatterns}
            recommendations={selectedRecommendations}
            sessions={moduleSessions}
            onClose={() => setSelectedModule(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Layer toggle ──────────────────────────────────────────────────────────

function LayerToggle({
  layer, active, state, error, onToggle, onRetry,
}: {
  layer: LayerConfig;
  active: boolean;
  state: SourceStatus;
  error: string | null;
  onToggle: () => void;
  onRetry: () => void;
}) {
  const Icon = layer.icon;
  if (state === 'failed') {
    return (
      <span className="flex items-center gap-1 px-2 py-1 rounded-md text-2xs font-medium border border-border bg-surface-deep text-text-muted">
        <button disabled aria-label={`${layer.label} — unavailable`} title={error ?? undefined} className="flex items-center gap-1 cursor-not-allowed">
          <Icon className="w-2.5 h-2.5" />
          {layer.label}
          <span style={{ color: STATUS_BLOCKER }}>unavailable</span>
        </button>
        <button onClick={onRetry} aria-label={`Retry ${layer.label}`} className="focus-ring flex items-center gap-0.5 hover:text-text transition-colors">
          <RefreshCw className="w-2.5 h-2.5" /> Retry
        </button>
      </span>
    );
  }
  return (
    <button
      onClick={onToggle}
      aria-pressed={active}
      aria-busy={state === 'loading'}
      className={`focus-ring flex items-center gap-1 px-2 py-1 rounded-md text-2xs font-medium border transition-colors ${
        active
          ? 'border-border-bright bg-surface text-text'
          : 'border-border bg-surface-deep text-text-muted hover:text-text'
      }`}
    >
      <Icon className="w-2.5 h-2.5" style={{ color: active ? layer.color : undefined }} />
      {layer.label}
      {state === 'loading'
        ? <Loader2 className="w-2.5 h-2.5 animate-spin" aria-label="loading" />
        : active ? <Eye className="w-2.5 h-2.5" /> : <EyeOff className="w-2.5 h-2.5 opacity-40" />}
    </button>
  );
}
