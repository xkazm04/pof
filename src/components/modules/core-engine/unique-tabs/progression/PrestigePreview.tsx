'use client';

import { RotateCcw, Star } from 'lucide-react';
import { motion } from 'framer-motion';
import { STATUS_ERROR, ACCENT_EMERALD, ACCENT_VIOLET, OPACITY_10, OPACITY_20, OPACITY_30 } from '@/lib/chart-colors';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { SectionLabel } from '../_shared';

const PRESTIGE_DATA = {
  currentCycle: 0,
  maxCycles: 5,
  cycles: [
    { cycle: 1, statBonus: '+5%', diffMultiplier: '1.5x', estimatedTime: '40 hours', newAbility: 'Prestige Aura' },
    { cycle: 2, statBonus: '+12%', diffMultiplier: '2.0x', estimatedTime: '35 hours', newAbility: 'Soul Harvest' },
    { cycle: 3, statBonus: '+20%', diffMultiplier: '2.8x', estimatedTime: '30 hours', newAbility: 'Eternal Flame' },
    { cycle: 4, statBonus: '+30%', diffMultiplier: '3.5x', estimatedTime: '28 hours', newAbility: 'Void Walker' },
    { cycle: 5, statBonus: '+50%', diffMultiplier: '5.0x', estimatedTime: '25 hours', newAbility: 'Ascended Form' },
  ],
  carryOverItems: ['Gold (50%)', 'Skill Points (25%)', 'Unlocked Abilities', 'Achievement Progress'],
};

export function PrestigePreview() {
  return (
    <SurfaceCard level={2} className="p-5 relative overflow-hidden group">
      <div className="absolute bottom-0 right-0 w-40 h-40 bg-violet-500/5 blur-3xl rounded-full pointer-events-none group-hover:bg-violet-500/10 transition-colors duration-1000" />
      <SectionLabel icon={RotateCcw} label="Prestige / NG+ Preview" color={ACCENT_VIOLET} />

      <div className="mt-2.5 space-y-4 relative z-10">
        <div className="flex items-center gap-3 bg-surface/50 rounded-lg p-3 border border-border/30">
          <div className="flex items-center gap-2">
            <RotateCcw className="w-4 h-4" style={{ color: ACCENT_VIOLET }} />
            <span className="text-xs font-bold text-text">Current Cycle</span>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            {Array.from({ length: PRESTIGE_DATA.maxCycles }).map((_, i) => (
              <div
                key={i}
                className="w-4 h-4 rounded-full border-2 flex items-center justify-center"
                style={{
                  borderColor: i < PRESTIGE_DATA.currentCycle ? ACCENT_VIOLET : 'var(--border)',
                  backgroundColor: i < PRESTIGE_DATA.currentCycle ? `${ACCENT_VIOLET}${OPACITY_30}` : 'transparent',
                }}
              >
                {i < PRESTIGE_DATA.currentCycle && <Star className="w-2 h-2" style={{ color: ACCENT_VIOLET }} />}
              </div>
            ))}
            <span className="text-xs font-mono font-bold" style={{ color: ACCENT_VIOLET }}>
              {PRESTIGE_DATA.currentCycle}/{PRESTIGE_DATA.maxCycles}
            </span>
          </div>
        </div>

        <div>
          <div className="text-2xs font-mono text-text-muted uppercase tracking-wider mb-2">Stat Carry-Over</div>
          <div className="flex flex-wrap gap-1.5">
            {PRESTIGE_DATA.carryOverItems.map(item => (
              <span
                key={item}
                className="text-2xs font-mono px-2 py-1 rounded border"
                style={{ color: ACCENT_VIOLET, borderColor: `${ACCENT_VIOLET}${OPACITY_20}`, backgroundColor: `${ACCENT_VIOLET}${OPACITY_10}` }}
              >
                {item}
              </span>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-2xs font-mono">
            <thead>
              <tr className="text-text-muted border-b border-border/40">
                <th className="text-left py-1.5 pr-2">NG+</th>
                <th className="text-center py-1.5 px-2">Stat Bonus</th>
                <th className="text-center py-1.5 px-2">Difficulty</th>
                <th className="text-center py-1.5 px-2">Est. Time</th>
                <th className="text-left py-1.5 pl-2">New Ability</th>
              </tr>
            </thead>
            <tbody>
              {PRESTIGE_DATA.cycles.map((c, i) => (
                <motion.tr
                  key={c.cycle}
                  initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
                  className="border-b border-border/20 hover:bg-surface-hover/30 transition-colors"
                >
                  <td className="py-2 pr-2 font-bold" style={{ color: ACCENT_VIOLET }}>
                    <div className="flex items-center gap-1">
                      <RotateCcw className="w-2.5 h-2.5" /> {c.cycle}
                    </div>
                  </td>
                  <td className="py-2 px-2 text-center">
                    <span className="font-bold" style={{ color: ACCENT_EMERALD }}>{c.statBonus}</span>
                  </td>
                  <td className="py-2 px-2 text-center">
                    <span className="font-bold" style={{ color: STATUS_ERROR }}>{c.diffMultiplier}</span>
                  </td>
                  <td className="py-2 px-2 text-center text-text-muted">{c.estimatedTime}</td>
                  <td className="py-2 pl-2">
                    <span
                      className="px-1.5 py-0.5 rounded text-2xs"
                      style={{ backgroundColor: `${ACCENT_VIOLET}${OPACITY_10}`, color: ACCENT_VIOLET }}
                    >
                      {c.newAbility}
                    </span>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </SurfaceCard>
  );
}
