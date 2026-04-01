'use client';

import { motion } from 'framer-motion';
import { Network } from 'lucide-react';
import { ACCENT_PINK } from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '../_design';
import { FLOW_NODES, FLOW_EDGES, FLOW_GROUP_COLORS } from './data';

const ACCENT = ACCENT_PINK;

interface FlowGraphProps {
  highlightedFlowNode: string | null;
  onToggleNode: (id: string) => void;
}

export function FlowGraph({ highlightedFlowNode, onToggleNode }: FlowGraphProps) {
  return (
    <BlueprintPanel color={ACCENT} className="p-3">
      <SectionHeader label="Interactive Screen Flow Graph" color={ACCENT} icon={Network} />
      <div className="flex justify-center min-h-[200px] bg-surface-deep/30 rounded-lg p-2">
        <svg width={340} height={340} viewBox="0 0 340 340" className="overflow-visible">
          <style>{`g.flow-node:focus { outline: none; } g.flow-node:focus-visible .focus-ring { opacity: 0.6; }`}</style>
          {FLOW_EDGES.map((edge, i) => {
            const si = FLOW_NODES.findIndex((n) => n.id === edge.source);
            const ti = FLOW_NODES.findIndex((n) => n.id === edge.target);
            if (si < 0 || ti < 0) return null;
            const count = FLOW_NODES.length;
            const angleS = (2 * Math.PI * si) / count - Math.PI / 2;
            const angleT = (2 * Math.PI * ti) / count - Math.PI / 2;
            const radius = 140;
            const sx = 200 + radius * Math.cos(angleS);
            const sy = 200 + radius * Math.sin(angleS);
            const tx = 200 + radius * Math.cos(angleT);
            const ty = 200 + radius * Math.sin(angleT);
            const mx = (sx + tx) / 2;
            const my = (sy + ty) / 2;
            const isHighlighted = highlightedFlowNode === edge.source || highlightedFlowNode === edge.target;
            return (
              <g key={`edge-${i}`}>
                <line x1={sx} y1={sy} x2={tx} y2={ty}
                  stroke={isHighlighted ? ACCENT : 'rgba(255,255,255,0.12)'}
                  strokeWidth={isHighlighted ? 2 : 1.5}
                  strokeDasharray={edge.style === 'dashed' ? '6 4' : undefined}
                  style={{ transition: 'stroke 0.2s, stroke-width 0.2s' }} />
                <motion.line
                  x1={sx} y1={sy} x2={tx} y2={ty}
                  stroke={isHighlighted ? ACCENT : 'rgba(255,255,255,0.2)'}
                  strokeWidth={isHighlighted ? 1.5 : 1}
                  strokeDasharray="6 10" strokeLinecap="round"
                  initial={{ strokeDashoffset: 0, opacity: 0 }}
                  animate={{
                    strokeDashoffset: edge.style === 'dashed' ? 32 : -32,
                    opacity: isHighlighted ? [0.4, 0.8, 0.4] : [0.15, 0.35, 0.15],
                  }}
                  transition={{
                    strokeDashoffset: { duration: 1.8, ease: 'linear', repeat: Infinity },
                    opacity: { duration: 1.8, ease: 'easeInOut', repeat: Infinity },
                  }}
                  style={isHighlighted ? { filter: `drop-shadow(0 0 3px ${ACCENT}80)` } : undefined}
                />
                {edge.label && (
                  <text x={mx} y={my - 6} textAnchor="middle"
                    className="text-xs font-mono"
                    fill={isHighlighted ? ACCENT : 'var(--text-muted)'}
                    style={{ transition: 'fill 0.2s' }}>{edge.label}</text>
                )}
              </g>
            );
          })}
          {FLOW_NODES.map((node, i) => {
            const count = FLOW_NODES.length;
            const angle = (2 * Math.PI * i) / count - Math.PI / 2;
            const radius = 140;
            const x = 200 + radius * Math.cos(angle);
            const y = 200 + radius * Math.sin(angle);
            const nodeColor = node.color ?? ACCENT;
            const isHighlighted = highlightedFlowNode === node.id;
            return (
              <g key={node.id}
                onClick={() => onToggleNode(node.id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleNode(node.id); } }}
                tabIndex={0} role="button" aria-label={`Select ${node.label} node (${node.group})`}
                className="flow-node cursor-pointer">
                <circle className="focus-ring" cx={x} cy={y} r={(isHighlighted ? 28 : 24) + 5}
                  fill="none" stroke={nodeColor} strokeWidth="2" strokeDasharray="4 3" opacity={0}
                  style={{ transition: 'opacity 0.15s' }} />
                <circle cx={x} cy={y} r={isHighlighted ? 28 : 24}
                  fill={`${nodeColor}${isHighlighted ? '40' : '20'}`}
                  stroke={nodeColor} strokeWidth={isHighlighted ? 3 : 2}
                  style={{ filter: isHighlighted ? `drop-shadow(0 0 10px ${nodeColor})` : `drop-shadow(0 0 4px ${nodeColor}40)`, transition: 'all 0.2s' }} />
                <text x={x} y={y} textAnchor="middle" dominantBaseline="central"
                  className="text-xs font-mono font-bold pointer-events-none" fill={nodeColor}>{node.label}</text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="flex flex-wrap gap-3 mt-3 justify-center">
        {Object.entries(FLOW_GROUP_COLORS).map(([group, color]) => (
          <span key={group} className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-[0.15em] font-bold" style={{ color }}>
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 4px ${color}` }} />
            {group}
          </span>
        ))}
      </div>
    </BlueprintPanel>
  );
}
