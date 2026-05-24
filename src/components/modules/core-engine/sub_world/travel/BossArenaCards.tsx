'use client';

import { Skull, Music } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  STATUS_WARNING, STATUS_ERROR,
  ACCENT_VIOLET,
  OPACITY_8, OPACITY_15, OPACITY_20, OPACITY_37,
  GLOW_SM,
  withOpacity,
} from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '../../unique-tabs/_design';
import { BOSS_ARENAS } from '../_shared/data';

export function BossArenaCards() {
  return (
    <BlueprintPanel color={STATUS_ERROR} className="p-3">
      <SectionHeader icon={Skull} label="Boss Arena Details" color={STATUS_ERROR} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {BOSS_ARENAS.map((boss) => (
          <motion.div
            key={boss.bossName}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative bg-surface-deep rounded-xl p-4 border border-border/40 overflow-hidden group"
          >
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"
              style={{ background: `radial-gradient(ellipse at 50% 0%, ${withOpacity(STATUS_ERROR, OPACITY_8)} 0%, transparent 70%)` }} />
            <div className="absolute top-0 left-0 right-0 h-[2px]"
              style={{ background: `linear-gradient(90deg, transparent, ${withOpacity(STATUS_ERROR, OPACITY_37)}, transparent)` }} />

            <div className="flex items-start justify-between mb-3 relative z-10">
              <div>
                <div className="text-sm font-bold text-text flex items-center gap-1.5">
                  <Skull className="w-4 h-4" style={{ color: STATUS_ERROR, filter: `drop-shadow(${GLOW_SM} ${withOpacity(STATUS_ERROR, OPACITY_37)})` }} />
                  {boss.bossName}
                </div>
                <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted mt-0.5">{boss.zone}</div>
              </div>
              <span className="text-xs font-mono uppercase tracking-[0.15em] font-bold px-1.5 py-0.5 rounded"
                style={{ backgroundColor: withOpacity(STATUS_ERROR, OPACITY_8), color: STATUS_ERROR, border: `1px solid ${withOpacity(STATUS_ERROR, OPACITY_20)}` }}>
                Rec. Lv{boss.recommendedLevel}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-mono relative z-10">
              <div className="bg-surface/50 rounded px-2 py-1.5 border border-border/30">
                <span className="text-text-muted">Phases</span>
                <div className="font-bold text-text">{boss.phases}</div>
              </div>
              <div className="bg-surface/50 rounded px-2 py-1.5 border border-border/30">
                <span className="text-text-muted">Arena</span>
                <div className="font-bold text-text">{boss.arenaSize}</div>
              </div>
              <div className="col-span-2 bg-surface/50 rounded px-2 py-1.5 border border-border/30">
                <span className="text-text-muted">Hazards</span>
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {boss.hazards.map((h) => (
                    <span key={h} className="px-1 py-0.5 rounded text-xs font-bold"
                      style={{ backgroundColor: withOpacity(STATUS_WARNING, OPACITY_8), color: STATUS_WARNING, border: `1px solid ${withOpacity(STATUS_WARNING, OPACITY_15)}` }}>
                      {h}
                    </span>
                  ))}
                </div>
              </div>
              <div className="col-span-2 flex items-center gap-1.5 text-text-muted">
                <Music className="w-3 h-3" style={{ color: ACCENT_VIOLET }} />
                <span className="italic">{boss.musicTheme}</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </BlueprintPanel>
  );
}
