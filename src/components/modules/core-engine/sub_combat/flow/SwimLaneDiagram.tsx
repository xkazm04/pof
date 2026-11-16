'use client';

import { OVERLAY_WHITE, withOpacity, OPACITY_5, OPACITY_8, OPACITY_10, OPACITY_15, OPACITY_30 } from '@/lib/chart-colors';
import { LANES, FLOW_ARROWS } from '../_shared/data';

/* ── Swim-Lane Flow Diagram ──────────────────────────────────────────── */

const SWIM_W = 620;
const SWIM_H = 230;
const SNODE_W = 120;
const SNODE_H = 24;

const SHORT_NAMES: Record<string, string> = {
  'Melee attack ability': 'Melee Attack',
  'Combo system': 'Combo System',
  'Dodge ability (GAS)': 'Dodge (GAS)',
  'Hit detection': 'Hit Detection',
  'GAS damage application': 'GAS Damage',
  'Death flow': 'Death Flow',
  'Hit reaction system': 'Hit Reaction',
  'Combat feedback': 'Combat Feedback',
};

export interface SwimNode { name: string; cx: number; cy: number; color: string }

type Pt = { x: number; y: number };
export interface SwimArrowGeometry {
  start: Pt; c1: Pt; c2: Pt; end: Pt;
  /** Arrowhead triangle: [tip, base1, base2] */
  head: [Pt, Pt, Pt];
  label: Pt;
}

/**
 * Cubic-bezier edge from one feature node to another, with its arrowhead.
 * Same-lane edges run right edge -> left edge; cross-lane edges run from the
 * source's bottom (or top) to the target's top (or bottom) with vertical
 * tangents, so the head always points the way the edge arrives (a horizontal
 * edge to a node further left used to end with its head pointing backwards).
 */
export function swimArrowGeometry(from: SwimNode, to: SwimNode): SwimArrowGeometry {
  if (from.cy !== to.cy) {
    const dir = to.cy > from.cy ? 1 : -1;
    const sx = from.cx;
    const sy = from.cy + dir * (SNODE_H / 2);
    const ex = to.cx;
    const ey = to.cy - dir * (SNODE_H / 2);
    const my = (sy + ey) / 2;
    return {
      start: { x: sx, y: sy }, c1: { x: sx, y: my }, c2: { x: ex, y: my }, end: { x: ex, y: ey },
      head: [{ x: ex, y: ey }, { x: ex - 3, y: ey - dir * 5 }, { x: ex + 3, y: ey - dir * 5 }],
      label: { x: (sx + ex) / 2 + 4, y: my - 2 },
    };
  }
  const x1 = from.cx + SNODE_W / 2;
  const y1 = from.cy;
  const x2 = to.cx - SNODE_W / 2;
  const y2 = to.cy;
  const mx = (x1 + x2) / 2;
  return {
    start: { x: x1, y: y1 }, c1: { x: mx, y: y1 }, c2: { x: mx, y: y2 }, end: { x: x2, y: y2 },
    head: [{ x: x2, y: y2 }, { x: x2 - 5, y: y2 - 3 }, { x: x2 - 5, y: y2 + 3 }],
    label: { x: mx, y: (y1 + y2) / 2 - 5 },
  };
}

const LANE_CX: number[][] = [
  [120, 310, 500],
  [120, 310, 500],
  [215, 405],
];

const SWIM_LANE_DATA = LANES.map((lane, li) => {
  const cy = 40 + li * 75;
  return {
    ...lane,
    bandY: cy - 28,
    bandH: 56,
    cy,
    nodes: lane.featureNames.map((name, fi): SwimNode => ({
      name, cx: LANE_CX[li][fi], cy, color: lane.color,
    })),
  };
});

export const SWIM_NODE_MAP = new Map<string, SwimNode>();
for (const lane of SWIM_LANE_DATA) {
  for (const node of lane.nodes) SWIM_NODE_MAP.set(node.name, node);
}

export function SwimLaneDiagram() {
  return (
    <svg width="100%" height={SWIM_H} viewBox={`0 0 ${SWIM_W} ${SWIM_H}`} className="overflow-visible" preserveAspectRatio="xMidYMid meet">
      {/* Lane bands */}
      {SWIM_LANE_DATA.map((lane) => (
        <g key={lane.id}>
          <rect x={4} y={lane.bandY} width={SWIM_W - 8} height={lane.bandH} rx={6}
            fill={withOpacity(lane.color, OPACITY_5)} stroke={withOpacity(lane.color, OPACITY_10)} strokeWidth={1} />
          <text x={12} y={lane.bandY + 12} style={{ fontSize: 9 }} className="font-mono font-bold uppercase" fill={lane.color} opacity={0.6}>{lane.label}</text>
        </g>
      ))}

      {/* Flow arrows */}
      {FLOW_ARROWS.map((arrow, i) => {
        const from = SWIM_NODE_MAP.get(arrow.from);
        const to = SWIM_NODE_MAP.get(arrow.to);
        if (!from || !to) return null;
        const g = swimArrowGeometry(from, to);
        return (
          <g key={i}>
            <path d={`M ${g.start.x} ${g.start.y} C ${g.c1.x} ${g.c1.y}, ${g.c2.x} ${g.c2.y}, ${g.end.x} ${g.end.y}`}
              fill="none" stroke={withOpacity(OVERLAY_WHITE, OPACITY_15)} strokeWidth={1.5} />
            <polygon points={g.head.map((p) => `${p.x},${p.y}`).join(' ')}
              fill={withOpacity(OVERLAY_WHITE, OPACITY_30)} />
            {arrow.label && (
              <text x={g.label.x} y={g.label.y} textAnchor="middle" style={{ fontSize: 8 }} className="font-mono"
                fill={withOpacity(OVERLAY_WHITE, OPACITY_30)}>{arrow.label}</text>
            )}
          </g>
        );
      })}

      {/* Feature nodes */}
      {SWIM_LANE_DATA.flatMap((lane) =>
        lane.nodes.map((node) => (
          <g key={node.name}>
            <rect x={node.cx - SNODE_W / 2} y={node.cy - SNODE_H / 2} width={SNODE_W} height={SNODE_H} rx={4}
              fill={withOpacity(node.color, OPACITY_8)} stroke={withOpacity(node.color, OPACITY_30)} strokeWidth={1} />
            <text x={node.cx} y={node.cy + 4} textAnchor="middle" style={{ fontSize: 10 }} className="font-mono font-bold"
              fill={node.color}>{SHORT_NAMES[node.name] ?? node.name}</text>
          </g>
        ))
      )}
    </svg>
  );
}
