'use client';

import { STATE_NODES, ACCENT } from '../data';
import { withOpacity, OPACITY_30, OPACITY_50 } from '@/lib/chart-colors';

const edgeCount = STATE_NODES.reduce((sum, n) => sum + n.transitions.length, 0);

export function TransitionsMetric() {
  return (
    <div className="flex items-center gap-1.5">
      {/* Mini directed-graph icon */}
      <svg width="20" height="16" viewBox="0 0 20 16" aria-hidden="true">
        <circle cx="4" cy="4" r="2.5" fill={withOpacity(ACCENT, OPACITY_50)} />
        <circle cx="16" cy="4" r="2.5" fill={withOpacity(ACCENT, OPACITY_50)} />
        <circle cx="10" cy="13" r="2.5" fill={withOpacity(ACCENT, OPACITY_50)} />
        <line x1="6.5" y1="4" x2="13.5" y2="4" stroke={withOpacity(ACCENT, OPACITY_30)} strokeWidth="1" />
        <line x1="5" y1="6" x2="9" y2="11" stroke={withOpacity(ACCENT, OPACITY_30)} strokeWidth="1" />
        <line x1="15" y1="6" x2="11" y2="11" stroke={withOpacity(ACCENT, OPACITY_30)} strokeWidth="1" />
        {/* Arrow heads */}
        <polygon points="13.5,3 13.5,5 15,4" fill={withOpacity(ACCENT, OPACITY_50)} />
        <polygon points="8,10.5 10,11.5 9,9.5" fill={withOpacity(ACCENT, OPACITY_50)} />
        <polygon points="12,10.5 10,11.5 11,9.5" fill={withOpacity(ACCENT, OPACITY_50)} />
      </svg>
      <div className="text-[10px] font-mono leading-tight">
        <span className="font-bold" style={{ color: ACCENT }}>{edgeCount}</span>
        <span style={{ color: withOpacity(ACCENT, OPACITY_50) }}> edges</span>
      </div>
    </div>
  );
}
