'use client';

import { Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import { STATUS_WARNING, STATUS_ERROR, ACCENT_CYAN } from '@/lib/chart-colors';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { SectionLabel } from '../_shared';
import { ACCENT } from './progression-data';

const REST_XP_DATA = {
  bankedXP: 4500,
  maxBankedXP: 10000,
  multiplier: 2,
  currentXP: 7800,
  nextLevelXP: 12000,
  estimatedKills: 23,
  regenRate: 150,
};

export function RestXpSystem() {
  return (
    <SurfaceCard level={2} className="p-5 relative overflow-hidden group">
      <div className="absolute top-0 left-0 w-36 h-36 bg-blue-500/5 blur-3xl rounded-full pointer-events-none group-hover:bg-blue-500/10 transition-colors duration-1000" />
      <SectionLabel icon={Zap} label="Rest XP System" color={ACCENT_CYAN} />

      <div className="mt-2.5 space-y-4 relative z-10">
        <div>
          <div className="flex justify-between text-xs font-mono mb-1.5">
            <span className="text-text">Current Level Progress</span>
            <span className="text-amber-400">{REST_XP_DATA.currentXP.toLocaleString()} / {REST_XP_DATA.nextLevelXP.toLocaleString()} XP</span>
          </div>
          <div className="relative h-6 bg-surface-deep rounded-lg overflow-hidden border border-border/30">
            <motion.div
              initial={{ width: 0 }} animate={{ width: `${(REST_XP_DATA.currentXP / REST_XP_DATA.nextLevelXP) * 100}%` }}
              transition={{ duration: 0.8 }}
              className="absolute inset-y-0 left-0 rounded-lg"
              style={{ backgroundColor: ACCENT, opacity: 0.6 }}
            />
            <motion.div
              initial={{ width: 0 }}
              animate={{
                width: `${Math.min((REST_XP_DATA.bankedXP / REST_XP_DATA.nextLevelXP) * 100, 100 - (REST_XP_DATA.currentXP / REST_XP_DATA.nextLevelXP) * 100)}%`
              }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="absolute inset-y-0 rounded-lg"
              style={{
                left: `${(REST_XP_DATA.currentXP / REST_XP_DATA.nextLevelXP) * 100}%`,
                backgroundColor: ACCENT_CYAN,
                opacity: 0.4,
              }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-2xs font-mono font-bold text-white/80 drop-shadow-sm">
                {Math.round((REST_XP_DATA.currentXP / REST_XP_DATA.nextLevelXP) * 100)}%
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4 mt-1.5 text-2xs font-mono text-text-muted">
            <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm" style={{ backgroundColor: ACCENT, opacity: 0.6 }} /> Earned XP</span>
            <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm" style={{ backgroundColor: ACCENT_CYAN, opacity: 0.4 }} /> Rest XP</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-surface/50 rounded-lg p-3 border border-border/30 text-center">
            <div className="text-lg font-mono font-bold" style={{ color: ACCENT_CYAN }}>{REST_XP_DATA.bankedXP.toLocaleString()}</div>
            <div className="text-2xs text-text-muted mt-1">Banked XP</div>
          </div>
          <div className="bg-surface/50 rounded-lg p-3 border border-border/30 text-center">
            <div className="text-lg font-mono font-bold" style={{ color: STATUS_WARNING }}>{REST_XP_DATA.multiplier}x</div>
            <div className="text-2xs text-text-muted mt-1">Multiplier</div>
          </div>
          <div className="bg-surface/50 rounded-lg p-3 border border-border/30 text-center">
            <div className="text-lg font-mono font-bold" style={{ color: STATUS_ERROR }}>~{REST_XP_DATA.estimatedKills}</div>
            <div className="text-2xs text-text-muted mt-1">Kills to Deplete</div>
          </div>
        </div>

        <div>
          <div className="flex justify-between text-2xs font-mono text-text-muted mb-1">
            <span>Rest XP Bank</span>
            <span>{REST_XP_DATA.bankedXP.toLocaleString()} / {REST_XP_DATA.maxBankedXP.toLocaleString()}</span>
          </div>
          <div className="h-2 bg-surface-deep rounded-full overflow-hidden border border-border/30">
            <motion.div
              initial={{ width: 0 }} animate={{ width: `${(REST_XP_DATA.bankedXP / REST_XP_DATA.maxBankedXP) * 100}%` }}
              transition={{ duration: 0.8 }}
              className="h-full rounded-full"
              style={{ backgroundColor: ACCENT_CYAN }}
            />
          </div>
          <div className="text-[11px] text-text-muted mt-1 font-mono">Regen: +{REST_XP_DATA.regenRate} XP/hour offline</div>
        </div>
      </div>
    </SurfaceCard>
  );
}
