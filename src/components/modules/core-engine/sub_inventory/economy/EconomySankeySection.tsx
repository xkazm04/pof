'use client';

import { useState } from 'react';
import { ArrowRightLeft } from 'lucide-react';
import { STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, STATUS_INFO,
  ACCENT_PURPLE,
  withOpacity, OPACITY_12, OPACITY_25, OPACITY_37,
} from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '../../unique-tabs/_design';
import { ACCENT } from '../_shared/data';

/* ── Economy Sankey Flow ──────────────────────────────────────────────── */

interface SankeyNode { id: string; label: string; value: number; color: string; col: 0 | 1 | 2 }

const SANKEY_NODES: SankeyNode[] = [
  { id: 'enemies', label: 'Enemy Drops', value: 35, color: STATUS_ERROR, col: 0 },
  { id: 'crafting', label: 'Crafting', value: 25, color: STATUS_INFO, col: 0 },
  { id: 'quests', label: 'Quest Rewards', value: 20, color: STATUS_SUCCESS, col: 0 },
  { id: 'vendors', label: 'Vendors', value: 20, color: STATUS_WARNING, col: 0 },
  { id: 'player', label: 'Player Inventory', value: 100, color: ACCENT, col: 1 },
  { id: 'equip', label: 'Equipment', value: 40, color: ACCENT_PURPLE, col: 2 },
  { id: 'salvage', label: 'Salvage', value: 25, color: STATUS_WARNING, col: 2 },
  { id: 'trade', label: 'Trade / Sell', value: 20, color: STATUS_SUCCESS, col: 2 },
  { id: 'consume', label: 'Consumables', value: 15, color: STATUS_INFO, col: 2 },
];

interface SankeyLink { from: string; to: string; value: number }
const SANKEY_LINKS: SankeyLink[] = [
  { from: 'enemies', to: 'player', value: 35 },
  { from: 'crafting', to: 'player', value: 25 },
  { from: 'quests', to: 'player', value: 20 },
  { from: 'vendors', to: 'player', value: 20 },
  { from: 'player', to: 'equip', value: 40 },
  { from: 'player', to: 'salvage', value: 25 },
  { from: 'player', to: 'trade', value: 20 },
  { from: 'player', to: 'consume', value: 15 },
];

function SankeyDiagram() {
  const [hoveredLink, setHoveredLink] = useState<number | null>(null);
  const W = 480, H = 220;
  const colX = [30, 200, 370];
  const nodeW = 14;

  /* Compute node positions */
  const cols: SankeyNode[][] = [[], [], []];
  for (const n of SANKEY_NODES) cols[n.col].push(n);

  const nodePos = new Map<string, { x: number; y: number; h: number }>();
  for (let c = 0; c < 3; c++) {
    const total = cols[c].reduce((s, n) => s + n.value, 0);
    const availH = H - 20;
    const gap = 6;
    const usableH = availH - (cols[c].length - 1) * gap;
    let cy = 10;
    for (const n of cols[c]) {
      const nh = Math.max(12, (n.value / total) * usableH);
      nodePos.set(n.id, { x: colX[c], y: cy, h: nh });
      cy += nh + gap;
    }
  }

  /* Build link paths with offset tracking */
  const srcOffsets = new Map<string, number>();
  const dstOffsets = new Map<string, number>();
  for (const n of SANKEY_NODES) {
    srcOffsets.set(n.id, 0);
    dstOffsets.set(n.id, 0);
  }

  const linkPaths = SANKEY_LINKS.map((link) => {
    const src = nodePos.get(link.from)!;
    const dst = nodePos.get(link.to)!;
    const srcNode = SANKEY_NODES.find(n => n.id === link.from)!;
    const srcTotal = SANKEY_LINKS.filter(l => l.from === link.from).reduce((s, l) => s + l.value, 0);
    const dstTotal = SANKEY_LINKS.filter(l => l.to === link.to).reduce((s, l) => s + l.value, 0);

    const linkH_src = (link.value / srcTotal) * src.h;
    const linkH_dst = (link.value / dstTotal) * dst.h;
    const so = srcOffsets.get(link.from)!;
    const do_ = dstOffsets.get(link.to)!;

    const y1 = src.y + so;
    const y2 = dst.y + do_;
    const x1 = src.x + nodeW;
    const x2 = dst.x;
    const mx = (x1 + x2) / 2;

    srcOffsets.set(link.from, so + linkH_src);
    dstOffsets.set(link.to, do_ + linkH_dst);

    const d = `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2} L${x2},${y2 + linkH_dst} C${mx},${y2 + linkH_dst} ${mx},${y1 + linkH_src} ${x1},${y1 + linkH_src} Z`;
    return { d, color: srcNode.color, label: `${link.value}%` };
  });

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
      {/* Links */}
      {linkPaths.map((lp, i) => (
        <path key={i} d={lp.d}
          fill={withOpacity(lp.color, hoveredLink === i ? OPACITY_37 : OPACITY_12)}
          stroke={lp.color}
          strokeWidth={hoveredLink === i ? 1.5 : 0.5}
          style={{ transition: 'fill 0.15s, stroke-width 0.15s' }}
          onMouseEnter={() => setHoveredLink(i)}
          onMouseLeave={() => setHoveredLink(null)}
        />
      ))}
      {/* Nodes */}
      {SANKEY_NODES.map(n => {
        const pos = nodePos.get(n.id)!;
        return (
          <g key={n.id}>
            <rect x={pos.x} y={pos.y} width={nodeW} height={pos.h} rx={3}
              fill={withOpacity(n.color, OPACITY_25)} stroke={n.color} strokeWidth={1} />
            <text x={n.col === 2 ? pos.x + nodeW + 6 : n.col === 0 ? pos.x - 4 : pos.x + nodeW / 2}
              y={pos.y + pos.h / 2}
              textAnchor={n.col === 2 ? 'start' : n.col === 0 ? 'end' : 'middle'}
              dominantBaseline="central"
              className="text-xs font-mono font-bold" fill={n.color} style={{ fontSize: 9 }}>
              {n.label}
            </text>
            <text x={n.col === 2 ? pos.x + nodeW + 6 : n.col === 0 ? pos.x - 4 : pos.x + nodeW / 2}
              y={pos.y + pos.h / 2 + 10}
              textAnchor={n.col === 2 ? 'start' : n.col === 0 ? 'end' : 'middle'}
              dominantBaseline="central"
              className="text-xs font-mono fill-[var(--text-muted)]" style={{ fontSize: 7 }}>
              {n.value}%
            </text>
          </g>
        );
      })}
      {/* Hovered link tooltip */}
      {hoveredLink != null && (() => {
        const link = SANKEY_LINKS[hoveredLink];
        const lp = linkPaths[hoveredLink];
        const src = nodePos.get(link.from)!;
        const dst = nodePos.get(link.to)!;
        const tx = (src.x + dst.x + nodeW) / 2;
        const ty = (src.y + dst.y) / 2;
        return (
          <g className="pointer-events-none">
            <rect x={tx - 30} y={ty - 10} width={60} height={18} rx={4}
              fill="var(--surface-deep)" stroke={lp.color} strokeWidth={1} />
            <text x={tx} y={ty} textAnchor="middle" dominantBaseline="central"
              className="text-xs font-mono font-bold" fill={lp.color} style={{ fontSize: 9 }}>
              {lp.label} flow
            </text>
          </g>
        );
      })()}
    </svg>
  );
}

export function EconomySankeySection() {
  return (
    <BlueprintPanel color={ACCENT} className="p-4">
      <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, ${withOpacity(ACCENT, OPACITY_37)}, transparent)` }} />
      <SectionHeader icon={ArrowRightLeft} label="Economy Flow (Sankey)" color={ACCENT} />
      <p className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted mb-3">Item sources → Player Inventory → sinks. Hover links for flow volume.</p>
      <div className="flex justify-center overflow-x-auto">
        <SankeyDiagram />
      </div>
    </BlueprintPanel>
  );
}
