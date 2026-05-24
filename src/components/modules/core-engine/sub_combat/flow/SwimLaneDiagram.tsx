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

interface SwimNode { name: string; cx: number; cy: number; color: string }

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

const SWIM_NODE_MAP = new Map<string, SwimNode>();
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
        const x1 = from.cx + SNODE_W / 2;
        const y1 = from.cy;
        const x2 = to.cx - SNODE_W / 2;
        const y2 = to.cy;
        const mx = (x1 + x2) / 2;
        return (
          <g key={i}>
            <path d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
              fill="none" stroke={withOpacity(OVERLAY_WHITE, OPACITY_15)} strokeWidth={1.5} />
            <polygon points={`${x2},${y2} ${x2 - 5},${y2 - 3} ${x2 - 5},${y2 + 3}`}
              fill={withOpacity(OVERLAY_WHITE, OPACITY_30)} />
            {arrow.label && (
              <text x={mx} y={(y1 + y2) / 2 - 5} textAnchor="middle" style={{ fontSize: 8 }} className="font-mono"
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
