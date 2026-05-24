'use client';

import { OVERLAY_WHITE, withOpacity, OPACITY_8, OPACITY_12, OPACITY_20, OPACITY_30 } from '@/lib/chart-colors';
import {
  GRAPH_NODES, GRAPH_EDGES, GRAPH_NODE_MAP, GN_W, GN_H, rectEdgePoint,
} from './state-machine-graph-data';

interface StateMachineSvgProps {
  hoveredGroup: string | null;
  onHoverGroup: (group: string | null) => void;
}

/**
 * SVG graph rendering of cross-group state transitions.
 * Extracted from StateMachinePanel.tsx to keep that file under 200 LOC.
 */
export function StateMachineSvg({ hoveredGroup, onHoverGroup }: StateMachineSvgProps) {
  return (
    <svg width="100%" viewBox="0 0 600 210" className="overflow-visible max-w-[600px]">
      <defs>
        <marker id="sg-arrow" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <path d="M0,0 L8,3 L0,6" fill="var(--text-muted)" opacity="0.5" />
        </marker>
        <filter id="sg-glow">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      {/* Edges — animated dash when hovered */}
      {GRAPH_EDGES.map(edge => {
        const from = GRAPH_NODE_MAP.get(edge.from);
        const to = GRAPH_NODE_MAP.get(edge.to);
        if (!from || !to) return null;
        const p1 = rectEdgePoint(from.cx, from.cy, to.cx, to.cy);
        const p2 = rectEdgePoint(to.cx, to.cy, from.cx, from.cy);
        const hl = hoveredGroup === edge.from || hoveredGroup === edge.to;
        return (
          <line
            key={`${edge.from}-${edge.to}`}
            x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
            stroke={hl ? from.color : withOpacity(OVERLAY_WHITE, OPACITY_12)}
            strokeWidth={Math.min(1 + edge.count * 0.5, 4)}
            strokeDasharray="5 3"
            markerEnd="url(#sg-arrow)"
            style={{ transition: 'stroke 0.2s' }}
          >
            {hl && <animate attributeName="stroke-dashoffset" from="16" to="0" dur="0.8s" repeatCount="indefinite" />}
          </line>
        );
      })}
      {/* Group nodes — rounded rects with glow on hover */}
      {GRAPH_NODES.map(node => {
        const hl = hoveredGroup === node.group;
        return (
          <g
            key={node.group}
            onMouseEnter={() => onHoverGroup(node.group)}
            onMouseLeave={() => onHoverGroup(null)}
            className="cursor-pointer"
          >
            {hl && (
              <rect
                x={node.cx - GN_W / 2 - 4} y={node.cy - GN_H / 2 - 4}
                width={GN_W + 8} height={GN_H + 8} rx={12}
                fill="none" stroke={node.color} strokeWidth="1" opacity={0.3}
                filter="url(#sg-glow)"
              />
            )}
            <rect
              x={node.cx - GN_W / 2} y={node.cy - GN_H / 2}
              width={GN_W} height={GN_H} rx={10}
              fill={withOpacity(node.color, hl ? OPACITY_20 : OPACITY_8)}
              stroke={hl ? node.color : withOpacity(node.color, OPACITY_30)}
              strokeWidth={hl ? 2 : 1}
              style={{ transition: 'all 0.2s' }}
            />
            <text
              x={node.cx} y={node.cy - 3}
              textAnchor="middle"
              className="text-xs font-mono font-bold"
              fill={hl ? node.color : 'var(--text)'}
              style={{ transition: 'fill 0.2s', pointerEvents: 'none' }}
            >
              {node.group}
            </text>
            <text
              x={node.cx} y={node.cy + 12}
              textAnchor="middle"
              className="text-[10px] font-mono"
              fill="var(--text-muted)"
              style={{ pointerEvents: 'none' }}
            >
              {node.stateCount} states
            </text>
          </g>
        );
      })}
    </svg>
  );
}
