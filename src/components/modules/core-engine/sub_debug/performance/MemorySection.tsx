'use client';

import { motion } from 'framer-motion';
import { PieChart } from 'lucide-react';
import { STATUS_SUCCESS, STATUS_ERROR, OPACITY_25, withOpacity,
  OPACITY_90,
} from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader, NeonBar } from '../../unique-tabs/_design';
import { ACCENT, SLICE_COLORS } from '../_shared/data';
import type { DebugSnapshot } from '@/components/modules/core-engine/sub_debug/_shared/debugSnapshot';

const sliceColor = (i: number) => SLICE_COLORS[i % SLICE_COLORS.length];

/** Memory as the capture's allocation categories: total, shares and headroom all derive from them. */
export function MemorySection({ memory }: { memory: DebugSnapshot['memory'] }) {
  const { slices, totalMB, peakMB, budgetMB, headroomMB } = memory;
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
      <SectionHeader label="MEMORY_ALLOCATION_TRACKER" color={ACCENT} icon={PieChart} />
      <BlueprintPanel color={ACCENT} className="p-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Donut chart */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <svg width="110" height="110" viewBox="0 0 140 140">
                {slices.map((slice, i) => {
                  const r = 52;
                  const circ = 2 * Math.PI * r;
                  const offset = slices.slice(0, i).reduce((s, sl) => s + sl.pct, 0);
                  return (
                    <circle
                      key={slice.label}
                      cx="70" cy="70" r={r}
                      fill="none" stroke={sliceColor(i)} strokeWidth="14"
                      strokeDasharray={`${(slice.pct / 100) * circ} ${circ}`}
                      strokeDashoffset={-(offset / 100) * circ}
                      transform="rotate(-90 70 70)"
                      style={{ filter: `drop-shadow(0 0 3px ${withOpacity(sliceColor(i), OPACITY_25)})` }}
                    />
                  );
                })}
              </svg>
              <div className="absolute inset-0 flex items-center justify-center flex-col">
                <span className="text-lg font-mono font-bold" style={{ color: `${withOpacity(ACCENT, OPACITY_90)}`, textShadow: `0 0 12px ${withOpacity(ACCENT, OPACITY_25)}` }}>{totalMB.toFixed(0)}</span>
                <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">MB TOTAL</span>
              </div>
            </div>
            {/* Legend */}
            <div className="grid grid-cols-3 gap-x-4 gap-y-1">
              {slices.map((slice, i) => (
                <div key={slice.label} className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: sliceColor(i) }} />
                  <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">{slice.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Stats panel */}
          <div className="space-y-3">
            {slices.map((slice, i) => (
              <div key={slice.label} className="flex items-center gap-1.5">
                <span className="text-xs font-mono uppercase tracking-[0.15em] w-16 text-right text-text-muted">{slice.label}</span>
                <div className="flex-1">
                  <NeonBar pct={slice.pct} color={sliceColor(i)} height={4} />
                </div>
                <span className="text-xs font-mono font-bold w-16 text-right" style={{ color: sliceColor(i) }}>
                  {slice.mb.toFixed(0)}MB <span className="text-text-muted">({slice.pct}%)</span>
                </span>
              </div>
            ))}
            <div className="border-t border-border pt-2 mt-2 space-y-1.5">
              <div className="flex justify-between text-xs font-mono uppercase tracking-[0.15em]">
                <span className="text-text-muted">Peak</span>
                <span className="font-bold" style={{ color: `${withOpacity(ACCENT, OPACITY_90)}` }}>{peakMB.toFixed(0)}MB</span>
              </div>
              <div className="flex justify-between text-xs font-mono uppercase tracking-[0.15em]">
                <span className="text-text-muted">Budget Remaining</span>
                <span className="font-bold" style={{ color: headroomMB >= 0 ? STATUS_SUCCESS : STATUS_ERROR }}>{headroomMB.toFixed(0)}MB</span>
              </div>
              <NeonBar pct={Math.min((totalMB / budgetMB) * 100, 100)} color={ACCENT} height={4} glow />
              <div className="flex justify-between text-xs font-mono uppercase tracking-[0.15em] text-text-muted">
                <span>0MB</span>
                <span>{budgetMB}MB BUDGET</span>
              </div>
            </div>
          </div>
        </div>
      </BlueprintPanel>
    </motion.div>
  );
}
