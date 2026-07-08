'use client';

import { ACCENT_EMERALD } from '@/lib/chart-colors';
import { TODAY_COLOR } from './constants';

export function RoadmapLegend() {
  return (
    <div className="flex items-center gap-4 text-xs text-text-muted">
      <span className="flex items-center gap-1.5">
        <span
          className="w-8 h-2 rounded-full"
          style={{ backgroundImage: `linear-gradient(to right, ${ACCENT_EMERALD}99, ${ACCENT_EMERALD})` }}
        />
        Predicted
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-3 h-3 rounded-sm border-2 border-dashed border-amber-400" />
        Target Deadline
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-0.5 h-3 rounded-full" style={{ backgroundColor: TODAY_COLOR }} />
        Today
      </span>
    </div>
  );
}
