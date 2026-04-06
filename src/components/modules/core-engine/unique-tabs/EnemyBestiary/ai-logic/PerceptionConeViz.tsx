'use client';

import type { DetectedEntity } from '../data';
import { ACCENT_CYAN, OVERLAY_WHITE, withOpacity, OPACITY_25, OPACITY_12, OPACITY_50, OPACITY_4, OPACITY_30 } from '@/lib/chart-colors';

interface PerceptionConeVizProps {
  entities: DetectedEntity[];
  accent?: string;
}

export function PerceptionConeViz({ entities, accent = ACCENT_CYAN }: PerceptionConeVizProps) {
  return (
    <svg width={200} height={200} viewBox="0 0 130 130" className="flex-shrink-0">
      {/* Background grid */}
      {[32.5, 65, 97.5].map(r => (
        <circle key={r} cx={65} cy={65} r={r} fill="none" stroke={withOpacity(OVERLAY_WHITE, OPACITY_4)} strokeWidth="1" />
      ))}
      {/* Hearing circle (800cm radius - scaled) */}
      <circle cx={65} cy={65} r={44.7} fill="none" stroke={`${withOpacity(accent, OPACITY_25)}`} strokeWidth="1.5" strokeDasharray="4 3" />
      {/* Sight cone: 60 degrees, pointing up */}
      <path
        d={`M 65 65 L ${65 + 56.9 * Math.cos(-Math.PI / 2 - Math.PI / 6)} ${65 + 56.9 * Math.sin(-Math.PI / 2 - Math.PI / 6)} A 56.9 56.9 0 0 1 ${65 + 56.9 * Math.cos(-Math.PI / 2 + Math.PI / 6)} ${65 + 56.9 * Math.sin(-Math.PI / 2 + Math.PI / 6)} Z`}
        fill={`${withOpacity(accent, OPACITY_12)}`} stroke={`${withOpacity(accent, OPACITY_50)}`} strokeWidth="1.5"
      />
      {/* AI center */}
      <circle cx={65} cy={65} r={5} fill={accent} style={{ filter: `drop-shadow(0 0 6px ${accent})` }} />
      <text x={65} y={77.2} textAnchor="middle" className="text-xs font-mono font-bold" fill={accent}>AI</text>
      {/* Detected entities */}
      {entities.map(e => (
        <g key={e.label}>
          <circle cx={e.x} cy={e.y} r={4} fill={e.color} style={{ filter: `drop-shadow(0 0 4px ${e.color})` }} />
          <text x={e.x} y={e.y - 8} textAnchor="middle" className="text-xs font-mono font-bold" fill={e.color}>{e.label}</text>
        </g>
      ))}
      {/* Range labels */}
      <text x={65} y={17.9} textAnchor="middle" className="text-xs font-mono" fill={withOpacity(OVERLAY_WHITE, OPACITY_30)}>1500cm</text>
      <text x={111.3} y={65} textAnchor="middle" className="text-xs font-mono" fill={withOpacity(OVERLAY_WHITE, OPACITY_30)}>800cm</text>
    </svg>
  );
}
