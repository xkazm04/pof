'use client';

import { useMemo } from 'react';
import {
  Route, Clock, Navigation, ArrowRight, Timer,
  Skull, Swords, Footprints,
} from 'lucide-react';
import { motion } from 'framer-motion';
import {
  STATUS_ERROR,
  ACCENT_ORANGE, ACCENT_VIOLET, ACCENT_EMERALD,
} from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '../_design';
import {
  TOPOLOGY_NODES, TOPOLOGY_EDGES, EDGE_STYLE_MAP,
  ZONE_PLAYTIME, CRITICAL_PATH, ALL_PATHS, formatPlaytime,
} from './data';
import type { PlaytimePathMode } from './data';

const SVG_W = 560;
const SVG_H = 340;
const TOPO_OX = 50;
const TOPO_OY = 20;

/* ── Playtime Topology Overlay ────────────────────────────────────────── */

interface OverlayProps {
  mode: PlaytimePathMode;
  onModeChange: (m: PlaytimePathMode) => void;
}

export function PlaytimeTopologyOverlay({ mode, onModeChange }: OverlayProps) {
  const pathData = mode === 'critical' ? CRITICAL_PATH : ALL_PATHS;
  const cumByZone = useMemo(() => new Map(pathData.nodes.map(n => [n.zoneId, n])), [pathData]);

  return (
    <BlueprintPanel color={ACCENT_ORANGE} className="p-3">
      <div className="flex items-center justify-between mb-2.5 relative z-10">
        <SectionHeader icon={Route} label="Critical Path Playtime" color={ACCENT_ORANGE} />
        <div className="flex items-center gap-1 bg-surface-deep rounded-full p-0.5 border border-border/40">
          <button
            type="button"
            onClick={() => onModeChange('critical')}
            className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.15em] rounded-full transition-all"
            style={mode === 'critical' ? { backgroundColor: `${ACCENT_ORANGE}25`, color: ACCENT_ORANGE, boxShadow: `0 0 8px ${ACCENT_ORANGE}30` } : { color: 'var(--text-muted)' }}
          >
            Critical Path
          </button>
          <button
            type="button"
            onClick={() => onModeChange('all')}
            className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.15em] rounded-full transition-all"
            style={mode === 'all' ? { backgroundColor: `${ACCENT_ORANGE}25`, color: ACCENT_ORANGE, boxShadow: `0 0 8px ${ACCENT_ORANGE}30` } : { color: 'var(--text-muted)' }}
          >
            All Paths
          </button>
        </div>
      </div>

      <div className="flex justify-center min-h-[240px] bg-surface-deep/30 rounded-lg p-2">
        <svg width={SVG_W} height={SVG_H} viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="overflow-visible">
          {/* Edges */}
          {TOPOLOGY_EDGES.map((edge) => {
            const src = TOPOLOGY_NODES.find(n => n.id === edge.from);
            const tgt = TOPOLOGY_NODES.find(n => n.id === edge.to);
            if (!src || !tgt) return null;
            const style = EDGE_STYLE_MAP[edge.type];
            const isActive = mode === 'all' || edge.criticalPath;
            const seg = pathData.segments.find(s => s.fromId === edge.from && s.toId === edge.to);
            const mx = (src.x! + tgt.x!) / 2 + TOPO_OX;
            const my = (src.y! + tgt.y!) / 2 + TOPO_OY;
            return (
              <g key={`pt-${edge.from}-${edge.to}`} opacity={isActive ? 1 : 0.2}>
                <line
                  x1={src.x! + TOPO_OX} y1={src.y! + TOPO_OY}
                  x2={tgt.x! + TOPO_OX} y2={tgt.y! + TOPO_OY}
                  stroke={isActive && edge.criticalPath ? ACCENT_ORANGE : style.color}
                  strokeWidth={isActive && edge.criticalPath ? 3 : 1.5}
                  strokeDasharray={style.dash}
                  style={isActive && edge.criticalPath ? { filter: `drop-shadow(0 0 4px ${ACCENT_ORANGE}60)` } : undefined}
                />
                {isActive && seg && seg.transitionSec > 0 && (
                  <g>
                    <rect x={mx - 14} y={my - 8} width={28} height={16} rx={4} fill="var(--surface-deep, #0f172a)" stroke={`${ACCENT_ORANGE}40`} strokeWidth={0.5} />
                    <text x={mx} y={my + 1} textAnchor="middle" dominantBaseline="central"
                      className="text-[9px] font-mono" fill={ACCENT_ORANGE} opacity={0.9}>
                      +{seg.transitionSec.toFixed(1)}s
                    </text>
                  </g>
                )}
              </g>
            );
          })}
          {/* Nodes with cumulative time badges */}
          {TOPOLOGY_NODES.map((node) => {
            const sz = node.size ?? 22;
            const nx = node.x! + TOPO_OX;
            const ny = node.y! + TOPO_OY;
            const cum = cumByZone.get(node.id);
            const isOnPath = !!cum;
            return (
              <g key={`pt-n-${node.id}`} opacity={isOnPath ? 1 : 0.25}>
                <circle
                  cx={nx} cy={ny} r={sz / 2}
                  fill={`${node.color}25`} stroke={isOnPath ? ACCENT_ORANGE : node.color} strokeWidth={isOnPath ? 2.5 : 1.5}
                  style={isOnPath ? { filter: `drop-shadow(0 0 6px ${ACCENT_ORANGE}40)` } : undefined}
                />
                <text x={nx} y={ny} textAnchor="middle" dominantBaseline="central"
                  className="text-[10px] font-mono font-bold select-none pointer-events-none"
                  fill={isOnPath ? ACCENT_ORANGE : node.color}>
                  {node.label.split(' ').map(w => w[0]).join('')}
                </text>
                {cum && (
                  <g>
                    <rect
                      x={nx - 26} y={ny + sz / 2 + 4}
                      width={52} height={18} rx={5}
                      fill="var(--surface-deep, #0f172a)"
                      stroke={ACCENT_ORANGE} strokeWidth={1}
                      style={{ filter: `drop-shadow(0 0 3px ${ACCENT_ORANGE}30)` }}
                    />
                    <text
                      x={nx} y={ny + sz / 2 + 13}
                      textAnchor="middle" dominantBaseline="central"
                      className="text-[10px] font-mono font-bold"
                      fill={ACCENT_ORANGE}
                    >
                      {formatPlaytime(cum.cumulativeSec)}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Summary footer */}
      <div className="flex flex-wrap items-center gap-4 mt-3 pt-2 border-t border-border/40">
        <span className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.15em]" style={{ color: ACCENT_ORANGE }}>
          <Clock className="w-3.5 h-3.5" />
          Total: <span className="font-bold">{formatPlaytime(pathData.totalSec)}</span>
        </span>
        <span className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted">
          <Navigation className="w-3.5 h-3.5" />
          {pathData.nodes.length} zones
        </span>
        <span className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted">
          <ArrowRight className="w-3.5 h-3.5" />
          {pathData.segments.length} transitions
        </span>
        <span className="ml-auto text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted opacity-60">
          Includes combat (enemy density x 8s/kill) + boss phases (90s/phase) + exploration
        </span>
      </div>
    </BlueprintPanel>
  );
}

/* ── Playtime Breakdown Table ─────────────────────────────────────────── */

export function PlaytimeBreakdownTable({ mode }: { mode: PlaytimePathMode }) {
  const pathData = mode === 'critical' ? CRITICAL_PATH : ALL_PATHS;
  const nodesOnPath = useMemo(() => new Set(pathData.nodes.map(n => n.zoneId)), [pathData]);

  return (
    <BlueprintPanel color={ACCENT_ORANGE} className="p-3">
      <SectionHeader icon={Timer} label="Per-Zone Time Breakdown" color={ACCENT_ORANGE} />
      <div className="space-y-1.5">
        {ZONE_PLAYTIME.map((zp) => {
          const onPath = nodesOnPath.has(zp.zoneId);
          const maxSec = Math.max(...ZONE_PLAYTIME.map(z => z.totalSec));
          const barPct = maxSec > 0 ? (zp.totalSec / maxSec) * 100 : 0;
          return (
            <div key={zp.zoneId} className="flex items-center gap-3" style={{ opacity: onPath ? 1 : 0.4 }}>
              <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted w-28 truncate text-right flex-shrink-0">{zp.zoneName}</span>
              <div className="relative flex-1 h-6 bg-surface-deep rounded-md overflow-hidden border border-border/30">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${barPct}%` }}
                  transition={{ duration: 0.6 }}
                  className="absolute top-0 bottom-0 rounded-md"
                  style={{ background: `linear-gradient(90deg, ${ACCENT_ORANGE}40, ${ACCENT_ORANGE}20)`, borderRight: `2px solid ${ACCENT_ORANGE}` }}
                />
                <div className="absolute inset-0 flex items-center">
                  {zp.combatSec > 0 && (
                    <div className="h-full flex items-center justify-center text-[9px] font-mono" style={{ width: `${(zp.combatSec / zp.totalSec) * barPct}%`, color: STATUS_ERROR, backgroundColor: `${STATUS_ERROR}15` }}>
                      <Swords className="w-2.5 h-2.5 mr-0.5 flex-shrink-0" />{formatPlaytime(zp.combatSec)}
                    </div>
                  )}
                  {zp.bossSec > 0 && (
                    <div className="h-full flex items-center justify-center text-[9px] font-mono" style={{ width: `${(zp.bossSec / zp.totalSec) * barPct}%`, color: ACCENT_VIOLET, backgroundColor: `${ACCENT_VIOLET}15` }}>
                      <Skull className="w-2.5 h-2.5 mr-0.5 flex-shrink-0" />{formatPlaytime(zp.bossSec)}
                    </div>
                  )}
                  {zp.explorationSec > 0 && (
                    <div className="h-full flex items-center justify-center text-[9px] font-mono" style={{ width: `${(zp.explorationSec / zp.totalSec) * barPct}%`, color: ACCENT_EMERALD, backgroundColor: `${ACCENT_EMERALD}10` }}>
                      <Footprints className="w-2.5 h-2.5 mr-0.5 flex-shrink-0" />{formatPlaytime(zp.explorationSec)}
                    </div>
                  )}
                </div>
              </div>
              <span className="text-[10px] font-mono uppercase tracking-[0.15em] font-bold w-14 text-right flex-shrink-0" style={{ color: onPath ? ACCENT_ORANGE : 'var(--text-muted)' }}>
                {formatPlaytime(zp.totalSec)}
              </span>
            </div>
          );
        })}
      </div>
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 mt-3 pt-2 border-t border-border/40">
        <span className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted">
          <Swords className="w-3 h-3" style={{ color: STATUS_ERROR }} /> Combat
        </span>
        <span className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted">
          <Skull className="w-3 h-3" style={{ color: ACCENT_VIOLET }} /> Boss
        </span>
        <span className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted">
          <Footprints className="w-3 h-3" style={{ color: ACCENT_EMERALD }} /> Exploration
        </span>
        <span className="ml-auto text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted opacity-60">
          Faded zones = off {mode === 'critical' ? 'critical path' : 'selected path'}
        </span>
      </div>
    </BlueprintPanel>
  );
}
