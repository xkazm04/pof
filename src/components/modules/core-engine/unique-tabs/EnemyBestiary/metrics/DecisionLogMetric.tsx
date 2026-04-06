'use client';

import { DECISION_LOG } from '../data';
import { ACCENT_PURPLE, withOpacity, OPACITY_50 } from '@/lib/chart-colors';

const decisionCount = DECISION_LOG.length;
const tickSpan = DECISION_LOG.length >= 2
  ? DECISION_LOG[DECISION_LOG.length - 1].tick - DECISION_LOG[0].tick
  : 1;
const throughput = (decisionCount / Math.max(tickSpan, 1)).toFixed(1);

export function DecisionLogMetric() {
  return (
    <div className="text-[10px] font-mono leading-tight">
      <span className="font-bold" style={{ color: ACCENT_PURPLE }}>{throughput}</span>
      <span style={{ color: withOpacity(ACCENT_PURPLE, OPACITY_50) }}> decisions/tick</span>
    </div>
  );
}
