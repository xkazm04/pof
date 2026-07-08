'use client';

import type { GASGraphNode, GraphWire } from '../types';

export function WireLayer({
  wires, nodes, getPinPos, wirePath,
  hoveredWire, setHoveredWire, connectedWires,
  hoveredNode, selectedNode, prefersReduced,
}: {
  wires: GraphWire[];
  nodes: GASGraphNode[];
  getPinPos: (node: GASGraphNode, pinId: string) => { x: number; y: number };
  wirePath: (fromPos: { x: number; y: number }, toPos: { x: number; y: number }) => string;
  hoveredWire: string | null;
  setHoveredWire: (id: string | null) => void;
  connectedWires: Set<string>;
  hoveredNode: string | null;
  selectedNode: string | null;
  prefersReduced: boolean | null;
}) {
  return (
    <>
      {wires.map((wire) => {
        const fromNode = nodes.find(n => n.id === wire.fromNode);
        const toNode = nodes.find(n => n.id === wire.toNode);
        if (!fromNode || !toNode) return null;

        const fromPos = getPinPos(fromNode, wire.fromPin);
        const toPos = getPinPos(toNode, wire.toPin);
        const path = wirePath(fromPos, toPos);
        const isHighlighted = hoveredWire === wire.id || connectedWires.has(wire.id);
        const opacity = (hoveredNode || selectedNode) ? (isHighlighted ? 0.9 : 0.12) : 0.5;

        return (
          <g key={wire.id}>
            {/* Invisible hover target */}
            <path
              d={path} fill="none" stroke="transparent" strokeWidth={10}
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHoveredWire(wire.id)}
              onMouseLeave={() => setHoveredWire(null)}
            />
            {/* Glow */}
            {isHighlighted && (
              <path
                d={path} fill="none" stroke={wire.color} strokeWidth={4}
                opacity={0.25} style={{ filter: 'blur(3px)' }}
                className="pointer-events-none"
              />
            )}
            {/* Wire */}
            <path
              d={path} fill="none"
              stroke={wire.color}
              strokeWidth={isHighlighted ? 2 : 1.2}
              opacity={opacity}
              strokeDasharray={wire.animated ? '6 4' : undefined}
              markerEnd="url(#gas-flow-arrow)"
              className="pointer-events-none transition-opacity duration-200"
            >
              {wire.animated && !prefersReduced && (
                <animate attributeName="stroke-dashoffset" from="10" to="0" dur="0.8s" repeatCount="indefinite" />
              )}
            </path>
            {/* Flow pulse dot — skip continuous animation for reduced motion */}
            {!prefersReduced && (
              <circle r={isHighlighted ? 3 : 2} fill={wire.color} opacity={isHighlighted ? 0.9 : 0.5} className="pointer-events-none">
                <animateMotion
                  dur={wire.animated ? '1.5s' : '3s'}
                  repeatCount="indefinite"
                  path={path}
                />
              </circle>
            )}
          </g>
        );
      })}
    </>
  );
}
