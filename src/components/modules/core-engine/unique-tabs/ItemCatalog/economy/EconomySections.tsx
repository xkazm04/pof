'use client';

import { useState } from 'react';
import { FlaskConical, MapPin, BarChart3, ArrowRightLeft } from 'lucide-react';
import { STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, STATUS_MUTED, STATUS_INFO,
  ACCENT_PURPLE, OVERLAY_WHITE,
  withOpacity, OPACITY_5, OPACITY_8, OPACITY_12, OPACITY_20, OPACITY_25, OPACITY_37,
} from '@/lib/chart-colors';
import { motion } from 'framer-motion';
import { BlueprintPanel, SectionHeader, NeonBar } from '../../_design';
import {
  ACCENT, RARITY_COLORS,
  SAMPLE_RECIPE, CRYSTAL_STAFF_SOURCES,
  RARITY_DIST, LUCK_SCORE,
} from '../data';

/* ── Crafting Recipe Section ───────────────────────────────────────────── */

export function CraftingRecipeSection() {
  return (
    <BlueprintPanel color={ACCENT} className="p-4">
      <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, ${withOpacity(ACCENT, OPACITY_37)}, transparent)` }} />
      <SectionHeader icon={FlaskConical} label="Crafting Recipe Preview" color={ACCENT} />
      <p className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted mb-3">Recipe card showing materials, output, and affix probability ranges.</p>
      <div className="flex flex-wrap gap-4 items-start">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="space-y-3">
            {SAMPLE_RECIPE.materials.map(mat => (
              <div key={mat.name} className="flex items-center gap-2 text-sm font-mono px-3 py-1.5 rounded-lg border"
                style={{ borderColor: `${withOpacity(RARITY_COLORS[mat.rarity] ?? STATUS_MUTED, OPACITY_25)}`, backgroundColor: `${withOpacity(RARITY_COLORS[mat.rarity] ?? STATUS_MUTED, OPACITY_5)}` }}>
                <span className="text-text font-bold">{mat.quantity}x</span>
                <span className="text-text-muted">{mat.name}</span>
                <span className="text-xs opacity-60" style={{ color: RARITY_COLORS[mat.rarity] }}>{mat.rarity}</span>
              </div>
            ))}
          </div>
          <div className="text-text-muted text-lg font-bold">&rarr;</div>
          <div className="p-3 rounded-lg border-2 text-center min-w-[120px]"
            style={{ borderColor: `${withOpacity(RARITY_COLORS[SAMPLE_RECIPE.outputRarity], OPACITY_37)}`, backgroundColor: `${withOpacity(RARITY_COLORS[SAMPLE_RECIPE.outputRarity], OPACITY_8)}` }}>
            <p className="text-sm font-bold text-text" style={{ textShadow: `0 0 12px ${withOpacity(RARITY_COLORS[SAMPLE_RECIPE.outputRarity], OPACITY_25)}` }}>{SAMPLE_RECIPE.output}</p>
            <p className="text-xs font-mono uppercase tracking-[0.15em]" style={{ color: RARITY_COLORS[SAMPLE_RECIPE.outputRarity] }}>{SAMPLE_RECIPE.outputRarity}</p>
          </div>
        </div>
        <div className="flex flex-col gap-2 min-w-[150px]">
          <div className="space-y-1">
            <div className="flex justify-between text-sm font-mono">
              <span className="text-text-muted">Success Rate</span>
              <span className="font-bold" style={{ color: STATUS_SUCCESS }}>{(SAMPLE_RECIPE.successRate * 100).toFixed(0)}%</span>
            </div>
            <NeonBar pct={SAMPLE_RECIPE.successRate * 100} color={STATUS_SUCCESS} glow />
          </div>
          <p className="text-sm font-mono text-text-muted">Cost: <span className="font-bold" style={{ color: STATUS_WARNING, textShadow: `0 0 12px ${withOpacity(STATUS_WARNING, OPACITY_25)}` }}>{SAMPLE_RECIPE.cost}g</span></p>
          <div className="mt-1 space-y-1">
            <p className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">Output Affixes</p>
            {SAMPLE_RECIPE.affixChances.map(ac => (
              <div key={ac.affix} className="flex items-center gap-2 text-sm font-mono">
                <div className="flex-1">
                  <NeonBar pct={ac.chance * 100} color={ac.color} height={4} />
                </div>
                <span className="text-text-muted w-20 truncate">{ac.affix}</span>
                <span style={{ color: ac.color }}>{(ac.chance * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button className="text-sm font-mono font-bold px-3 py-1.5 rounded-lg border transition-colors hover:bg-surface-hover/30 cursor-pointer"
          style={{ borderColor: `${withOpacity(ACCENT, OPACITY_25)}`, color: ACCENT, backgroundColor: `${withOpacity(ACCENT, OPACITY_8)}` }}
          onClick={() => { }}>Simulate 100 Crafts</button>
        <span className="text-xs font-mono text-text-muted italic">(Static preview)</span>
      </div>
    </BlueprintPanel>
  );
}

/* ── Drop Source Section ───────────────────────────────────────────────── */

export function DropSourceSection() {
  return (
    <BlueprintPanel color={ACCENT} className="p-4">
      <SectionHeader icon={MapPin} label="Item Drop Source Map" color={ACCENT} />
      <p className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted mb-3">Trace drop sources for Crystal Staff: enemies, loot tables, and zones.</p>
      <div className="flex items-center gap-4 flex-wrap justify-center">
        <div className="p-3 rounded-lg border-2 text-center min-w-[110px] flex-shrink-0"
          style={{ borderColor: `${withOpacity(RARITY_COLORS.Rare, OPACITY_37)}`, backgroundColor: `${withOpacity(RARITY_COLORS.Rare, OPACITY_8)}` }}>
          <p className="text-sm font-bold text-text" style={{ textShadow: `0 0 12px ${withOpacity(RARITY_COLORS.Rare, OPACITY_25)}` }}>Crystal Staff</p>
          <p className="text-xs font-mono uppercase tracking-[0.15em]" style={{ color: RARITY_COLORS.Rare }}>Rare Staff</p>
        </div>
        <div className="text-text-muted text-lg font-bold">&larr;</div>
        <div className="space-y-3 flex-1 min-w-[200px]">
          {CRYSTAL_STAFF_SOURCES.map(src => (
            <motion.div key={src.name} className="flex items-center gap-3 px-3 py-2 rounded-lg border"
              style={{ borderColor: `${withOpacity(src.color, OPACITY_20)}`, backgroundColor: `${withOpacity(src.color, OPACITY_5)}` }}
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
              <span className="text-xs font-mono uppercase tracking-[0.15em] px-1.5 py-0.5 rounded"
                style={{ backgroundColor: `${withOpacity(src.color, OPACITY_12)}`, color: src.color }}>
                {src.type === 'enemy' ? 'Enemy' : src.type === 'loot_table' ? 'Loot Table' : 'Zone'}
              </span>
              <span className="text-sm font-mono text-text flex-1">{src.name}</span>
              <div className="flex items-center gap-2">
                <div className="w-16"><NeonBar pct={src.dropRate * 100 * 5} color={src.color} height={4} /></div>
                <span className="text-sm font-mono font-bold" style={{ color: src.color, textShadow: `0 0 12px ${withOpacity(src.color, OPACITY_25)}` }}>
                  {(src.dropRate * 100).toFixed(1)}%
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </BlueprintPanel>
  );
}

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

/* ── Rarity Distribution Section ───────────────────────────────────────── */

export function RarityDistributionSection() {
  return (
    <BlueprintPanel color={ACCENT} className="p-4">
      <SectionHeader icon={BarChart3} label="Rarity Distribution Analyzer" color={ACCENT} />
      <p className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted mb-3">Compare expected vs actual inventory rarity at Level 14.</p>
      <div className="space-y-3">
        {RARITY_DIST.map(r => {
          const maxPct = Math.max(r.expected, r.actual);
          const barScale = maxPct > 0 ? 100 / maxPct : 100;
          return (
            <div key={r.rarity} className="space-y-1">
              <div className="flex items-center justify-between text-sm font-mono">
                <span className="font-bold" style={{ color: r.color, textShadow: `0 0 12px ${withOpacity(r.color, OPACITY_25)}` }}>{r.rarity}</span>
                <span className="text-text-muted">Expected {(r.expected * 100).toFixed(0)}% | Actual {(r.actual * 100).toFixed(0)}%</span>
              </div>
              <div className="flex gap-1">
                <div className="flex-1 space-y-0.5">
                  <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: `${withOpacity(r.color, OPACITY_8)}` }}>
                    <div className="h-full rounded-full opacity-50" style={{ width: `${r.expected * barScale}%`, backgroundColor: r.color }} />
                  </div>
                  <NeonBar pct={r.actual * barScale} color={r.color} height={8} />
                </div>
                <div className="w-8 flex flex-col items-center justify-center text-xs font-mono">
                  {r.actual > r.expected
                    ? <span style={{ color: STATUS_ERROR }}>{'\u25B2'}</span>
                    : r.actual < r.expected
                      ? <span style={{ color: STATUS_SUCCESS }}>{'\u25BC'}</span>
                      : <span className="text-text-muted">=</span>}
                </div>
              </div>
            </div>
          );
        })}
        <div className="flex items-center gap-3 text-sm font-mono text-text-muted">
          <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm opacity-50" style={{ backgroundColor: STATUS_MUTED }} /> Expected</span>
          <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm" style={{ backgroundColor: STATUS_MUTED }} /> Actual</span>
        </div>
        {/* Luck Score */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-deep border" style={{ borderColor: `${withOpacity(ACCENT, OPACITY_12)}` }}>
          <div className="relative w-10 h-10">
            <svg width={40} height={40} viewBox="0 0 48 48">
              <circle cx="24" cy="24" r="20" fill="none" stroke={withOpacity(OVERLAY_WHITE, OPACITY_8)} strokeWidth="4" />
              <circle cx="24" cy="24" r="20" fill="none"
                stroke={LUCK_SCORE >= 80 ? STATUS_SUCCESS : LUCK_SCORE >= 50 ? STATUS_WARNING : STATUS_ERROR}
                strokeWidth="4" strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 20}`}
                strokeDashoffset={`${2 * Math.PI * 20 * (1 - LUCK_SCORE / 100)}`}
                transform="rotate(-90 24 24)" />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-sm font-mono font-bold text-text">{LUCK_SCORE}</span>
          </div>
          <div>
            <p className="text-sm font-bold text-text">Luck Score</p>
            <p className="text-xs font-mono text-text-muted">Based on deviation from expected rarity distribution at Level 14</p>
          </div>
        </div>
      </div>
    </BlueprintPanel>
  );
}
