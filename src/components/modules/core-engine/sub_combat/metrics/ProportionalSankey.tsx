'use client';

import { withOpacity, OPACITY_8 } from '@/lib/chart-colors';
import { ACCENT, SANKEY_COLUMNS, SANKEY_FLOWS } from '../_shared/data';

/* ── Proportional Sankey SVG ───────────────────────────────────────────── */

const SANKEY_SVG_W = 380;
const SANKEY_SVG_H = 190;
const SANKEY_NODE_W = 60;
const SANKEY_MARGIN = 18;
const SANKEY_GAP = 4;

const SANKEY_COL_X = Array.from(
  { length: SANKEY_COLUMNS.length },
  (_, i) => 25 + i * ((SANKEY_SVG_W - SANKEY_NODE_W - 50) / (SANKEY_COLUMNS.length - 1)),
);

interface SankeyNode { x: number; y: number; h: number; color: string; label: string; pct: number }

const SANKEY_NODE_MAP = new Map<string, SankeyNode>();
for (let ci = 0; ci < SANKEY_COLUMNS.length; ci++) {
  const items = SANKEY_COLUMNS[ci].items;
  const totalGap = (items.length - 1) * SANKEY_GAP;
  const usableH = SANKEY_SVG_H - SANKEY_MARGIN - totalGap;
  let y = SANKEY_MARGIN;
  for (const item of items) {
    const h = Math.max(10, (item.pct / 100) * usableH);
    SANKEY_NODE_MAP.set(item.id, { x: SANKEY_COL_X[ci], y, h, color: item.color ?? ACCENT, label: item.label, pct: item.pct });
    y += h + SANKEY_GAP;
  }
}

/* Pre-compute flow band paths at module scope */
const SANKEY_FLOW_PATHS: { d: string; color: string }[] = (() => {
  const rightY = new Map<string, number>();
  const leftY = new Map<string, number>();
  for (const [id, node] of SANKEY_NODE_MAP) {
    rightY.set(id, node.y);
    leftY.set(id, node.y);
  }
  const paths: { d: string; color: string }[] = [];
  for (const flow of SANKEY_FLOWS) {
    const src = SANKEY_NODE_MAP.get(flow.source);
    const tgt = SANKEY_NODE_MAP.get(flow.target);
    if (!src || !tgt) continue;
    const srcH = (flow.value / src.pct) * src.h;
    const tgtH = (flow.value / tgt.pct) * tgt.h;
    const x1 = src.x + SANKEY_NODE_W;
    const y1 = rightY.get(flow.source)!;
    rightY.set(flow.source, y1 + srcH);
    const x2 = tgt.x;
    const y2 = leftY.get(flow.target)!;
    leftY.set(flow.target, y2 + tgtH);
    const mx = (x1 + x2) / 2;
    paths.push({
      d: `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2} L ${x2} ${y2 + tgtH} C ${mx} ${y2 + tgtH}, ${mx} ${y1 + srcH}, ${x1} ${y1 + srcH} Z`,
      color: flow.color ?? ACCENT,
    });
  }
  return paths;
})();

export function ProportionalSankey() {
  return (
    <svg width="100%" height={SANKEY_SVG_H + 10} viewBox={`0 0 ${SANKEY_SVG_W} ${SANKEY_SVG_H + 10}`} className="overflow-visible" preserveAspectRatio="xMidYMid meet">
      {/* Column labels */}
      {SANKEY_COLUMNS.map((col, ci) => (
        <text key={col.label} x={SANKEY_COL_X[ci] + SANKEY_NODE_W / 2} y={12} textAnchor="middle" style={{ fontSize: 9 }} className="font-mono font-bold uppercase" fill="var(--text-muted)">{col.label}</text>
      ))}
      {/* Flow bands */}
      {SANKEY_FLOW_PATHS.map((fp, i) => (
        <path key={i} d={fp.d} fill={fp.color} opacity={0.18} />
      ))}
      {/* Nodes */}
      {Array.from(SANKEY_NODE_MAP.entries()).map(([id, node]) => (
        <g key={id}>
          <rect x={node.x} y={node.y} width={SANKEY_NODE_W} height={node.h} rx={2}
            fill={withOpacity(node.color, OPACITY_8)} stroke={node.color} strokeWidth={0.5} strokeOpacity={0.5} />
          {node.h >= 16 ? (
            <>
              <text x={node.x + SANKEY_NODE_W / 2} y={node.y + node.h / 2 - 1} textAnchor="middle" style={{ fontSize: 8 }} className="font-mono" fill={node.color}>{node.label}</text>
              <text x={node.x + SANKEY_NODE_W / 2} y={node.y + node.h / 2 + 9} textAnchor="middle" style={{ fontSize: 7 }} className="font-mono font-bold" fill={node.color}>{node.pct}%</text>
            </>
          ) : (
            <text x={node.x + SANKEY_NODE_W + 4} y={node.y + node.h / 2 + 3} style={{ fontSize: 7 }} className="font-mono" fill={node.color}>{node.label} {node.pct}%</text>
          )}
        </g>
      ))}
    </svg>
  );
}
