'use client';

import { useState } from 'react';
import { Sparkles, Layers } from 'lucide-react';
import { motion } from 'framer-motion';
import { ACCENT_PURPLE_BOLD, withOpacity, OPACITY_5, OPACITY_8, OPACITY_12, OPACITY_15, OPACITY_25, OPACITY_30 } from '@/lib/chart-colors';
import { RadarChart } from '../../_shared';
import { BlueprintPanel, SectionHeader, GlowStat } from '../../_design';
import {
  OPTIMAL_LOADOUT, LOADOUT_RADAR, LOADOUT_SCORE, ALTERNATIVE_LOADOUTS,
} from '../data';

export function LoadoutSection() {
  const [selectedLoadoutAbility, setSelectedLoadoutAbility] = useState(0);

  return (
    <div className="space-y-4">
      <BlueprintPanel color={ACCENT_PURPLE_BOLD} className="p-3">
        <SectionHeader icon={Layers} label="Ability Loadout Optimizer" color={ACCENT_PURPLE_BOLD} />
        <p className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted mt-1 mb-4">
          Optimal ability loadout for 4 slots, scored on coverage, synergy, DPS, burst, and utility.
        </p>

        <div className="flex flex-wrap gap-1.5 mb-3">
          {OPTIMAL_LOADOUT.map((slot, i) => (
            <button key={slot.ability} onClick={() => setSelectedLoadoutAbility(i)}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono uppercase tracking-[0.15em] font-bold border transition-all cursor-pointer ${
                selectedLoadoutAbility === i ? 'shadow-sm' : 'opacity-50 hover:opacity-80'
              }`}
              style={selectedLoadoutAbility === i ? {
                backgroundColor: withOpacity(slot.color, OPACITY_8),
                borderColor: withOpacity(slot.color, OPACITY_25),
                color: slot.color,
                textShadow: `0 0 12px ${withOpacity(slot.color, OPACITY_25)}`,
              } : {
                backgroundColor: 'transparent',
                borderColor: withOpacity(slot.color, OPACITY_15),
                color: 'var(--text-muted)',
              }}>
              {slot.ability}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Loadout slots */}
          <div className="space-y-4">
            <div className="text-xs font-mono font-bold uppercase tracking-[0.15em] text-text-muted mb-2">Optimal Loadout</div>
            <div className="grid grid-cols-2 gap-3">
              {OPTIMAL_LOADOUT.map((slot, i) => (
                <motion.div
                  key={slot.slot}
                  initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.1 }}
                  className={`border rounded-xl p-3 text-center relative overflow-hidden group ${selectedLoadoutAbility === i ? 'ring-1' : ''}`}
                  style={{ borderColor: withOpacity(slot.color, OPACITY_15), backgroundColor: withOpacity(slot.color, OPACITY_5), ...(selectedLoadoutAbility === i ? { outline: `1px solid ${slot.color}` } : {}) }}
                >
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ background: `radial-gradient(ellipse at 50% 50%, ${withOpacity(slot.color, OPACITY_8)}, transparent 70%)` }}
                  />
                  <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted mb-1">Slot {slot.slot}</div>
                  <div className="w-10 h-10 mx-auto rounded-lg flex items-center justify-center mb-1.5"
                    style={{ backgroundColor: withOpacity(slot.color, OPACITY_12), border: `1.5px solid ${withOpacity(slot.color, OPACITY_30)}` }}
                  >
                    <Sparkles className="w-5 h-5" style={{ color: slot.color }} />
                  </div>
                  <div className="text-sm font-mono font-bold" style={{ color: slot.color, textShadow: `0 0 12px ${withOpacity(slot.color, OPACITY_25)}` }}>{slot.ability}</div>
                </motion.div>
              ))}
            </div>

            <GlowStat label="Loadout Score" value={`${LOADOUT_SCORE}/100`} color={ACCENT_PURPLE_BOLD} delay={0.2} />
          </div>

          {/* Radar + alternatives */}
          <div className="space-y-4">
            <div className="flex justify-center">
              <RadarChart data={LOADOUT_RADAR} size={140} accent={ACCENT_PURPLE_BOLD} />
            </div>

            <div className="text-xs font-mono font-bold uppercase tracking-[0.15em] text-text-muted mb-2">Alternative Loadouts</div>
            <div className="space-y-3">
              {ALTERNATIVE_LOADOUTS.map((alt, i) => (
                <motion.div
                  key={alt.name}
                  initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
                  className="flex items-center gap-3 text-xs p-2.5 rounded-lg border"
                  style={{ borderColor: withOpacity(ACCENT_PURPLE_BOLD, OPACITY_15), backgroundColor: withOpacity(ACCENT_PURPLE_BOLD, OPACITY_5) }}
                >
                  <span className="font-mono font-bold text-text w-20 flex-shrink-0">{alt.name}</span>
                  <div className="flex gap-1 flex-1">
                    {alt.abilities.map((ab, ai) => (
                      <span key={ai} className="text-xs font-mono px-1.5 py-0.5 rounded border text-text-muted"
                        style={{ borderColor: withOpacity(ACCENT_PURPLE_BOLD, OPACITY_15), backgroundColor: withOpacity(ACCENT_PURPLE_BOLD, OPACITY_5) }}>
                        {ab}
                      </span>
                    ))}
                  </div>
                  <span className="font-mono font-bold flex-shrink-0" style={{ color: ACCENT_PURPLE_BOLD, textShadow: `0 0 12px ${withOpacity(ACCENT_PURPLE_BOLD, OPACITY_25)}` }}>{alt.score}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </BlueprintPanel>
    </div>
  );
}
