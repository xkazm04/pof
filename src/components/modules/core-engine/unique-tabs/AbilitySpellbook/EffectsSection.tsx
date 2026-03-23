'use client';

import { Flame } from 'lucide-react';
import { motion } from 'framer-motion';
import { ACCENT_RED } from '@/lib/chart-colors';
import {
  FeatureCard as SharedFeatureCard, PipelineFlow,
} from '../_shared';
import { BlueprintPanel, SectionHeader } from '../_design';
import { EFFECT_TYPES } from './data';
import type { SectionProps } from './types';

export function EffectsSection({ featureMap, defs, expanded, onToggle }: SectionProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SharedFeatureCard name="Core Gameplay Effects" featureMap={featureMap} defs={defs} expanded={expanded} onToggle={onToggle} accent={ACCENT_RED} />
        <SharedFeatureCard name="Damage execution calculation" featureMap={featureMap} defs={defs} expanded={expanded} onToggle={onToggle} accent={ACCENT_RED} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Effect type cards */}
        <div className="grid grid-cols-2 gap-3">
          {EFFECT_TYPES.map((effect, i) => (
            <motion.div
              key={effect.name}
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }}
              className="rounded-xl p-3 border relative overflow-hidden"
              style={{ borderColor: `${effect.color}25`, backgroundColor: `${effect.color}08` }}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: effect.color, boxShadow: `0 0 6px ${effect.color}60` }} />
                <span className="text-[10px] font-mono uppercase tracking-[0.15em] font-bold text-text"
                  style={{ textShadow: `0 0 12px ${effect.color}40` }}>{effect.name}</span>
              </div>
              <p className="text-2xs text-text-muted leading-relaxed">{effect.desc}</p>
            </motion.div>
          ))}
        </div>

        {/* Damage execution pipeline */}
        <BlueprintPanel color={ACCENT_RED} className="p-4">
          <SectionHeader icon={Flame} label="Damage Execution Pipeline" color={ACCENT_RED} />
          <div className="mt-4">
            <PipelineFlow steps={['GameplayEffect', 'ExecutionCalc', 'Armor Reduction', 'Crit Multiplier', 'Final Damage']} accent={ACCENT_RED} />
          </div>
        </BlueprintPanel>
      </div>
    </div>
  );
}
