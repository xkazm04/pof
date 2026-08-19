'use client';

import { BUDGET_LIMITS, ACCENT } from '../_shared/data';
import { withOpacity, OPACITY_50 } from '@/lib/chart-colors';

// The bone budget is a target. It used to render "65/120" with a filled bar, but
// the 65 was a literal in _shared/data.ts — nothing counts the bones a skeleton
// actually evaluates, and the bridge manifest carries no bone figure. So the tile
// shows the budget and says the usage is unread.
const boneLimit = BUDGET_LIMITS.find((l) => l.label === 'Bone Count');

export function SkeletonMetric() {
  return (
    <div className="space-y-1">
      <div className="text-xs font-mono leading-tight">
        <span className="font-bold" style={{ color: ACCENT }}>&le;{boneLimit?.target ?? '?'}</span>
        <span style={{ color: withOpacity(ACCENT, OPACITY_50) }}> budget</span>
      </div>
      <div className="text-xs font-mono leading-tight" style={{ color: withOpacity(ACCENT, OPACITY_50) }}>
        usage unread
      </div>
    </div>
  );
}
