'use client';

import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ACCENT_RED, ACCENT_ORANGE, MODULE_COLORS, ACCENT_GREEN,
} from '@/lib/chart-colors';
import { useDensity, PanelFrame } from '@/lib/dzin/core';
import { DZIN_TIMING, DZIN_SPACING, TRANSITION_ENTER, TRANSITION_EXIT } from '@/lib/dzin/animation-constants';
import { useDzinSelection } from '@/lib/dzin/selection-context';
import { ENTITY_RELATIONS, isRelatedToSelection } from '@/lib/dzin/entity-relations';
import {
  FeatureCard,
  RadarChart,
} from '@/components/modules/core-engine/unique-tabs/_shared';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import type { FeatureRow } from '@/types/feature-matrix';
import type { RadarDataPoint } from '@/types/unique-tab-improvements';

/* -- Props ----------------------------------------------------------------- */

export interface AbilitiesPanelProps {
  featureMap: Map<string, FeatureRow>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
}

/* -- Constants ------------------------------------------------------------- */

const ABILITY_RADAR_AXES = ['Damage', 'Range', 'AOE', 'Speed', 'Efficiency'];

const ABILITY_RADAR_DATA: { name: string; color: string; values: number[] }[] = [
  { name: 'MeleeAttack', color: ACCENT_RED, values: [0.85, 0.2, 0, 0.9, 0.6] },
  { name: 'Fireball', color: ACCENT_ORANGE, values: [0.9, 0.85, 0.6, 0.3, 0.25] },
  { name: 'Dodge', color: MODULE_COLORS.core, values: [0, 0, 0, 0.95, 0.8] },
];

const COOLDOWN_ABILITIES = [
  { name: 'MeleeAttack', cd: 0.5, remaining: 0.2, color: ACCENT_RED },
  { name: 'Fireball', cd: 3.0, remaining: 1.8, color: ACCENT_ORANGE },
  { name: 'FrostNova', cd: 8.0, remaining: 5.5, color: MODULE_COLORS.core },
  { name: 'Dodge', cd: 1.5, remaining: 0.0, color: ACCENT_GREEN },
];

/* -- Micro density --------------------------------------------------------- */

function AbilitiesMicro() {
  return (
    <div className={DZIN_SPACING.micro.wrapper}>
      <Sparkles className="w-5 h-5 text-purple-400" />
      <span className="font-mono text-xs text-text">{ABILITY_RADAR_DATA.length}</span>
    </div>
  );
}

/* -- Compact density ------------------------------------------------------- */

function AbilitiesCompact() {
  const { selection, setSelection } = useDzinSelection();

  return (
    <div className={`${DZIN_SPACING.compact.wrapper} text-xs`}>
      {COOLDOWN_ABILITIES.map((ability) => {
        const pct = ability.cd > 0 ? ((ability.cd - ability.remaining) / ability.cd) * 100 : 100;
        const isRelated = isRelatedToSelection('ability', ability.name, selection, ENTITY_RELATIONS);
        const isSelected = selection?.type === 'ability' && selection.id === ability.name;
        return (
          <motion.div
            key={ability.name}
            className={`space-y-0.5 cursor-pointer ${isSelected ? 'ring-1 ring-blue-500/50 rounded' : ''}`}
            animate={{ opacity: selection && !isRelated ? 0.4 : 1 }}
            transition={{ duration: DZIN_TIMING.HIGHLIGHT }}
            onClick={() => setSelection({ type: 'ability', id: ability.name })}
          >
            <div className="flex items-center justify-between">
              <span className="font-medium text-text">{ability.name}</span>
              <span className="font-mono text-text-muted">{ability.cd}s</span>
            </div>
            <div className="w-full h-1.5 bg-surface-deep rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, backgroundColor: ability.color }}
              />
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

/* -- Full density ---------------------------------------------------------- */

function AbilitiesFull({ featureMap, defs }: AbilitiesPanelProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const onToggle = (name: string) => setExpanded((prev) => (prev === name ? null : name));

  // Build radar data for the primary ability
  const primaryRadar: RadarDataPoint[] = ABILITY_RADAR_AXES.map((axis, i) => ({
    axis,
    value: ABILITY_RADAR_DATA[0].values[i],
  }));

  // Build overlays for additional abilities
  const overlays = ABILITY_RADAR_DATA.slice(1).map((ability) => ({
    data: ABILITY_RADAR_AXES.map((axis, i): RadarDataPoint => ({
      axis,
      value: ability.values[i],
    })),
    color: ability.color,
    label: ability.name,
  }));

  return (
    <div className={DZIN_SPACING.full.wrapper}>
      <FeatureCard
        name="Base GameplayAbility"
        featureMap={featureMap}
        defs={defs}
        expanded={expanded}
        onToggle={onToggle}
        accent="#a855f7"
      />

      {/* Radar comparison */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <div className={`text-xs font-bold uppercase text-text-muted ${DZIN_SPACING.full.sectionMb} flex items-center gap-2`}>
          <Sparkles className="w-4 h-4 text-purple-400" /> Ability Radar Comparison
        </div>
        <div className="flex justify-center">
          <RadarChart
            data={primaryRadar}
            size={160}
            accent={ABILITY_RADAR_DATA[0].color}
            overlays={overlays}
          />
        </div>
        {/* Legend */}
        <div className="flex items-center justify-center gap-3 mt-2">
          {ABILITY_RADAR_DATA.map((ability) => (
            <div key={ability.name} className="flex items-center gap-1.5 text-2xs">
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: ability.color }}
              />
              <span className="text-text-muted font-mono">{ability.name}</span>
            </div>
          ))}
        </div>
      </SurfaceCard>

      {/* Cooldown flow */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <div className={`text-xs font-bold uppercase text-text-muted ${DZIN_SPACING.full.sectionMb} flex items-center gap-2`}>
          <Sparkles className="w-4 h-4 text-purple-400" /> Cooldown Flow
        </div>
        <div className="space-y-2">
          {COOLDOWN_ABILITIES.map((ability, i) => {
            const pct = ability.cd > 0 ? ((ability.cd - ability.remaining) / ability.cd) * 100 : 100;
            const isReady = ability.remaining <= 0;
            return (
              <motion.div
                key={ability.name}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08 }}
                className="space-y-1"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-text">{ability.name}</span>
                  <span className="font-mono text-text-muted">
                    {isReady ? 'READY' : `${ability.remaining.toFixed(1)}s / ${ability.cd}s`}
                  </span>
                </div>
                <div className="w-full h-2 bg-surface-deep rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: ability.color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.6, delay: i * 0.1 }}
                  />
                </div>
              </motion.div>
            );
          })}
        </div>
      </SurfaceCard>
    </div>
  );
}

/* -- Main AbilitiesPanel --------------------------------------------------- */

export function AbilitiesPanel({ featureMap, defs }: AbilitiesPanelProps) {
  const density = useDensity();

  return (
    <PanelFrame title="Abilities" icon={<Sparkles className="w-4 h-4" />}>
      <AnimatePresence mode="wait">
        <motion.div
          key={density}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: TRANSITION_EXIT }}
          transition={TRANSITION_ENTER}
        >
          {density === 'micro' && <AbilitiesMicro />}
          {density === 'compact' && <AbilitiesCompact />}
          {density === 'full' && <AbilitiesFull featureMap={featureMap} defs={defs} />}
        </motion.div>
      </AnimatePresence>
    </PanelFrame>
  );
}
