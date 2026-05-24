'use client';

import { Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  STATUS_WARNING, STATUS_SUCCESS, STATUS_LOCKED,
  ACCENT_ORANGE, ACCENT_EMERALD, ACCENT_PINK,
  OPACITY_22, OPACITY_37,
  withOpacity,
} from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '../../unique-tabs/_design';
import { ZONE_PROGRESSION, TOTAL_ESTIMATED_DAYS, CURRENT_DAY } from '../_shared/data';

export function ProgressionTimeline() {
  return (
    <BlueprintPanel color={ACCENT_EMERALD} className="p-3">
      <SectionHeader icon={Clock} label="Zone Progression Timeline" color={ACCENT_EMERALD} />

      <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted mb-2">
        Day <span className="font-bold" style={{ color: ACCENT_PINK }}>{CURRENT_DAY}</span> / {TOTAL_ESTIMATED_DAYS} estimated
      </div>

      <div className="relative">
        <div
          className="absolute top-0 bottom-0 w-[2px] z-10"
          style={{
            left: `${(CURRENT_DAY / TOTAL_ESTIMATED_DAYS) * 100}%`,
            backgroundColor: ACCENT_PINK,
            boxShadow: `0 0 6px ${withOpacity(ACCENT_PINK, OPACITY_37)}`,
          }}
        />

        <div className="space-y-3">
          {ZONE_PROGRESSION.map((zp) => {
            const started = zp.firstVisitDay >= 0;
            const startPct = started ? (zp.firstVisitDay / TOTAL_ESTIMATED_DAYS) * 100 : 0;
            const endDay = zp.completionDay ?? CURRENT_DAY;
            const widthPct = started ? ((endDay - zp.firstVisitDay) / TOTAL_ESTIMATED_DAYS) * 100 : 0;
            const gradientColor = zp.completionPct === 100 ? STATUS_SUCCESS
              : zp.completionPct >= 50 ? STATUS_WARNING
                : zp.completionPct > 0 ? ACCENT_ORANGE : STATUS_LOCKED;

            return (
              <div key={zp.zone} className="flex items-center gap-3">
                <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted w-28 truncate text-right flex-shrink-0">{zp.zone}</span>
                <div className="relative flex-1 h-6 bg-surface-deep rounded-md overflow-hidden border border-border/30">
                  {started ? (
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${widthPct}%` }}
                      transition={{ duration: 0.6 }}
                      className="absolute top-0 bottom-0 rounded-md flex items-center justify-center"
                      style={{
                        left: `${startPct}%`,
                        backgroundColor: `${withOpacity(gradientColor, OPACITY_22)}`,
                        border: `1px solid ${withOpacity(gradientColor, OPACITY_37)}`,
                      }}
                    >
                      <span className="text-xs font-mono font-bold" style={{ color: gradientColor }}>
                        {zp.completionPct}%
                      </span>
                    </motion.div>
                  ) : (
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-mono text-text-muted opacity-40">
                      Not visited
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Day axis */}
        <div className="flex items-center gap-3 mt-2">
          <span className="w-28 flex-shrink-0" />
          <div className="flex-1 flex justify-between text-xs font-mono text-text-muted px-1">
            {Array.from({ length: Math.ceil(TOTAL_ESTIMATED_DAYS / 2) + 1 }, (_, i) => (
              <span key={i}>{i * 2}d</span>
            ))}
          </div>
        </div>
      </div>
    </BlueprintPanel>
  );
}
