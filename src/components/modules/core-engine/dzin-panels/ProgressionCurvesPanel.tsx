'use client';

import { useState } from 'react';
import { TrendingUp } from 'lucide-react';
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
import { ACCENT_CYAN, ACCENT_EMERALD, ACCENT_ORANGE, ACCENT_PURPLE, ACCENT_RED } from '@/lib/chart-colors';
import type { FeatureRow } from '@/types/feature-matrix';
import type { RadarDataPoint } from '@/types/unique-tab-improvements';

/* ── Props ──────────────────────────────────────────────────────────────── */

export interface ProgressionCurvesPanelProps {
  featureMap: Map<string, FeatureRow>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
}

/* ── Constants ──────────────────────────────────────────────────────────── */

const ACCENT = ACCENT_CYAN;

const CURVE_METRICS = [
  { name: 'XP Curve', desc: 'Exponential XP-to-level progression', color: ACCENT_CYAN },
  { name: 'Power Curve', desc: 'Attribute growth per level', color: ACCENT_RED },
  { name: 'Ability Unlock', desc: 'Skill point gates and ability tree', color: ACCENT_PURPLE },
  { name: 'Gear Score', desc: 'Item power scaling per zone tier', color: ACCENT_ORANGE },
  { name: 'Difficulty', desc: 'Enemy scaling relative to player', color: ACCENT_EMERALD },
] as const;

const PROGRESSION_RADAR: RadarDataPoint[] = [
  { axis: 'XP', value: 0.75 },
  { axis: 'Power', value: 0.65 },
  { axis: 'Ability', value: 0.8 },
  { axis: 'Gear', value: 0.6 },
  { axis: 'Difficulty', value: 0.7 },
];

const PROGRESSION_PIPELINE = ['XPAward', 'LevelCheck', 'PointGrant', 'AbilityUnlock', 'AttrAlloc'] as const;

const PROGRESSION_FEATURES = [
  'XP and Level attributes', 'XP curve table', 'XP award on enemy death',
  'Level-up detection', 'Active abilities',
  'Ability unlock system', 'Attribute point allocation', 'Ability loadout',
];

/* ── Micro density ──────────────────────────────────────────────────────── */

function CurvesMicro() {
  return (
    <div className={DZIN_SPACING.micro.wrapper}>
      <TrendingUp className="w-5 h-5" style={{ color: ACCENT }} />
      <span className="font-mono text-xs">{CURVE_METRICS.length} curves</span>
    </div>
  );
}

/* ── Compact density ────────────────────────────────────────────────────── */

function CurvesCompact() {
  return (
    <div className={`${DZIN_SPACING.compact.wrapper} text-xs`}>
      {CURVE_METRICS.map((c) => (
        <div key={c.name} className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: c.color }}
          />
          <span className="text-text font-medium flex-1">{c.name}</span>
        </div>
      ))}
      <div className={`border-t border-border/40 ${DZIN_SPACING.compact.divider} text-text-muted`}>
        {PROGRESSION_PIPELINE.length}-stage level-up pipeline
      </div>
    </div>
  );
}

/* ── Full density ───────────────────────────────────────────────────────── */

function CurvesFull({ featureMap, defs }: ProgressionCurvesPanelProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const onToggle = (name: string) => setExpanded((prev) => (prev === name ? null : name));

  return (
    <div className={DZIN_SPACING.full.wrapper}>
      <SurfaceCard level={3} className={`${DZIN_SPACING.full.card} bg-surface-deep/50 border-border/40 text-sm text-text-muted leading-relaxed`}>
        Progression system with {CURVE_METRICS.length} scaling curves covering XP, power, abilities,
        gear score, and difficulty balancing.
      </SurfaceCard>

      <div className={`grid grid-cols-1 md:grid-cols-2 ${DZIN_SPACING.full.gap}`}>
        {/* Curve Metrics */}
        <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
          <SectionLabel icon={TrendingUp} label="Scaling Curves" color={ACCENT} />
          <div className="space-y-2 mt-2">
            {CURVE_METRICS.map((c, i) => (
              <motion.div
                key={c.name}
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
                className="text-xs"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
                  <span className="font-mono font-bold" style={{ color: c.color }}>{c.name}</span>
                </div>
                <div className="text-text-muted ml-4.5">{c.desc}</div>
              </motion.div>
            ))}
          </div>
        </SurfaceCard>

        {/* Radar */}
        <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden flex items-center justify-center`}>
          <RadarChart data={PROGRESSION_RADAR} size={180} accent={ACCENT} />
        </SurfaceCard>
      </div>

      {/* Feature cards */}
      {PROGRESSION_FEATURES.map((name) => (
        <FeatureCard key={name} name={name} featureMap={featureMap} defs={defs} expanded={expanded} onToggle={onToggle} accent={ACCENT} />
      ))}

      {/* Pipeline */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel label="Level-Up Pipeline" />
        <div className={DZIN_SPACING.full.pipelineMt}>
          <PipelineFlow steps={[...PROGRESSION_PIPELINE]} accent={ACCENT} />
        </div>
      </SurfaceCard>
    </div>
  );
}

/* ── Main ───────────────────────────────────────────────────────────────── */

export function ProgressionCurvesPanel({ featureMap, defs }: ProgressionCurvesPanelProps) {
  const density = useDensity();

  return (
    <PanelFrame title="Progression Curves" icon={<TrendingUp className="w-4 h-4" />}>
      <AnimatePresence mode="wait">
        <motion.div
          key={density}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: TRANSITION_EXIT }}
          transition={TRANSITION_ENTER}
        >
          {density === 'micro' && <CurvesMicro />}
          {density === 'compact' && <CurvesCompact />}
          {density === 'full' && <CurvesFull featureMap={featureMap} defs={defs} />}
        </motion.div>
      </AnimatePresence>
    </PanelFrame>
  );
}
