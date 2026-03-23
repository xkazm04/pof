'use client';

import { motion } from 'framer-motion';
import { PieChart } from 'lucide-react';
import { STATUS_SUCCESS } from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader, NeonBar } from '../_design';
import { ACCENT, MEMORY_SLICES, MEMORY_TOTAL_MB, MEMORY_PEAK_MB, MEMORY_BUDGET_MB } from './data';

export function MemorySection() {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
      <SectionHeader label="MEMORY_ALLOCATION_TRACKER" color={ACCENT} icon={PieChart} />
      <BlueprintPanel color={ACCENT} className="p-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Donut chart */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <svg width="110" height="110" viewBox="0 0 140 140">
                {(() => {
                  let cumulative = 0;
                  const r = 52;
                  const circ = 2 * Math.PI * r;
                  return MEMORY_SLICES.map((slice) => {
                    const offset = cumulative;
                    cumulative += slice.pct;
                    return (
                      <circle
                        key={slice.label}
                        cx="70" cy="70" r={r}
                        fill="none" stroke={slice.color} strokeWidth="14"
                        strokeDasharray={`${(slice.pct / 100) * circ} ${circ}`}
                        strokeDashoffset={-(offset / 100) * circ}
                        transform="rotate(-90 70 70)"
                        style={{ filter: `drop-shadow(0 0 3px ${slice.color}40)` }}
                      />
                    );
                  });
                })()}
              </svg>
              <div className="absolute inset-0 flex items-center justify-center flex-col">
                <span className="text-lg font-mono font-bold" style={{ color: `${ACCENT}ee`, textShadow: `0 0 12px ${ACCENT}40` }}>{MEMORY_TOTAL_MB}</span>
                <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted">MB TOTAL</span>
              </div>
            </div>
            {/* Legend */}
            <div className="grid grid-cols-3 gap-x-4 gap-y-1">
              {MEMORY_SLICES.map((slice) => (
                <div key={slice.label} className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: slice.color }} />
                  <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted">{slice.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Stats panel */}
          <div className="space-y-3">
            {MEMORY_SLICES.map((slice) => (
              <div key={slice.label} className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase tracking-[0.15em] w-16 text-right text-text-muted">{slice.label}</span>
                <div className="flex-1">
                  <NeonBar pct={slice.pct} color={slice.color} height={4} />
                </div>
                <span className="text-xs font-mono font-bold w-16 text-right" style={{ color: slice.color }}>
                  {slice.mb.toFixed(0)}MB <span className="text-text-muted">({slice.pct}%)</span>
                </span>
              </div>
            ))}
            <div className="border-t border-border pt-2 mt-2 space-y-1.5">
              <div className="flex justify-between text-[10px] font-mono uppercase tracking-[0.15em]">
                <span className="text-text-muted">Peak</span>
                <span className="font-bold" style={{ color: `${ACCENT}ee` }}>{MEMORY_PEAK_MB}MB</span>
              </div>
              <div className="flex justify-between text-[10px] font-mono uppercase tracking-[0.15em]">
                <span className="text-text-muted">Budget Remaining</span>
                <span className="font-bold" style={{ color: STATUS_SUCCESS }}>{MEMORY_BUDGET_MB - MEMORY_TOTAL_MB}MB</span>
              </div>
              <NeonBar pct={(MEMORY_TOTAL_MB / MEMORY_BUDGET_MB) * 100} color={ACCENT} height={4} glow />
              <div className="flex justify-between text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted">
                <span>0MB</span>
                <span>{MEMORY_BUDGET_MB}MB BUDGET</span>
              </div>
            </div>
          </div>
        </div>
      </BlueprintPanel>
    </motion.div>
  );
}
