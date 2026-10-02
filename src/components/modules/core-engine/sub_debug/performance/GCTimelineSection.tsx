'use client';

import { motion } from 'framer-motion';
import { Timer } from 'lucide-react';
import { STATUS_SUCCESS, STATUS_ERROR, ACCENT_ORANGE, OPACITY_10,
  withOpacity, OPACITY_5, OPACITY_20, OPACITY_50, OPACITY_37,
} from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '../../unique-tabs/_design';
import { ACCENT } from '../_shared/data';
import type { DebugSnapshot } from '@/components/modules/core-engine/sub_debug/_shared/debugSnapshot';

/** GC pauses of the capture; the interval and warn count derive from them. */
export function GCTimelineSection({ gc }: { gc: DebugSnapshot['gc'] }) {
  const { events, warnThresholdMs } = gc;
  const maxTime = Math.max(1, ...events.map((e) => e.timeS));
  const yMax = Math.max(8, Math.ceil(Math.max(0, ...events.map((e) => e.durationMs))));
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
      <div className="flex items-center justify-between mb-3">
        <SectionHeader label="GC_TIMELINE" color={ACCENT} icon={Timer} />
        <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted shrink-0 ml-2">
          AVG: {gc.avgIntervalS === null ? 'n/a' : `${gc.avgIntervalS}s`}{' // '}WARN: {warnThresholdMs}ms ({gc.warnCount})
        </span>
      </div>
      <BlueprintPanel color={ACCENT} className="p-3">
        {/* Timeline visualization */}
        <div className="relative h-32 min-h-[200px] rounded-sm overflow-hidden mb-3" style={{ backgroundColor: `${withOpacity(ACCENT, OPACITY_5)}` }}>
          {/* Y-axis labels */}
          <div className="absolute left-0 top-0 bottom-0 w-10 flex flex-col justify-between py-1 text-xs font-mono text-text-muted text-right pr-1">
            <span>{yMax}ms</span><span>{yMax / 2}ms</span><span>0ms</span>
          </div>
          {/* Warning threshold line */}
          <div className="absolute left-10 right-0 h-[1px] border-t border-dashed" style={{ top: `${100 - (warnThresholdMs / yMax) * 100}%`, borderColor: `${withOpacity(ACCENT, OPACITY_20)}` }}>
            <span className="absolute right-0 -top-3 text-xs font-mono text-text-muted">WARN {warnThresholdMs}ms</span>
          </div>
          {/* GC event bars */}
          <div className="absolute left-10 right-0 top-0 bottom-0 flex items-end">
            {events.map((evt, i) => {
              const leftPct = (evt.timeS / maxTime) * 100;
              const heightPct = (evt.durationMs / yMax) * 100;
              const isWarning = evt.warn;
              const barColor = isWarning ? STATUS_ERROR : ACCENT_ORANGE;
              return (
                <motion.div key={`${evt.timeS}-${i}`} className="absolute bottom-0"
                  initial={{ scaleY: 0 }} animate={{ scaleY: 1 }}
                  transition={{ delay: 0.4 + (evt.timeS / maxTime) * 0.3, duration: 0.3 }}
                  style={{ left: `${leftPct}%`, width: '6px', transformOrigin: 'bottom' }}
                  title={`GC @ ${evt.timeS}s: ${evt.durationMs}ms (${evt.objectsCollected} objects, ${evt.freedMB}MB freed)`}>
                  <div className="w-full rounded-t-sm"
                    style={{
                      height: `${Math.min(heightPct, 100)}%`,
                      backgroundColor: `${withOpacity(barColor, OPACITY_50)}`,
                      boxShadow: isWarning ? `0 0 6px ${withOpacity(STATUS_ERROR, OPACITY_37)}` : `0 0 4px ${withOpacity(ACCENT_ORANGE, OPACITY_20)}`,
                      minHeight: '2px',
                    }}
                  />
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Last 10 GC events table */}
        <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted mb-1.5">GC PAUSES ({events.length})</div>
        <div className="grid grid-cols-5 gap-2 text-xs font-mono uppercase tracking-[0.15em] text-text-muted pb-1 border-b border-border">
          <span>Time</span><span className="text-center">Duration</span><span className="text-center">Objects</span><span className="text-center">Freed</span><span className="text-right">Status</span>
        </div>
        <div className="space-y-0.5 max-h-40 overflow-y-auto custom-scrollbar">
          {events.map((evt, i) => {
            const isWarning = evt.warn;
            return (
              <div key={`${evt.timeS}-${i}`} className="grid grid-cols-5 gap-2 text-xs font-mono py-0.5 hover:bg-surface-deep/50 transition-colors">
                <span className="text-text-muted">{evt.timeS.toFixed(1)}s</span>
                <span className="text-center font-bold" style={{ color: isWarning ? STATUS_ERROR : ACCENT_ORANGE }}>{evt.durationMs.toFixed(1)}ms</span>
                <span className="text-center text-text-muted">{evt.objectsCollected}</span>
                <span className="text-center text-text-muted">{evt.freedMB}MB</span>
                <span className="text-right">
                  {isWarning ? (
                    <span className="text-xs px-1 py-[1px] rounded" style={{ color: STATUS_ERROR, backgroundColor: `${STATUS_ERROR}${OPACITY_10}` }}>WARN</span>
                  ) : (
                    <span className="text-xs px-1 py-[1px] rounded" style={{ color: STATUS_SUCCESS, backgroundColor: `${STATUS_SUCCESS}${OPACITY_10}` }}>OK</span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </BlueprintPanel>
    </motion.div>
  );
}
