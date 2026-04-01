'use client';

import { useState } from 'react';
import { Flame } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ACCENT_RED, ACCENT_EMERALD_DARK, MODULE_COLORS, STATUS_STALE,
} from '@/lib/chart-colors';
import { useDensity, PanelFrame } from '@/lib/dzin/core';
import { DZIN_TIMING, DZIN_SPACING, TRANSITION_ENTER, TRANSITION_EXIT } from '@/lib/dzin/animation-constants';
import { useDzinSelection } from '@/lib/dzin/selection-context';
import { isRelatedToSelection, ENTITY_RELATIONS } from '@/lib/dzin/entity-relations';
import {
  FeatureCard,
  PipelineFlow,
  SectionLabel,
  statusInfo,
} from '@/components/modules/core-engine/unique-tabs/_shared';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import type { FeatureRow } from '@/types/feature-matrix';

/* ── Props ──────────────────────────────────────────────────────────────── */

export interface EffectsPanelProps {
  featureMap: Map<string, FeatureRow>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
}

/* ── Constants ──────────────────────────────────────────────────────────── */

const ACCENT = ACCENT_RED;

const EFFECT_TYPES = [
  { name: 'GE_Damage', desc: 'Instant damage application', color: ACCENT_RED },
  { name: 'GE_Heal', desc: 'Health restoration over time', color: ACCENT_EMERALD_DARK },
  { name: 'GE_Buff', desc: 'Temporary stat modifier', color: MODULE_COLORS.core },
  { name: 'GE_Regen', desc: 'Periodic health/mana regen', color: STATUS_STALE },
];

const EFFECT_FEATURE_NAMES = ['Core Gameplay Effects', 'Damage execution calculation'];

const EFFECT_PIPELINE_STEPS = ['Predict', 'Apply', 'Stack', 'Expire', 'Remove'] as const;

/* ── Micro density ──────────────────────────────────────────────────────── */

function EffectsMicro() {
  return (
    <div className={DZIN_SPACING.micro.wrapper}>
      <Flame className="w-5 h-5 text-red-400" />
      <span className="font-mono text-xs">{EFFECT_TYPES.length}</span>
    </div>
  );
}

/* ── Compact density ────────────────────────────────────────────────────── */

function EffectsCompact({ featureMap }: EffectsPanelProps) {
  const { selection } = useDzinSelection();

  // Map effect types to related ability entities for cross-panel selection
  const effectAbilityMap: Record<string, string> = {
    'GE_Damage': 'MeleeAttack',
    'GE_Heal': 'HealOverTime',
    'GE_Buff': 'Shield',
    'GE_Regen': 'HealOverTime',
  };

  return (
    <div className={`${DZIN_SPACING.compact.wrapper} text-xs`}>
      {/* Effect type list */}
      <div className="space-y-1">
        {EFFECT_TYPES.map((effect) => {
          const mappedAbility = effectAbilityMap[effect.name];
          const isRelated = mappedAbility
            ? isRelatedToSelection('ability', mappedAbility, selection, ENTITY_RELATIONS)
            : true;
          return (
            <motion.div
              key={effect.name}
              className="flex items-center gap-2"
              animate={{ opacity: selection && !isRelated ? 0.4 : 1 }}
              transition={{ duration: DZIN_TIMING.HIGHLIGHT }}
            >
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: effect.color, boxShadow: `0 0 0 3px ${effect.color}33` }}
                title={effect.name}
              />
              <span className="font-medium text-text">{effect.name}</span>
              <span className="text-text-muted truncate ml-auto text-2xs">{effect.desc}</span>
            </motion.div>
          );
        })}
      </div>

      {/* Feature status indicators */}
      <div className={`border-t border-border/40 ${DZIN_SPACING.compact.divider} space-y-1`}>
        {EFFECT_FEATURE_NAMES.map((name) => {
          const status = featureMap.get(name)?.status;
          const { color: dotColor, label: dotLabel } = statusInfo(status);
          return (
            <div key={name} className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: dotColor, boxShadow: `0 0 0 3px ${dotColor}33` }}
                title={dotLabel}
              />
              <span className="text-text-muted truncate">{name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Full density ───────────────────────────────────────────────────────── */

function EffectsFull({ featureMap, defs }: EffectsPanelProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const onToggle = (name: string) => setExpanded((prev) => (prev === name ? null : name));

  return (
    <div className={DZIN_SPACING.full.wrapper}>
      {/* Feature cards */}
      {EFFECT_FEATURE_NAMES.map((name) => (
        <FeatureCard
          key={name}
          name={name}
          featureMap={featureMap}
          defs={defs}
          expanded={expanded}
          onToggle={onToggle}
          accent={ACCENT}
        />
      ))}

      {/* Effect type cards */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel label="Effect Types" />
        <div className="grid grid-cols-2 gap-2 mt-2">
          {EFFECT_TYPES.map((effect) => (
            <SurfaceCard key={effect.name} level={3} className="p-2.5">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: effect.color, boxShadow: `0 0 6px ${effect.color}60` }}
                />
                <span className="text-xs font-semibold text-text">{effect.name}</span>
              </div>
              <p className="text-2xs text-text-muted leading-relaxed">{effect.desc}</p>
            </SurfaceCard>
          ))}
        </div>
      </SurfaceCard>

      {/* Effect application pipeline */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel label="Effect Application Pipeline" />
        <div className={DZIN_SPACING.full.pipelineMt}>
          <PipelineFlow steps={[...EFFECT_PIPELINE_STEPS]} accent={ACCENT} />
        </div>
      </SurfaceCard>
    </div>
  );
}

/* ── Main EffectsPanel ──────────────────────────────────────────────────── */

export function EffectsPanel({ featureMap, defs }: EffectsPanelProps) {
  const density = useDensity();

  return (
    <PanelFrame title="Effects" icon={<Flame className="w-4 h-4" />}>
      <AnimatePresence mode="wait">
        <motion.div
          key={density}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: TRANSITION_EXIT }}
          transition={TRANSITION_ENTER}
        >
          {density === 'micro' && <EffectsMicro />}
          {density === 'compact' && <EffectsCompact featureMap={featureMap} defs={defs} />}
          {density === 'full' && <EffectsFull featureMap={featureMap} defs={defs} />}
        </motion.div>
      </AnimatePresence>
    </PanelFrame>
  );
}
