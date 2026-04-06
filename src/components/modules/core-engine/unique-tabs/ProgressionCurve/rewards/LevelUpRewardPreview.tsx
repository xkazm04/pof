'use client';

import { Award } from 'lucide-react';
import { motion } from 'framer-motion';
import { OPACITY_10, OPACITY_20,
  withOpacity, OPACITY_30, OPACITY_12, OPACITY_37, GLOW_MD,
} from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '../../_design';
import { ACCENT, LEVEL_REWARDS } from '../data';

export function LevelUpRewardPreview() {
  return (
    <BlueprintPanel color={ACCENT} className="p-5">
      <SectionHeader icon={Award} label="Level-Up Reward Preview" color={ACCENT} />

      <div className="relative mt-2.5 pl-4">
        <div className="absolute left-6 top-0 bottom-0 w-px" style={{ background: `linear-gradient(to bottom, ${withOpacity(ACCENT, OPACITY_30)}, ${withOpacity(ACCENT, OPACITY_12)}, transparent)` }} />

        <div className="space-y-3">
          {LEVEL_REWARDS.map((reward, i) => {
            const Icon = reward.icon;
            return (
              <motion.div
                key={reward.level}
                initial={{ opacity: 0, x: -15 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
                className="flex items-center gap-3 relative"
              >
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center z-10 border-2 border-surface-deep shadow-lg"
                  style={{ backgroundColor: reward.color, boxShadow: `${GLOW_MD} ${withOpacity(reward.color, OPACITY_37)}` }}
                >
                  <Icon className="w-2.5 h-2.5 text-white" />
                </div>

                <div className="flex-1 flex items-center justify-between bg-surface/50 px-3 py-2 rounded-lg border border-border/40 hover:bg-surface-hover/50 transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-text">{reward.name}</span>
                    <span
                      className="text-xs font-mono uppercase tracking-[0.15em] px-1.5 py-0.5 rounded"
                      style={{ backgroundColor: `${reward.color}${OPACITY_10}`, color: reward.color, border: `1px solid ${reward.color}${OPACITY_20}` }}
                    >
                      {reward.type}
                    </span>
                  </div>
                  <span
                    className="text-xs font-mono font-bold px-2 py-0.5 rounded border"
                    style={{ color: reward.color, borderColor: `${reward.color}${OPACITY_20}`, backgroundColor: `${reward.color}${OPACITY_10}` }}
                  >
                    LV {reward.level}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </BlueprintPanel>
  );
}
