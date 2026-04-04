'use client';

import { useState } from 'react';
import { Hash } from 'lucide-react';
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
import { ACCENT_RED, ACCENT_ORANGE, ACCENT_CYAN, ACCENT_EMERALD, ACCENT_VIOLET } from '@/lib/chart-colors';
import type { FeatureRow } from '@/types/feature-matrix';
import type { RadarDataPoint } from '@/types/unique-tab-improvements';

/* ── Props ──────────────────────────────────────────────────────────────── */

export interface UIDamageNumbersPanelProps {
  featureMap: Map<string, FeatureRow>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
}

/* ── Constants ──────────────────────────────────────────────────────────── */

const ACCENT = ACCENT_RED;

const DAMAGE_TYPES = [
  { name: 'Normal Hit', style: 'Standard pop', physics: 'Gravity arc', color: ACCENT_RED },
  { name: 'Critical Hit', style: 'Scale burst', physics: 'Bounce', color: ACCENT_ORANGE },
  { name: 'Heal', style: 'Float up', physics: 'Linear rise', color: ACCENT_EMERALD },
  { name: 'Shield Block', style: 'Crack shatter', physics: 'Radial scatter', color: ACCENT_CYAN },
  { name: 'Status Effect', style: 'Pulse glow', physics: 'Orbit', color: ACCENT_VIOLET },
] as const;

const DAMAGE_RADAR: RadarDataPoint[] = [
  { axis: 'Readability', value: 0.85 },
  { axis: 'Impact Feel', value: 0.8 },
  { axis: 'Performance', value: 0.9 },
  { axis: 'Variety', value: 0.7 },
  { axis: 'Customization', value: 0.75 },
];

const DAMAGE_PIPELINE = ['Damage Event', 'Style Lookup', 'Spawn Widget', 'Physics Sim', 'Pool Return'] as const;

const DAMAGE_FEATURES = [
  'Damage number palette editor', 'Physics simulation presets', 'Number pooling system',
  'Critical hit scaling', 'Color-coded damage types', 'Text animation curves',
];

/* ── Micro density ──────────────────────────────────────────────────────── */

function DamageMicro() {
  return (
    <div className={DZIN_SPACING.micro.wrapper}>
      <Hash className="w-5 h-5" style={{ color: ACCENT }} />
      <span className="font-mono text-xs">{DAMAGE_TYPES.length} types</span>
    </div>
  );
}

/* ── Compact density ────────────────────────────────────────────────────── */

function DamageCompact() {
  return (
    <div className={`${DZIN_SPACING.compact.wrapper} text-xs`}>
      {DAMAGE_TYPES.map((d) => (
        <div key={d.name} className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: d.color }}
          />
          <span className="text-text font-medium flex-1">{d.name}</span>
          <span className="text-text-muted">{d.style}</span>
        </div>
      ))}
      <div className={`border-t border-border/40 ${DZIN_SPACING.compact.divider} text-text-muted`}>
        {DAMAGE_PIPELINE.length}-stage render pipeline
      </div>
    </div>
  );
}

/* ── Full density ───────────────────────────────────────────────────────── */

function DamageFull({ featureMap, defs }: UIDamageNumbersPanelProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const onToggle = (name: string) => setExpanded((prev) => (prev === name ? null : name));

  return (
    <div className={DZIN_SPACING.full.wrapper}>
      <SurfaceCard level={3} className={`${DZIN_SPACING.full.card} bg-surface-deep/50 border-border/40 text-sm text-text-muted leading-relaxed`}>
        Damage number system with {DAMAGE_TYPES.length} visual types, physics-driven motion
        simulation, widget pooling for performance, and customizable animation curves.
      </SurfaceCard>

      <div className={`grid grid-cols-1 md:grid-cols-2 ${DZIN_SPACING.full.gap}`}>
        {/* Damage Types */}
        <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
          <SectionLabel icon={Hash} label="Damage Types" color={ACCENT} />
          <div className="space-y-2 mt-2">
            {DAMAGE_TYPES.map((d, i) => (
              <motion.div
                key={d.name}
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
                className="flex items-center gap-2 text-xs"
              >
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                <span className="font-mono font-bold" style={{ color: d.color }}>{d.name}</span>
                <span className="text-text-muted ml-auto">{d.physics}</span>
              </motion.div>
            ))}
          </div>
        </SurfaceCard>

        {/* Radar */}
        <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden flex items-center justify-center`}>
          <RadarChart data={DAMAGE_RADAR} size={180} accent={ACCENT} />
        </SurfaceCard>
      </div>

      {/* Feature cards */}
      {DAMAGE_FEATURES.map((name) => (
        <FeatureCard key={name} name={name} featureMap={featureMap} defs={defs} expanded={expanded} onToggle={onToggle} accent={ACCENT} />
      ))}

      {/* Pipeline */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel label="Damage Number Pipeline" />
        <div className={DZIN_SPACING.full.pipelineMt}>
          <PipelineFlow steps={[...DAMAGE_PIPELINE]} accent={ACCENT} />
        </div>
      </SurfaceCard>
    </div>
  );
}

/* ── Main ───────────────────────────────────────────────────────────────── */

export function UIDamageNumbersPanel({ featureMap, defs }: UIDamageNumbersPanelProps) {
  const density = useDensity();

  return (
    <PanelFrame title="Damage Numbers" icon={<Hash className="w-4 h-4" />}>
      <AnimatePresence mode="wait">
        <motion.div
          key={density}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: TRANSITION_EXIT }}
          transition={TRANSITION_ENTER}
        >
          {density === 'micro' && <DamageMicro />}
          {density === 'compact' && <DamageCompact />}
          {density === 'full' && <DamageFull featureMap={featureMap} defs={defs} />}
        </motion.div>
      </AnimatePresence>
    </PanelFrame>
  );
}
