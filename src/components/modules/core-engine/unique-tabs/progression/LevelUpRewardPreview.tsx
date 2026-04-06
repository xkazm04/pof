'use client';

import { Award } from 'lucide-react';
import { motion } from 'framer-motion';
import { OPACITY_10, OPACITY_20,
  withOpacity, OPACITY_37, GLOW_MD,
} from '@/lib/chart-colors';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { SectionLabel } from '../_shared';
import { ACCENT, LEVEL_REWARDS } from './progression-data';

export function LevelUpRewardPreview() {
  return (
    <SurfaceCard level={2} className="p-5 relative overflow-hidden group">
      <div className="absolute bottom-0 left-0 w-40 h-40 bg-amber-500/5 blur-3xl rounded-full pointer-events-none group-hover:bg-amber-500/8 transition-colors duration-1000" />
      <SectionLabel icon={Award} label="Level-Up Reward Preview" color={ACCENT} />

      <div className="relative mt-2.5 z-10 pl-4">
        <div className="absolute left-6 top-0 bottom-0 w-px bg-gradient-to-b from-amber-500/50 via-amber-500/20 to-transparent" />

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
                      className="text-2xs font-mono px-1.5 py-0.5 rounded"
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
    </SurfaceCard>
  );
}
