'use client';

import { AlertTriangle } from 'lucide-react';
import {
  STATUS_ERROR, STATUS_WARNING,
  ACCENT_EMERALD, ACCENT_CYAN,
  OPACITY_10,
} from '@/lib/chart-colors';
import { ACCENT } from './constants';

export function BreakpointLegend() {
  return (
    <div className="flex flex-wrap items-center gap-4 px-1 text-xs font-mono uppercase tracking-[0.15em] text-text-muted">
      <span className="font-bold">Legend:</span>
      <span className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: STATUS_ERROR }} /> Offensive
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: ACCENT_EMERALD }} /> Defensive
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: ACCENT_CYAN }} /> Utility
      </span>
      <span className="flex items-center gap-1.5"
        style={{ borderLeft: `1px solid ${ACCENT}25`, paddingLeft: '1rem' }}>
        <AlertTriangle className="w-3 h-3" style={{ color: STATUS_ERROR }} /> Aggressive (&gt;8x)
      </span>
      <span className="flex items-center gap-1.5">
        <span className="px-1 py-0.5 rounded"
          style={{ backgroundColor: `${STATUS_WARNING}${OPACITY_10}`, color: STATUS_WARNING }}>Flat</span> &lt;3x
      </span>
    </div>
  );
}
