'use client';

import { memo, useMemo } from 'react';
import { Target } from 'lucide-react';
import { motion } from 'framer-motion';
import { ACCENT_CYAN } from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '../../unique-tabs/_design';
import {
  pacingModel, pacingTimeline, type RewardGroup,
} from '@/components/modules/core-engine/sub_progression/_shared/rewardPacing';

/* -- Key Milestone Timeline ----------------------------------------------- */

interface MilestoneTimelineProps {
  baseXp: number;
  curveExp: number;
  /** The live reward schedule (the one the Rewards tab re-spaces and the XP table exports). */
  schedule: readonly RewardGroup<{ level: number; name: string; type: string }>[];
}

/** One row per reward level, timed on the Rewards-tab clock for the live curve. */
export const MilestoneTimeline = memo(function MilestoneTimeline({ baseXp, curveExp, schedule }: MilestoneTimelineProps) {
  const entries = useMemo(
    () => pacingTimeline(pacingModel(baseXp, curveExp), schedule),
    [baseXp, curveExp, schedule],
  );

  return (
    <BlueprintPanel color={ACCENT_CYAN} className="p-3">
      <SectionHeader label="Key Milestone Timeline" icon={Target} color={ACCENT_CYAN} />

      <div className="px-2">
        <div className="relative">
          <div className="absolute left-4 top-2 bottom-2 w-px bg-[var(--border)]" />
          <div className="space-y-3">
            {entries.map((entry, i) => (
              <motion.div
                key={`${entry.level}-${i}`}
                data-testid="milestone-row"
                data-level={entry.level}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-4 relative"
              >
                <div
                  className="w-3 h-3 rounded-full border-2 border-[var(--surface-deep)] z-10 shrink-0"
                  style={{ backgroundColor: ACCENT_CYAN, boxShadow: `0 0 5px ${ACCENT_CYAN}` }}
                />
                <div className="flex-1 min-w-0 bg-surface/50 p-2.5 rounded-lg border border-border/40 flex justify-between items-center gap-3 hover:bg-surface-hover/50 transition-colors group/milestone">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0">
                    {entry.rewards.map((r) => (
                      <span key={r.name} className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-text group-hover/milestone:text-cyan-400 transition-colors">{r.name}</span>
                        <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">{r.type}</span>
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span data-testid="milestone-hours" className="text-xs font-mono text-text-muted">
                      {entry.hoursFromStart.toFixed(1)}h
                    </span>
                    <span className="text-xs font-mono font-bold bg-surface-deep px-2 py-1 rounded border border-border/60" style={{ color: ACCENT_CYAN }}>
                      LV {entry.level}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </BlueprintPanel>
  );
});
