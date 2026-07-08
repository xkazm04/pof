'use client';

import { STATUS_ERROR, ACCENT_CYAN } from '@/lib/chart-colors';
import type { GeneratedCombo } from './types';
import { ACCENT } from './constants';

export function ComboChainGraph({ combo }: { combo: GeneratedCombo }) {
  const nodeWidth = 100;
  const nodeHeight = 48;
  const gap = 32;
  const svgWidth = combo.sections.length * (nodeWidth + gap) - gap + 40;
  const svgHeight = nodeHeight + 56;

  return (
    <svg width={svgWidth} height={svgHeight} className="overflow-visible">
      {/* Edges */}
      {combo.edges.map((edge, i) => {
        const x1 = 20 + edge.from * (nodeWidth + gap) + nodeWidth;
        const x2 = 20 + edge.to * (nodeWidth + gap);
        const y = nodeHeight / 2 + 8;
        return (
          <g key={i}>
            <line x1={x1} y1={y} x2={x2} y2={y} stroke={ACCENT_CYAN} strokeWidth={2} markerEnd="url(#arrow)" />
            <text x={(x1 + x2) / 2} y={y - 6} textAnchor="middle" className="text-[11px] font-mono" fill={ACCENT_CYAN}>
              {edge.windowStart.toFixed(2)}–{edge.windowEnd.toFixed(2)}s
            </text>
          </g>
        );
      })}
      {/* Arrow marker */}
      <defs>
        <marker id="arrow" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <path d="M0,0 L8,3 L0,6" fill={ACCENT_CYAN} />
        </marker>
      </defs>
      {/* Nodes */}
      {combo.sections.map((sec, i) => {
        const x = 20 + i * (nodeWidth + gap);
        const y = 8;
        return (
          <g key={i}>
            <rect
              x={x} y={y} width={nodeWidth} height={nodeHeight}
              rx={6} fill={`${ACCENT}15`} stroke={ACCENT} strokeWidth={1.5}
            />
            <text x={x + nodeWidth / 2} y={y + 16} textAnchor="middle" className="text-xs font-bold" fill="var(--text)">
              {sec.label}
            </text>
            <text x={x + nodeWidth / 2} y={y + 28} textAnchor="middle" className="text-[11px] font-mono" fill={STATUS_ERROR}>
              {sec.damage} dmg
            </text>
            <text x={x + nodeWidth / 2} y={y + 40} textAnchor="middle" className="text-[11px] font-mono" fill="var(--text-muted)">
              {sec.duration}s | {sec.rootMotionDistance}cm
            </text>
          </g>
        );
      })}
    </svg>
  );
}
