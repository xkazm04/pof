'use client';

import { Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  ACCENT_PURPLE_BOLD,
  withOpacity, OPACITY_5, OPACITY_10,
} from '@/lib/chart-colors';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import {
  FeatureCard as SharedFeatureCard, PipelineFlow, SectionLabel,
} from '../../unique-tabs/_shared';
import type { SectionProps } from '../_shared/types';
import { AbilityCompareRadar } from './AbilityCompareRadar';
import { CooldownFlow } from './CooldownFlow';

export function AbilitiesSection({ featureMap, defs, expanded, onToggle }: SectionProps) {
  const crossModuleAbilities = [
    { name: 'Melee attack ability', module: 'arpg-combat' },
    { name: 'Dodge ability (GAS)', module: 'arpg-combat' },
  ];

  return (
    <div className="space-y-4">
      <SharedFeatureCard name="Base GameplayAbility" featureMap={featureMap} defs={defs} expanded={expanded} onToggle={onToggle} accent={ACCENT_PURPLE_BOLD} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SurfaceCard level={2} className="p-3 relative">
          <div className="absolute right-0 top-0 w-32 h-32 blur-3xl rounded-full pointer-events-none" style={{ backgroundColor: withOpacity(ACCENT_PURPLE_BOLD, OPACITY_5) }} />
          <div className="text-sm font-bold uppercase tracking-widest text-text-muted mb-4 flex items-center gap-2">
            <Sparkles className="w-4 h-4" style={{ color: ACCENT_PURPLE_BOLD }} /> Derived Cross-Module
          </div>
          <div className="space-y-4">
            {crossModuleAbilities.map((a, i) => (
              <motion.div
                key={a.name}
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
                className="flex items-center gap-3 text-sm bg-surface p-2.5 rounded-lg border border-border/50"
              >
                <div className="p-1.5 rounded" style={{ backgroundColor: withOpacity(ACCENT_PURPLE_BOLD, OPACITY_10) }}>
                  <Sparkles className="w-3.5 h-3.5 flex-shrink-0" style={{ color: ACCENT_PURPLE_BOLD }} />
                </div>
                <span className="text-text font-medium">{a.name}</span>
                <span className="text-2xs text-text-muted font-mono ml-auto bg-surface-deep px-1.5 py-0.5 rounded border border-border/40">
                  {a.module}
                </span>
              </motion.div>
            ))}
          </div>
        </SurfaceCard>

        {/* Ability lifecycle */}
        <SurfaceCard level={2} className="p-4 flex flex-col justify-center">
          <SectionLabel label="Ability Lifecycle" />
          <div className="mt-4">
            <PipelineFlow steps={['CanActivate', 'CommitAbility', 'ActivateAbility', 'ApplyCost', 'EndAbility']} accent={ACCENT_PURPLE_BOLD} />
          </div>
        </SurfaceCard>
      </div>

      {/* Ability Comparison Radar with ScalableSelector */}
      <AbilityCompareRadar />

      {/* Cooldown Flow Visualization */}
      <CooldownFlow />
    </div>
  );
}
