'use client';

import { withOpacity, OVERLAY_WHITE, OPACITY_15, OPACITY_12, OPACITY_8, OPACITY_5, OPACITY_50, OPACITY_25, OPACITY_10, OPACITY_30, OPACITY_40, OPACITY_80 } from '@/lib/chart-colors';
import type { GASGraphNode, GraphWire } from '../types';
import { NODE_W_GRAPH, NODE_H_GRAPH, PIN_R } from '../types';

export function NodeLayer({
  nodes, wires, resolvePos, getPinPos,
  draggingNodeId, hoveredNode, selectedNode, connectedWires,
  setHoveredNode, setSelectedNode, dragMoved, handleNodeDragStart, setDragFromPin,
}: {
  nodes: GASGraphNode[];
  wires: GraphWire[];
  resolvePos: (node: GASGraphNode) => { x: number; y: number };
  getPinPos: (node: GASGraphNode, pinId: string) => { x: number; y: number };
  draggingNodeId: string | null;
  hoveredNode: string | null;
  selectedNode: string | null;
  connectedWires: Set<string>;
  setHoveredNode: (id: string | null) => void;
  setSelectedNode: (idOrFn: string | null | ((prev: string | null) => string | null)) => void;
  dragMoved: React.MutableRefObject<boolean>;
  handleNodeDragStart: (e: React.MouseEvent, nodeId: string) => void;
  setDragFromPin: (v: { nodeId: string; pinId: string } | null) => void;
}) {
  return (
    <>
      {nodes.map((node) => {
        const { x: nx, y: ny } = resolvePos(node);
        const isDragging = draggingNodeId === node.id;
        const isHovered = hoveredNode === node.id;
        const isSelected = selectedNode === node.id;
        const hasConnections = wires.some(w => w.fromNode === node.id || w.toNode === node.id);
        const sideCount = (side: 'left' | 'right') => node.pins.filter(p => p.side === side).length;
        const nodeH = Math.max(NODE_H_GRAPH, (Math.max(sideCount('left'), sideCount('right')) + 1) * 14 + 10);
        const dimmed = (hoveredNode || selectedNode) && !isHovered && !isSelected && !connectedWires.has(
          wires.find(w => w.fromNode === node.id || w.toNode === node.id)?.id ?? ''
        );

        const nodeIsConnected = wires.some(w =>
          (w.fromNode === node.id || w.toNode === node.id) && connectedWires.has(w.id)
        );

        const effectiveOpacity = dimmed && !nodeIsConnected ? 0.25 : 1;

        return (
          <g
            key={node.id}
            className={isDragging ? 'cursor-grabbing' : 'cursor-grab'}
            onMouseEnter={() => { if (!draggingNodeId) setHoveredNode(node.id); }}
            onMouseLeave={() => { if (!draggingNodeId) setHoveredNode(null); }}
            onClick={() => { if (!dragMoved.current) setSelectedNode(prev => prev === node.id ? null : node.id); }}
            onMouseDown={(e) => {
              const target = e.target as SVGElement;
              if (target.tagName === 'circle') return;
              handleNodeDragStart(e, node.id);
            }}
            opacity={effectiveOpacity}
            style={{ transition: isDragging ? 'none' : 'opacity 0.2s' }}
          >
            {/* Node body */}
            <rect
              x={nx} y={ny}
              width={NODE_W_GRAPH} height={nodeH}
              rx={6}
              fill={isDragging ? `${withOpacity(node.color, OPACITY_15)}` : isSelected ? `${withOpacity(node.color, OPACITY_12)}` : isHovered ? `${withOpacity(node.color, OPACITY_8)}` : `${withOpacity(node.color, OPACITY_5)}`}
              stroke={isDragging ? node.color : isSelected ? node.color : isHovered ? `${withOpacity(node.color, OPACITY_50)}` : `${withOpacity(node.color, OPACITY_25)}`}
              strokeWidth={isDragging ? 2 : isSelected ? 1.5 : 1}
            />

            {/* Type indicator strip */}
            <rect
              x={nx} y={ny}
              width={4} height={nodeH}
              rx={2}
              fill={node.color}
              opacity={isSelected || isDragging ? 0.8 : 0.5}
            />

            {/* Node label */}
            <text
              x={nx + 12} y={ny + 12}
              fill={isSelected || isHovered || isDragging ? node.color : withOpacity(OVERLAY_WHITE, OPACITY_80)}
              fontSize={node.type === 'tag-rule' ? 7 : 8.5}
              fontFamily="monospace"
              fontWeight="bold"
              className="pointer-events-none"
            >
              {node.label.length > 18 ? node.label.slice(0, 17) + '…' : node.label}
            </text>

            {/* Type badge */}
            <text
              x={nx + NODE_W_GRAPH - 4} y={ny + 11}
              fill={node.color} fontSize={6} fontFamily="monospace"
              textAnchor="end" opacity={0.5}
              className="pointer-events-none"
            >
              {node.type === 'attribute' ? 'ATTR' : node.type === 'effect' ? 'GE' : 'TAG'}
            </text>

            {/* Pins */}
            {node.pins.map((pin) => {
              const pos = getPinPos(node, pin.id);
              const isConnected = hasConnections && wires.some(
                w => (w.fromNode === node.id && w.fromPin === pin.id) || (w.toNode === node.id && w.toPin === pin.id)
              );
              const wireColor = wires.find(
                w => (w.fromNode === node.id && w.fromPin === pin.id) || (w.toNode === node.id && w.toPin === pin.id)
              )?.color ?? node.color;

              return (
                <g key={pin.id}>
                  <circle
                    cx={pos.x} cy={pos.y} r={PIN_R}
                    fill={isConnected ? wireColor : withOpacity(OVERLAY_WHITE, OPACITY_10)}
                    stroke={isConnected ? wireColor : withOpacity(OVERLAY_WHITE, OPACITY_30)}
                    strokeWidth={1}
                    className="pointer-events-auto"
                    style={{ cursor: 'crosshair' }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      setDragFromPin({ nodeId: node.id, pinId: pin.id });
                    }}
                    onMouseUp={(e) => {
                      e.stopPropagation();
                      setDragFromPin(null);
                    }}
                  />
                  {pin.label && (
                    <text
                      x={pin.side === 'left' ? pos.x + 6 : pos.x - 6}
                      y={pos.y + 3}
                      fill={withOpacity(OVERLAY_WHITE, OPACITY_40)} fontSize={6} fontFamily="monospace"
                      textAnchor={pin.side === 'left' ? 'start' : 'end'}
                      className="pointer-events-none"
                    >
                      {pin.label.length > 12 ? pin.label.slice(0, 11) + '…' : pin.label}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Selection glow */}
            {(isSelected || isDragging) && (
              <rect
                x={nx - 2} y={ny - 2}
                width={NODE_W_GRAPH + 4} height={nodeH + 4}
                rx={8} fill="none" stroke={node.color} strokeWidth={1}
                opacity={0.3} style={{ filter: 'blur(3px)' }}
                className="pointer-events-none"
              />
            )}
          </g>
        );
      })}
    </>
  );
}
