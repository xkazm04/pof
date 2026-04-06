'use client';

import { SEQ_EVENTS, SEQ_LANES, ACCENT } from '../data';
import { withOpacity, OPACITY_50 } from '@/lib/chart-colors';

const eventCount = SEQ_EVENTS.length;
const systemCount = SEQ_LANES.length;

export function SequencesMetric() {
  return (
    <div className="text-[10px] font-mono leading-tight">
      <span className="font-bold" style={{ color: ACCENT }}>{eventCount}</span>
      <span style={{ color: withOpacity(ACCENT, OPACITY_50) }}> events / </span>
      <span className="font-bold" style={{ color: ACCENT }}>{systemCount}</span>
      <span style={{ color: withOpacity(ACCENT, OPACITY_50) }}> systems</span>
    </div>
  );
}
