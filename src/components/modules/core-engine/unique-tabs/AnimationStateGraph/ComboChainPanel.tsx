'use client';

import { ACCENT_CYAN, STATUS_ERROR } from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '../_design';
import { ACCENT, COMBO_CHAIN_NODES, COMBO_CHAIN_EDGES } from './data';

export function ComboChainPanel() {
  return (
    <BlueprintPanel color={ACCENT} className="p-4">
      <SectionHeader label="Combo Chain Graph" color={ACCENT} />
      <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted mt-1 mb-3">
        Attack combo sequence with damage values and combo window timing between nodes.
      </p>
      <div className="flex justify-center overflow-x-auto min-h-[200px]">
        <svg width={400} height={110} viewBox="0 0 400 110" className="overflow-visible">
          {/* Edges (arrows) */}
          {COMBO_CHAIN_EDGES.map((edge) => {
            const from = COMBO_CHAIN_NODES.find((n) => n.id === edge.from)!;
            const to = COMBO_CHAIN_NODES.find((n) => n.id === edge.to)!;
            const x1 = from.x + 49;
            const x2 = to.x - 5;
            const y = from.y;
            return (
              <g key={`${edge.from}-${edge.to}`}>
                <defs>
                  <marker id={`arrow-${edge.from}`} markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                    <path d="M0,0 L8,3 L0,6" fill={ACCENT} />
                  </marker>
                </defs>
                <line x1={x1} y1={y} x2={x2} y2={y} stroke={ACCENT} strokeWidth="2" markerEnd={`url(#arrow-${edge.from})`} />
                <text x={(x1 + x2) / 2} y={y - 10} textAnchor="middle" className="text-[11px] font-mono" fill={ACCENT_CYAN} style={{ fontSize: 11 }}>{edge.window}</text>
              </g>
            );
          })}
          {/* Nodes */}
          {COMBO_CHAIN_NODES.map((node) => (
            <g key={node.id}>
              <rect x={node.x - 5} y={node.y - 24} width={98} height={47} rx={6} fill={`${ACCENT}15`} stroke={`${ACCENT}50`} strokeWidth="1.5" />
              <text x={node.x + 44} y={node.y - 9} textAnchor="middle" className="text-xs font-bold fill-[var(--text)]" style={{ fontSize: 12 }}>{node.name}</text>
              <text x={node.x + 44} y={node.y + 2} textAnchor="middle" className="text-[11px] font-mono fill-[var(--text-muted)]" style={{ fontSize: 11 }}>{node.montage}</text>
              <text x={node.x + 44} y={node.y + 13} textAnchor="middle" className="text-[11px] font-mono font-bold" fill={STATUS_ERROR} style={{ fontSize: 11 }}>
                {node.damage} dmg
              </text>
            </g>
          ))}
        </svg>
      </div>
    </BlueprintPanel>
  );
}
