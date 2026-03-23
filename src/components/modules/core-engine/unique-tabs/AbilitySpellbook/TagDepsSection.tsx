'use client';

import { useMemo } from 'react';
import { Network } from 'lucide-react';
import { motion } from 'framer-motion';
import { MODULE_COLORS, ACCENT_RED } from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '../_design';
import { TAG_DEP_CATEGORIES } from './data';
import { useSpellbookData } from './context';

export function TagDepsSection() {
  const { TAG_DEP_NODES, TAG_DEP_EDGES } = useSpellbookData();
  const size = 300;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 60;
  const n = TAG_DEP_NODES.length;

  const nodePositions = useMemo(() => {
    const positions: Record<string, { x: number; y: number }> = {};
    TAG_DEP_NODES.forEach((node, i) => {
      const angle = (2 * Math.PI * i) / n - Math.PI / 2;
      positions[node.id] = {
        x: cx + r * Math.cos(angle),
        y: cy + r * Math.sin(angle),
      };
    });
    return positions;
  }, []);

  return (
    <div className="space-y-4">
      <BlueprintPanel color={MODULE_COLORS.content} className="p-3">
        <SectionHeader icon={Network} label="Gameplay Tag Dependency Graph" color={MODULE_COLORS.content} />
        <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted mt-1 mb-4">
          Tags interact through blocking and requirement relationships.
        </p>

        <div className="flex justify-center min-h-[200px]">
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
            {TAG_DEP_EDGES.map((edge, i) => {
              const from = nodePositions[edge.from];
              const to = nodePositions[edge.to];
              if (!from || !to) return null;
              const edgeColor = edge.type === 'blocks' ? ACCENT_RED : MODULE_COLORS.core;
              return (
                <motion.g key={`${edge.from}-${edge.to}`}
                  initial={{ opacity: 0 }} animate={{ opacity: 0.7 }} transition={{ delay: i * 0.08 }}
                >
                  <line
                    x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                    stroke={edgeColor} strokeWidth={1.5}
                    strokeDasharray={edge.type === 'blocks' ? '6 3' : undefined}
                    markerEnd="url(#arrowhead)"
                  />
                  <text
                    x={(from.x + to.x) / 2 + 5} y={(from.y + to.y) / 2 - 6}
                    textAnchor="middle" className="text-[11px] font-mono font-bold" fill={edgeColor} style={{ fontSize: 11 }}
                  >
                    {edge.type}
                  </text>
                </motion.g>
              );
            })}

            <defs>
              <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                <polygon points="0 0, 8 3, 0 6" fill="rgba(255,255,255,0.4)" />
              </marker>
            </defs>

            {TAG_DEP_NODES.map((node, i) => {
              const pos = nodePositions[node.id];
              if (!pos) return null;
              return (
                <motion.g key={node.id}
                  initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.06 }}
                >
                  <circle cx={pos.x} cy={pos.y} r={16} fill={`${node.color}20`} stroke={node.color} strokeWidth={1.5} />
                  <text
                    x={pos.x} y={pos.y + 1}
                    textAnchor="middle" dominantBaseline="central"
                    className="text-[11px] font-mono font-bold" fill={node.color} style={{ fontSize: 11 }}
                  >
                    {node.label.split('.')[1]?.slice(0, 4) ?? node.label.slice(0, 4)}
                  </text>
                  <text
                    x={pos.x} y={pos.y + (pos.y > cy ? 28 : -22)}
                    textAnchor="middle"
                    className="text-[11px] font-mono fill-[var(--text-muted)]" style={{ fontSize: 11 }}
                  >
                    {node.label}
                  </text>
                </motion.g>
              );
            })}
          </svg>
        </div>

        {/* Category legend */}
        <div className="flex items-center gap-4 justify-center mt-4 flex-wrap">
          {Object.entries(TAG_DEP_CATEGORIES).map(([cat, color]) => (
            <div key={cat} className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.15em]">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: `${color}30`, border: `1.5px solid ${color}` }} />
              <span style={{ color, textShadow: `0 0 12px ${color}40` }}>{cat}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.15em]">
            <span className="w-5 h-0" style={{ borderTop: `1.5px dashed ${ACCENT_RED}` }} />
            <span style={{ color: ACCENT_RED }}>blocks</span>
          </div>
        </div>
      </BlueprintPanel>
    </div>
  );
}
