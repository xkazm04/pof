'use client';

import { STATUS_INFO } from '@/lib/chart-colors';
import { TODAY_COLOR } from './constants';

export function RoadmapLegend() {
  return (
    <div className="flex items-center gap-4 text-xs text-text-muted">
      <span className="flex items-center gap-1.5">
        <span
          data-testid="legend-predicted"
          className="w-8 h-2 rounded-full bg-text-muted/30"
        />
        Predicted
      </span>
      <span className="flex items-center gap-1.5">
        <span
          data-testid="legend-deadline"
          className="w-2.5 h-2.5 rotate-45"
          style={{ backgroundColor: STATUS_INFO }}
        />
        Target Deadline
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-0.5 h-3 rounded-full" style={{ backgroundColor: TODAY_COLOR }} />
        Today
      </span>
    </div>
  );
}
