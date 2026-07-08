'use client';

import {
  STATUS_WARNING, STATUS_ERROR,
  ACCENT_CYAN, ACCENT_VIOLET, OVERLAY_WHITE,
  withOpacity, OPACITY_2, OPACITY_4, OPACITY_50,
} from '@/lib/chart-colors';
import type { EditorAttribute, EditorEffect, TagRule } from '@/lib/gas-codegen';
import type { AttrRelationship } from '../types';
import { NODE_W_GRAPH } from '../types';
import { useWiringGraphEditor } from './useWiringGraphEditor';
import { WireLayer } from './WireLayer';
import { NodeLayer } from './NodeLayer';
import { StatsBar } from './StatsBar';
import { DetailPanel } from './DetailPanel';

export function WiringGraphEditor({
  attributes, effects, tagRules, relationships, onSelectItem,
}: {
  attributes: EditorAttribute[];
  effects: EditorEffect[];
  tagRules: TagRule[];
  relationships: AttrRelationship[];
  onSelectItem?: (label: string | null) => void;
}) {
  const {
    prefersReduced,
    hoveredWire, setHoveredWire,
    hoveredNode, setHoveredNode,
    selectedNode, setSelectedNode,
    dragFromPin, setDragFromPin,
    nodeOverrides, setNodeOverrides,
    draggingNodeId,
    dragMoved,
    svgRef,
    nodes, wires,
    resolvePos, getPinPos,
    handleNodeDragStart, handleSvgMouseMove, handleSvgMouseUp,
    connectedWires,
    svgW, maxY,
    wirePath,
    selectedDetail,
  } = useWiringGraphEditor({ attributes, effects, tagRules, relationships, onSelectItem });

  return (
    <div className="space-y-2">
      <div className="text-2xs text-text-muted">
        Visual wiring graph of the GAS data pipeline. Drag nodes to reposition. Click to inspect connections.
      </div>

      {/* Column headers */}
      <div className="flex items-center justify-between px-2 text-2xs font-mono uppercase tracking-wider text-text-muted">
        <span style={{ width: NODE_W_GRAPH, color: ACCENT_VIOLET }}>Attributes</span>
        <span style={{ color: STATUS_WARNING }}>Effects</span>
        <span style={{ color: STATUS_ERROR }}>Tag Rules</span>
      </div>

      {/* Graph canvas */}
      <div className="relative overflow-x-auto custom-scrollbar rounded-lg border border-border/30 bg-[#060612]">
        <svg
          ref={svgRef}
          width={svgW} height={maxY} viewBox={`0 0 ${svgW} ${maxY}`}
          className="overflow-visible"
          style={draggingNodeId ? { userSelect: 'none' } : undefined}
          onMouseMove={handleSvgMouseMove}
          onMouseUp={handleSvgMouseUp}
          onMouseLeave={handleSvgMouseUp}
        >
          <defs>
            <marker id="gas-flow-arrow" viewBox="0 0 6 4" refX="6" refY="2" markerWidth="5" markerHeight="4" orient="auto">
              <path d="M0,0 L6,2 L0,4" fill={withOpacity(OVERLAY_WHITE, OPACITY_50)} />
            </marker>
          </defs>

          {/* Grid background */}
          <pattern id="gas-grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke={withOpacity(OVERLAY_WHITE, OPACITY_2)} strokeWidth="0.5" />
          </pattern>
          <rect width="100%" height="100%" fill="url(#gas-grid)" />

          {/* Column dividers */}
          <line x1={190} y1={0} x2={190} y2={maxY} stroke={withOpacity(OVERLAY_WHITE, OPACITY_4)} strokeWidth={1} strokeDasharray="4 4" />
          <line x1={420} y1={0} x2={420} y2={maxY} stroke={withOpacity(OVERLAY_WHITE, OPACITY_4)} strokeWidth={1} strokeDasharray="4 4" />

          {/* Wires */}
          <WireLayer
            wires={wires} nodes={nodes} getPinPos={getPinPos} wirePath={wirePath}
            hoveredWire={hoveredWire} setHoveredWire={setHoveredWire} connectedWires={connectedWires}
            hoveredNode={hoveredNode} selectedNode={selectedNode} prefersReduced={prefersReduced}
          />

          {/* Drag-in-progress wire */}
          {dragFromPin && (
            <line
              x1={0} y1={0} x2={0} y2={0}
              stroke={ACCENT_CYAN} strokeWidth={1.5} strokeDasharray="4 3" opacity={0.6}
              className="pointer-events-none"
            />
          )}

          {/* Nodes */}
          <NodeLayer
            nodes={nodes} wires={wires} resolvePos={resolvePos} getPinPos={getPinPos}
            draggingNodeId={draggingNodeId} hoveredNode={hoveredNode} selectedNode={selectedNode} connectedWires={connectedWires}
            setHoveredNode={setHoveredNode} setSelectedNode={setSelectedNode} dragMoved={dragMoved}
            handleNodeDragStart={handleNodeDragStart} setDragFromPin={setDragFromPin}
          />
        </svg>
      </div>

      {/* Stats bar */}
      <StatsBar nodes={nodes} wires={wires} nodeOverrides={nodeOverrides} setNodeOverrides={setNodeOverrides} />

      {/* Selected node detail panel */}
      <DetailPanel selectedDetail={selectedDetail} nodes={nodes} prefersReduced={prefersReduced} />
    </div>
  );
}
