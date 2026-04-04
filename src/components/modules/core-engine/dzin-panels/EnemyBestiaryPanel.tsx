'use client';

import { useState } from 'react';
import { Skull } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useDensity, PanelFrame } from '@/lib/dzin/core';
import { DZIN_SPACING, TRANSITION_ENTER, TRANSITION_EXIT } from '@/lib/dzin/animation-constants';
import {
  FeatureCard,
  PipelineFlow,
  SectionLabel,
  RadarChart,
} from '@/components/modules/core-engine/unique-tabs/_shared';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { ACCENT_ORANGE, ACCENT_RED, ACCENT_CYAN, ACCENT_EMERALD, ACCENT_PURPLE } from '@/lib/chart-colors';
import type { FeatureRow } from '@/types/feature-matrix';
import type { RadarDataPoint } from '@/types/unique-tab-improvements';

/* ── Props ──────────────────────────────────────────────────────────────── */

export interface EnemyBestiaryPanelProps {
  featureMap: Map<string, FeatureRow>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
}

/* ── Constants ──────────────────────────────────────────────────────────── */

const ACCENT = ACCENT_ORANGE;

const ARCHETYPES = [
  { name: 'Melee Grunt', role: 'Frontline', hp: 0.4, dmg: 0.5, speed: 0.6, color: ACCENT_RED },
  { name: 'Ranged Caster', role: 'Backline', hp: 0.3, dmg: 0.8, speed: 0.3, color: ACCENT_PURPLE },
  { name: 'Brute', role: 'Tank', hp: 0.9, dmg: 0.6, speed: 0.2, color: ACCENT_ORANGE },
  { name: 'Assassin', role: 'Flanker', hp: 0.2, dmg: 0.9, speed: 0.9, color: ACCENT_CYAN },
] as const;

const BESTIARY_RADAR: RadarDataPoint[] = [
  { axis: 'Health', value: 0.6 },
  { axis: 'Damage', value: 0.7 },
  { axis: 'Speed', value: 0.5 },
  { axis: 'Range', value: 0.4 },
  { axis: 'Aggro', value: 0.8 },
];

const AI_PIPELINE = ['Perception', 'Blackboard', 'BehaviorTree', 'EQS', 'AbilityExec'] as const;

const ENEMY_FEATURES = [
  'AARPGAIController', 'AARPGEnemyCharacter', 'AI Perception',
  'Behavior Tree', 'EQS queries', 'Enemy archetypes',
  'Enemy Gameplay Abilities', 'Spawn system',
];

/* ── Micro density ──────────────────────────────────────────────────────── */

function BestiaryMicro() {
  return (
    <div className={DZIN_SPACING.micro.wrapper}>
      <Skull className="w-5 h-5" style={{ color: ACCENT }} />
      <span className="font-mono text-xs">{ARCHETYPES.length} types</span>
    </div>
  );
}

/* ── Compact density ────────────────────────────────────────────────────── */

function BestiaryCompact() {
  return (
    <div className={`${DZIN_SPACING.compact.wrapper} text-xs`}>
      {ARCHETYPES.map((a) => (
        <div key={a.name} className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: a.color }}
          />
          <span className="text-text font-medium flex-1">{a.name}</span>
          <span className="text-text-muted">{a.role}</span>
        </div>
      ))}
      <div className={`border-t border-border/40 ${DZIN_SPACING.compact.divider} text-text-muted`}>
        {AI_PIPELINE.length}-stage AI pipeline
      </div>
    </div>
  );
}

/* ── Full density ───────────────────────────────────────────────────────── */

function BestiaryFull({ featureMap, defs }: EnemyBestiaryPanelProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const onToggle = (name: string) => setExpanded((prev) => (prev === name ? null : name));

  return (
    <div className={DZIN_SPACING.full.wrapper}>
      <SurfaceCard level={3} className={`${DZIN_SPACING.full.card} bg-surface-deep/50 border-border/40 text-sm text-text-muted leading-relaxed`}>
        Enemy AI bestiary with {ARCHETYPES.length} archetypes, behavior trees, AI perception, EQS queries,
        and spawn system for the ARPG enemy module.
      </SurfaceCard>

      <div className={`grid grid-cols-1 md:grid-cols-2 ${DZIN_SPACING.full.gap}`}>
        {/* Archetypes */}
        <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
          <SectionLabel icon={Skull} label="Enemy Archetypes" color={ACCENT} />
          <div className="space-y-2 mt-2">
            {ARCHETYPES.map((a, i) => (
              <motion.div
                key={a.name}
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
                className="flex items-center gap-2 text-xs"
              >
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: a.color }} />
                <span className="font-mono font-bold" style={{ color: a.color }}>{a.name}</span>
                <span className="text-text-muted ml-auto">{a.role}</span>
              </motion.div>
            ))}
          </div>
        </SurfaceCard>

        {/* Radar */}
        <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden flex items-center justify-center`}>
          <RadarChart data={BESTIARY_RADAR} size={180} accent={ACCENT} />
        </SurfaceCard>
      </div>

      {/* Feature cards */}
      {ENEMY_FEATURES.map((name) => (
        <FeatureCard key={name} name={name} featureMap={featureMap} defs={defs} expanded={expanded} onToggle={onToggle} accent={ACCENT} />
      ))}

      {/* Pipeline */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel label="AI Execution Pipeline" />
        <div className={DZIN_SPACING.full.pipelineMt}>
          <PipelineFlow steps={[...AI_PIPELINE]} accent={ACCENT} />
        </div>
      </SurfaceCard>
    </div>
  );
}

/* ── Main ───────────────────────────────────────────────────────────────── */

export function EnemyBestiaryPanel({ featureMap, defs }: EnemyBestiaryPanelProps) {
  const density = useDensity();

  return (
    <PanelFrame title="Enemy Bestiary" icon={<Skull className="w-4 h-4" />}>
      <AnimatePresence mode="wait">
        <motion.div
          key={density}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: TRANSITION_EXIT }}
          transition={TRANSITION_ENTER}
        >
          {density === 'micro' && <BestiaryMicro />}
          {density === 'compact' && <BestiaryCompact />}
          {density === 'full' && <BestiaryFull featureMap={featureMap} defs={defs} />}
        </motion.div>
      </AnimatePresence>
    </PanelFrame>
  );
}
