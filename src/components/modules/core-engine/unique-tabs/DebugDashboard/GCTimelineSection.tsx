'use client';

import { motion } from 'framer-motion';
import { Timer } from 'lucide-react';
import { STATUS_SUCCESS, STATUS_ERROR, ACCENT_ORANGE, OPACITY_10 } from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '../_design';
import { ACCENT } from './data';
import { GC_EVENTS, GC_AVG_INTERVAL, GC_WARNING_THRESHOLD_MS } from './data-perf';

export function GCTimelineSection() {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
      <div className="flex items-center justify-between mb-3">
        <SectionHeader label="GC_TIMELINE" color={ACCENT} icon={Timer} />
        <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted shrink-0 ml-2">
          AVG: {GC_AVG_INTERVAL}s // WARN: {GC_WARNING_THRESHOLD_MS}ms
        </span>
      </div>
      <BlueprintPanel color={ACCENT} className="p-3">
        {/* Timeline visualization */}
        <div className="relative h-32 min-h-[200px] rounded-sm overflow-hidden mb-3" style={{ backgroundColor: `${ACCENT}06` }}>
          {/* Y-axis labels */}
          <div className="absolute left-0 top-0 bottom-0 w-10 flex flex-col justify-between py-1 text-[10px] font-mono text-text-muted text-right pr-1">
            <span>8ms</span><span>4ms</span><span>0ms</span>
          </div>
          {/* Warning threshold line */}
          <div className="absolute left-10 right-0 h-[1px] border-t border-dashed" style={{ top: `${100 - (GC_WARNING_THRESHOLD_MS / 8) * 100}%`, borderColor: `${ACCENT}30` }}>
            <span className="absolute right-0 -top-3 text-[10px] font-mono text-text-muted">WARN {GC_WARNING_THRESHOLD_MS}ms</span>
          </div>
          {/* GC event bars */}
          <div className="absolute left-10 right-0 top-0 bottom-0 flex items-end">
            {GC_EVENTS.map((evt) => {
              const maxTime = Math.max(...GC_EVENTS.map(e => e.time));
              const leftPct = (evt.time / maxTime) * 100;
              const heightPct = (evt.duration / 8) * 100;
              const isWarning = evt.duration >= GC_WARNING_THRESHOLD_MS;
              const barColor = isWarning ? STATUS_ERROR : ACCENT_ORANGE;
              return (
                <motion.div key={evt.id} className="absolute bottom-0"
                  initial={{ scaleY: 0 }} animate={{ scaleY: 1 }}
                  transition={{ delay: 0.4 + (evt.time / maxTime) * 0.3, duration: 0.3 }}
                  style={{ left: `${leftPct}%`, width: '6px', transformOrigin: 'bottom' }}
                  title={`GC @ ${evt.time}s: ${evt.duration}ms (${evt.heapBefore}MB -> ${evt.heapAfter}MB)`}>
                  <div className="w-full rounded-t-sm"
                    style={{
                      height: `${Math.min(heightPct, 100)}%`,
                      backgroundColor: `${barColor}80`,
                      boxShadow: isWarning ? `0 0 6px ${STATUS_ERROR}60` : `0 0 4px ${ACCENT_ORANGE}30`,
                      minHeight: '2px',
                    }}
                  />
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Last 10 GC events table */}
        <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted mb-1.5">LAST 10 GC EVENTS</div>
        <div className="grid grid-cols-5 gap-2 text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted pb-1 border-b border-border">
          <span>Time</span><span className="text-center">Duration</span><span className="text-center">Heap Before</span><span className="text-center">Heap After</span><span className="text-right">Status</span>
        </div>
        <div className="space-y-0.5 max-h-40 overflow-y-auto custom-scrollbar">
          {GC_EVENTS.map((evt) => {
            const isWarning = evt.duration >= GC_WARNING_THRESHOLD_MS;
            return (
              <div key={evt.id} className="grid grid-cols-5 gap-2 text-xs font-mono py-0.5 hover:bg-surface-deep/50 transition-colors">
                <span className="text-text-muted">{evt.time.toFixed(1)}s</span>
                <span className="text-center font-bold" style={{ color: isWarning ? STATUS_ERROR : ACCENT_ORANGE }}>{evt.duration.toFixed(1)}ms</span>
                <span className="text-center text-text-muted">{evt.heapBefore}MB</span>
                <span className="text-center text-text-muted">{evt.heapAfter}MB</span>
                <span className="text-right">
                  {isWarning ? (
                    <span className="text-[10px] px-1 py-[1px] rounded" style={{ color: STATUS_ERROR, backgroundColor: `${STATUS_ERROR}${OPACITY_10}` }}>WARN</span>
                  ) : (
                    <span className="text-[10px] px-1 py-[1px] rounded" style={{ color: STATUS_SUCCESS, backgroundColor: `${STATUS_SUCCESS}${OPACITY_10}` }}>OK</span>
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
