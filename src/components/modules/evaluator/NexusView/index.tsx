'use client';

import { AnimatePresence } from 'framer-motion';
import {
  Loader2, ZoomIn, ZoomOut, Maximize2,
  Network, Eye, EyeOff,
} from 'lucide-react';
import { STATUS_BLOCKER } from '@/lib/chart-colors';
import { LAYERS, EMPTY_HISTORY } from './constants';
import { useNexusView } from './useNexusView';
import { NexusGraph } from './NexusGraph';
import { NodeDeepDivePanel } from './NodeDeepDivePanel';

// ─── Component ─────────────────────────────────────────────────────────────

export function NexusView() {
  const {
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
  } = useNexusView();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-text-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header + Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Network className="w-4 h-4 text-[#a78bfa]" />
          <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
            Nexus Intelligence Map
          </span>
          <span className="text-2xs text-text-muted">
            {nodes.length} modules · {edges.length} connections
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Layer toggles */}
          {LAYERS.map((layer) => {
            const active = activeLayers.has(layer.id);
            const Icon = layer.icon;
            return (
              <button
                key={layer.id}
                onClick={() => toggleLayer(layer.id)}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-2xs font-medium border transition-colors ${
                  active
                    ? 'border-border-bright bg-surface text-text'
                    : 'border-border bg-surface-deep text-text-muted hover:text-text'
                }`}
              >
                <Icon className="w-2.5 h-2.5" style={{ color: active ? layer.color : undefined }} />
                {layer.label}
                {active ? <Eye className="w-2.5 h-2.5" /> : <EyeOff className="w-2.5 h-2.5 opacity-40" />}
              </button>
            );
          })}

          {/* Zoom */}
          <div className="flex items-center gap-0.5 ml-2">
            <button onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))} className="p-1 rounded-md text-text-muted hover:text-text hover:bg-border transition-colors">
              <ZoomOut className="w-3 h-3" />
            </button>
            <span className="text-2xs text-text-muted w-8 text-center">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom((z) => Math.min(1.5, z + 0.1))} className="p-1 rounded-md text-text-muted hover:text-text hover:bg-border transition-colors">
              <ZoomIn className="w-3 h-3" />
            </button>
            <button onClick={() => setZoom(1)} className="p-1 rounded-md text-text-muted hover:text-text hover:bg-border transition-colors">
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
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-4 rounded-sm bg-[#4ade80]" /> Pattern success
          </span>
        )}
        {activeLayers.has('builds') && (
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded border border-[#ef4444] opacity-60" style={{ boxShadow: '0 0 4px #ef4444' }} /> Build failure
          </span>
        )}
        {activeLayers.has('genre') && (
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded border border-[#a78bfa] opacity-60" style={{ boxShadow: '0 0 4px #a78bfa' }} /> Genre feature
          </span>
        )}
      </div>

      {/* Deep-dive panel */}
      <AnimatePresence>
        {selectedModule && selectedNode && (
          <NodeDeepDivePanel
            node={selectedNode}
            patterns={patterns.filter((p) => p.moduleId === selectedModule)}
            recommendations={lastScan?.recommendations.filter((r) => r.moduleId === selectedModule) ?? []}
            history={(moduleHistory[selectedModule] ?? EMPTY_HISTORY) as { id: string; prompt: string; status: string; timestamp: number; duration?: number }[]}
            onClose={() => setSelectedModule(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
