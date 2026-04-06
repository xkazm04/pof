'use client';

import { FEEDBACK_PARAMS, ACCENT } from '../data';
import { withOpacity, OPACITY_25, OPACITY_50 } from '@/lib/chart-colors';

const total = FEEDBACK_PARAMS.length;
const tuned = FEEDBACK_PARAMS.filter(p => p.defaultValue !== p.min).length;
const pct = (tuned / total) * 100;

export function FeedbackTunerMetric() {
  return (
    <div className="text-[10px] font-mono leading-tight space-y-0.5">
      <div>
        <span className="font-bold" style={{ color: ACCENT }}>{tuned}/{total}</span>
        <span style={{ color: withOpacity(ACCENT, OPACITY_50) }}> params tuned</span>
      </div>
      <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: withOpacity(ACCENT, OPACITY_25) }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: ACCENT }} />
      </div>
    </div>
  );
}
