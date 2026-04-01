'use client';

import { Target } from 'lucide-react';
import { motion } from 'framer-motion';
import { ACCENT_CYAN } from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '../_design';
import { ABILITY_UNLOCKS } from './data';

/* -- Key Milestone Timeline ----------------------------------------------- */

export function MilestoneTimeline() {
  return (
    <BlueprintPanel color={ACCENT_CYAN} className="p-3">
      <SectionHeader label="Key Milestone Timeline" icon={Target} color={ACCENT_CYAN} />

      <div className="px-2">
        <div className="relative">
          <div className="absolute left-4 top-2 bottom-2 w-px bg-[var(--border)]" />
          <div className="space-y-5">
            {ABILITY_UNLOCKS.map((item, i) => (
              <motion.div
                key={item.name}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="flex items-center gap-4 relative"
              >
                <div
                  className="w-3 h-3 rounded-full border-2 border-[var(--surface-deep)] z-10"
                  style={{ backgroundColor: ACCENT_CYAN, boxShadow: `0 0 5px ${ACCENT_CYAN}` }}
                />
                <div className="flex-1 bg-surface/50 p-2.5 rounded-lg border border-border/40 flex justify-between items-center hover:bg-surface-hover/50 transition-colors group/milestone">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-text group-hover/milestone:text-cyan-400 transition-colors">{item.name}</span>
                    <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">{item.class}</span>
                  </div>
                  <span className="text-xs font-mono font-bold bg-surface-deep px-2 py-1 rounded border border-border/60" style={{ color: ACCENT_CYAN }}>
                    LV {item.level}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </BlueprintPanel>
  );
}
