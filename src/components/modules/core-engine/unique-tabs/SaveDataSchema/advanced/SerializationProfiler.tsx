'use client';

import { Timer } from 'lucide-react';
import { motion } from 'framer-motion';
import { STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, ACCENT_CYAN_LIGHT,
  withOpacity, OPACITY_8, OPACITY_25, OPACITY_37, OPACITY_5,
} from '@/lib/chart-colors';
import { LiveMetricGauge } from '../../_shared';
import { BlueprintPanel, SectionHeader } from '../design';
import { ACCENT } from '../data';
import {
  SERIALIZATION_SEGMENTS, SERIALIZATION_BUDGET_MS,
  SERIALIZATION_TOTAL, PERF_METRICS,
} from '../data-panels';

export function SerializationProfiler() {
  return (
    <BlueprintPanel color={ACCENT} className="p-0 overflow-hidden">
      <div className="px-4 py-3 border-b border-border/10 flex items-center justify-between">
        <SectionHeader label="SERIALIZATION_PROFILER" icon={Timer} color={ACCENT} />
        <span className="text-xs font-mono uppercase tracking-[0.15em]" style={{ color: ACCENT_CYAN_LIGHT }}>
          {SERIALIZATION_TOTAL}ms / {SERIALIZATION_BUDGET_MS}ms budget
        </span>
      </div>

      <div className="p-4 space-y-4 relative z-10">
        {/* Stacked bar chart */}
        <div className="space-y-3">
          <div className="flex items-center gap-1 h-10 rounded-lg overflow-hidden border border-border/10" style={{ backgroundColor: `${withOpacity(ACCENT, OPACITY_8)}` }}>
            {SERIALIZATION_SEGMENTS.map((seg) => {
              const pct = (seg.timeMs / SERIALIZATION_BUDGET_MS) * 100;
              return (
                <motion.div
                  key={seg.label}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                  className="h-full flex items-center justify-center relative group cursor-default"
                  style={{ backgroundColor: `${withOpacity(seg.color, OPACITY_25)}`, borderRight: `1px solid ${withOpacity(seg.color, OPACITY_37)}` }}
                  title={`${seg.label}: ${seg.timeMs}ms`}
                >
                  {pct > 8 && (
                    <span className="text-xs font-mono font-bold relative z-10" style={{ color: seg.color }}>
                      {seg.timeMs}ms
                    </span>
                  )}
                </motion.div>
              );
            })}
            <div className="flex-1 h-full flex items-center justify-center">
              <span className="text-xs font-mono text-text-muted">{SERIALIZATION_BUDGET_MS - SERIALIZATION_TOTAL}ms free</span>
            </div>
          </div>

          {/* Budget line */}
          <div className="relative h-1">
            <div className="absolute inset-0 rounded-full" style={{ backgroundColor: `${withOpacity(ACCENT, OPACITY_8)}` }} />
            <motion.div
              className="absolute top-0 bottom-0 left-0 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${(SERIALIZATION_TOTAL / SERIALIZATION_BUDGET_MS) * 100}%` }}
              transition={{ duration: 0.8 }}
              style={{ backgroundColor: SERIALIZATION_TOTAL < SERIALIZATION_BUDGET_MS * 0.75 ? STATUS_SUCCESS : SERIALIZATION_TOTAL < SERIALIZATION_BUDGET_MS * 0.95 ? STATUS_WARNING : STATUS_ERROR }}
            />
          </div>
        </div>

        {/* Per-section breakdown */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 font-mono text-xs">
          {SERIALIZATION_SEGMENTS.map(seg => (
            <div key={seg.label} className="border border-border/10 rounded-lg p-2.5" style={{ backgroundColor: `${withOpacity(ACCENT, OPACITY_5)}` }}>
              <div className="flex items-center gap-1.5 mb-1">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: seg.color }} />
                <span className="text-xs font-bold uppercase tracking-[0.15em]" style={{ color: ACCENT_CYAN_LIGHT }}>{seg.label}</span>
              </div>
              <div className="text-lg font-bold" style={{ color: seg.color }}>{seg.timeMs}<span className="text-xs text-text-muted">ms</span></div>
              <div className="text-xs text-text-muted">{((seg.timeMs / SERIALIZATION_TOTAL) * 100).toFixed(0)}% of total</div>
            </div>
          ))}
        </div>

        {/* Gauges */}
        <div className="flex justify-center gap-4 pt-2 border-t border-border/10">
          {PERF_METRICS.map(m => (
            <LiveMetricGauge key={m.label} metric={m} size={72} accent={ACCENT} />
          ))}
        </div>
      </div>
    </BlueprintPanel>
  );
}
