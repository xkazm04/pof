'use client';

import { useMemo } from 'react';
import { Route, Clock, Navigation, ArrowRight } from 'lucide-react';
import {
  ACCENT_ORANGE,
  OPACITY_15, OPACITY_20, OPACITY_25, OPACITY_37,
  GLOW_MD,
  withOpacity,
} from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '../../unique-tabs/_design';
import {
  TOPOLOGY_NODES, TOPOLOGY_EDGES, EDGE_STYLE_MAP,
  CRITICAL_PATH, ALL_PATHS, formatPlaytime,
} from '../_shared/data';
import type { PlaytimePathMode } from '../_shared/data';

const SVG_W = 560;
const SVG_H = 340;
const TOPO_OX = 50;
const TOPO_OY = 20;

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
            className="px-2.5 py-1 text-xs font-mono uppercase tracking-[0.15em] rounded-full transition-all"
            style={mode === 'critical' ? { backgroundColor: withOpacity(ACCENT_ORANGE, OPACITY_15), color: ACCENT_ORANGE, boxShadow: `${GLOW_MD} ${withOpacity(ACCENT_ORANGE, OPACITY_20)}` } : { color: 'var(--text-muted)' }}
          >
            Critical Path
          </button>
          <button
            type="button"
            onClick={() => onModeChange('all')}
            className="px-2.5 py-1 text-xs font-mono uppercase tracking-[0.15em] rounded-full transition-all"
            style={mode === 'all' ? { backgroundColor: withOpacity(ACCENT_ORANGE, OPACITY_15), color: ACCENT_ORANGE, boxShadow: `${GLOW_MD} ${withOpacity(ACCENT_ORANGE, OPACITY_20)}` } : { color: 'var(--text-muted)' }}
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
                  style={isActive && edge.criticalPath ? { filter: `drop-shadow(0 0 4px ${withOpacity(ACCENT_ORANGE, OPACITY_37)})` } : undefined}
                />
                {isActive && seg && seg.transitionSec > 0 && (
                  <g>
                    <rect x={mx - 14} y={my - 8} width={28} height={16} rx={4} fill="var(--surface-deep, #0f172a)" stroke={withOpacity(ACCENT_ORANGE, OPACITY_25)} strokeWidth={0.5} />
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
                  fill={withOpacity(node.color ?? ACCENT_ORANGE, OPACITY_15)} stroke={isOnPath ? ACCENT_ORANGE : node.color} strokeWidth={isOnPath ? 2.5 : 1.5}
                  style={isOnPath ? { filter: `drop-shadow(0 0 6px ${withOpacity(ACCENT_ORANGE, OPACITY_25)})` } : undefined}
                />
                <text x={nx} y={ny} textAnchor="middle" dominantBaseline="central"
                  className="text-xs font-mono font-bold select-none pointer-events-none"
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
                      style={{ filter: `drop-shadow(0 0 3px ${withOpacity(ACCENT_ORANGE, OPACITY_20)})` }}
                    />
                    <text
                      x={nx} y={ny + sz / 2 + 13}
                      textAnchor="middle" dominantBaseline="central"
                      className="text-xs font-mono font-bold"
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
        <span className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-[0.15em]" style={{ color: ACCENT_ORANGE }}>
          <Clock className="w-3.5 h-3.5" />
          Total: <span className="font-bold">{formatPlaytime(pathData.totalSec)}</span>
        </span>
        <span className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-[0.15em] text-text-muted">
          <Navigation className="w-3.5 h-3.5" />
          {pathData.nodes.length} zones
        </span>
        <span className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-[0.15em] text-text-muted">
          <ArrowRight className="w-3.5 h-3.5" />
          {pathData.segments.length} transitions
        </span>
        <span className="ml-auto text-xs font-mono uppercase tracking-[0.15em] text-text-muted opacity-60">
          Includes combat (enemy density x 8s/kill) + boss phases (90s/phase) + exploration
        </span>
      </div>
    </BlueprintPanel>
  );
}
