'use client';

import { useState } from 'react';
import { Network } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { STATUS_WARNING, ACCENT_CYAN,
  withOpacity, OPACITY_37, OPACITY_15, OPACITY_25,
} from '@/lib/chart-colors';
import { ANIMATION_PRESETS, motionSafe } from '@/lib/motion';
import { BlueprintPanel, SectionHeader } from '../../_design';
import {
  TOPOLOGY_NODES, TOPOLOGY_EDGES, EDGE_STYLE_MAP, TOPO_LEVEL_RANGES,
} from '../data';

const ACCENT = ACCENT_CYAN;

export function TopologyGraph() {
  const [hoveredTopoNode, setHoveredTopoNode] = useState<string | null>(null);
  const prefersReduced = useReducedMotion();

  return (
    <BlueprintPanel color={ACCENT} className="p-3">
      <SectionHeader icon={Network} label="Zone Topology Graph" color={ACCENT} />
      <div className="flex justify-center min-h-[200px] bg-surface-deep/30 rounded-lg p-2">
        <svg width={460} height={300} viewBox="0 0 460 300" className="overflow-visible">
          {/* Edges */}
          {TOPOLOGY_EDGES.map((edge) => {
            const src = TOPOLOGY_NODES.find(n => n.id === edge.from);
            const tgt = TOPOLOGY_NODES.find(n => n.id === edge.to);
            if (!src || !tgt) return null;
            const style = EDGE_STYLE_MAP[edge.type];
            return (
              <g key={`${edge.from}-${edge.to}`}>
                <line
                  x1={src.x!} y1={src.y!} x2={tgt.x!} y2={tgt.y!}
                  stroke={edge.criticalPath ? STATUS_WARNING : style.color}
                  strokeWidth={edge.criticalPath ? 3 : 1.5}
                  strokeDasharray={style.dash}
                  opacity={0.7}
                  style={edge.criticalPath ? { filter: `drop-shadow(0 0 4px ${withOpacity(STATUS_WARNING, OPACITY_37)})` } : undefined}
                />
                {edge.locked && (
                  <text
                    x={(src.x! + tgt.x!) / 2}
                    y={(src.y! + tgt.y!) / 2 - 8}
                    textAnchor="middle"
                    className="text-xs fill-red-400"
                  >
                    &#x1F512;
                  </text>
                )}
              </g>
            );
          })}
          {/* Nodes */}
          {TOPOLOGY_NODES.map((node) => {
            const sz = node.size ?? 22;
            const isHovered = hoveredTopoNode === node.id;
            return (
              <g
                key={node.id}
                onMouseEnter={() => setHoveredTopoNode(node.id)}
                onMouseLeave={() => setHoveredTopoNode(null)}
                className="cursor-pointer"
              >
                {isHovered && (
                  <circle
                    cx={node.x!} cy={node.y!} r={sz / 2 + 4}
                    fill="none" stroke={node.color} strokeWidth="1" opacity={0.4}
                  />
                )}
                <circle
                  cx={node.x!} cy={node.y!} r={sz / 2}
                  fill={`${withOpacity(node.color ?? '', OPACITY_15)}`} stroke={node.color} strokeWidth="2"
                  style={{ filter: `drop-shadow(0 0 6px ${withOpacity(node.color ?? '', OPACITY_25)})` }}
                />
                <text x={node.x!} y={node.y!} textAnchor="middle" dominantBaseline="central"
                  className="text-xs font-mono font-bold select-none pointer-events-none"
                  fill={node.color}>
                  {node.label.split(' ').map(w => w[0]).join('')}
                </text>
              </g>
            );
          })}
          {/* Hover tooltips */}
          {TOPOLOGY_NODES.map((node) => {
            if (hoveredTopoNode !== node.id) return null;
            const tooltipW = 150;
            const tooltipH = 68;
            const rawX = node.x! - tooltipW / 2;
            const rawY = node.y! - (node.size ?? 22) / 2 - tooltipH - 8;
            const tx = Math.max(4, Math.min(rawX, 460 - tooltipW - 4));
            const ty = rawY < 4 ? node.y! + (node.size ?? 22) / 2 + 8 : rawY;
            return (
              <foreignObject key={`tip-${node.id}`} x={tx} y={ty} width={tooltipW} height={tooltipH}
                className="pointer-events-none overflow-visible">
                <motion.div
                  initial={prefersReduced ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={motionSafe(ANIMATION_PRESETS.spring, prefersReduced)}
                  className="rounded-lg border border-border/60 shadow-lg"
                  style={{ background: 'var(--surface-deep, #0f172a)', borderTop: `2px solid ${node.color}` }}>
                  <div className="px-2.5 py-2 space-y-1">
                    <div className="text-xs font-bold text-text truncate" style={{ color: node.color }}>
                      {node.label}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-mono text-text-muted">
                      <span className="px-1.5 py-0.5 rounded border border-border/40 bg-surface/50 uppercase tracking-wider">
                        {node.group}
                      </span>
                      <span className="px-1.5 py-0.5 rounded border border-border/40 bg-surface/50" style={{ color: node.color }}>
                        Lv {TOPO_LEVEL_RANGES[node.id] ?? '?'}
                      </span>
                    </div>
                  </div>
                </motion.div>
              </foreignObject>
            );
          })}
        </svg>
      </div>
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 mt-3 pt-2 border-t border-border/40">
        {Object.entries(EDGE_STYLE_MAP).map(([type, s]) => (
          <span key={type} className="text-xs font-mono uppercase tracking-wider text-text-muted flex items-center gap-1.5">
            <svg width="24" height="4"><line x1="0" y1="2" x2="24" y2="2" stroke={s.color} strokeWidth="2" strokeDasharray={s.dash === '0' ? 'none' : s.dash} /></svg>
            {s.label}
          </span>
        ))}
        <span className="text-xs font-mono uppercase tracking-wider text-text-muted flex items-center gap-1.5">
          <svg width="24" height="4"><line x1="0" y1="2" x2="24" y2="2" stroke={STATUS_WARNING} strokeWidth="3" /></svg>
          Critical Path
        </span>
      </div>
    </BlueprintPanel>
  );
}
