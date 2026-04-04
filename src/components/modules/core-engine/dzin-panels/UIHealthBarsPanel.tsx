'use client';

import { useState } from 'react';
import { Heart } from 'lucide-react';
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
import { ACCENT_PINK, ACCENT_RED, ACCENT_ORANGE, ACCENT_EMERALD, ACCENT_CYAN } from '@/lib/chart-colors';
import type { FeatureRow } from '@/types/feature-matrix';
import type { RadarDataPoint } from '@/types/unique-tab-improvements';

/* ── Props ──────────────────────────────────────────────────────────────── */

export interface UIHealthBarsPanelProps {
  featureMap: Map<string, FeatureRow>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
}

/* ── Constants ──────────────────────────────────────────────────────────── */

const ACCENT = ACCENT_PINK;

const HEALTH_STATES = [
  { name: 'Full Health', threshold: '100%', effect: 'Steady glow', color: ACCENT_EMERALD },
  { name: 'Damaged', threshold: '75%', effect: 'Delayed drain', color: ACCENT_CYAN },
  { name: 'Low Health', threshold: '30%', effect: 'Pulse warning', color: ACCENT_ORANGE },
  { name: 'Critical', threshold: '10%', effect: 'Fast pulse + vignette', color: ACCENT_RED },
  { name: 'Shield Active', threshold: 'Overlay', effect: 'Shield shimmer', color: ACCENT_PINK },
] as const;

const HEALTH_RADAR: RadarDataPoint[] = [
  { axis: 'Readability', value: 0.9 },
  { axis: 'Responsiveness', value: 0.85 },
  { axis: 'Feedback', value: 0.8 },
  { axis: 'Scalability', value: 0.7 },
  { axis: 'Customization', value: 0.75 },
];

const HEALTH_PIPELINE = ['Attribute Change', 'FSM Transition', 'Lerp Bar', 'VFX Layer', 'Pool Update'] as const;

const HEALTH_FEATURES = [
  'Enemy health bar FSM', 'Low health pulse effect', 'Delayed damage drain',
  'Shield overlay system', 'Boss health segmentation', 'Health bar pooling',
];

/* ── Micro density ──────────────────────────────────────────────────────── */

function HealthMicro() {
  return (
    <div className={DZIN_SPACING.micro.wrapper}>
      <Heart className="w-5 h-5" style={{ color: ACCENT }} />
      <span className="font-mono text-xs">{HEALTH_STATES.length} states</span>
    </div>
  );
}

/* ── Compact density ────────────────────────────────────────────────────── */

function HealthCompact() {
  return (
    <div className={`${DZIN_SPACING.compact.wrapper} text-xs`}>
      {HEALTH_STATES.map((s) => (
        <div key={s.name} className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: s.color }}
          />
          <span className="text-text font-medium flex-1">{s.name}</span>
          <span className="text-text-muted">{s.threshold}</span>
        </div>
      ))}
      <div className={`border-t border-border/40 ${DZIN_SPACING.compact.divider} text-text-muted`}>
        {HEALTH_PIPELINE.length}-stage health pipeline
      </div>
    </div>
  );
}

/* ── Full density ───────────────────────────────────────────────────────── */

function HealthFull({ featureMap, defs }: UIHealthBarsPanelProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const onToggle = (name: string) => setExpanded((prev) => (prev === name ? null : name));

  return (
    <div className={DZIN_SPACING.full.wrapper}>
      <SurfaceCard level={3} className={`${DZIN_SPACING.full.card} bg-surface-deep/50 border-border/40 text-sm text-text-muted leading-relaxed`}>
        Health bar system with {HEALTH_STATES.length}-state FSM, delayed damage drain animation,
        low health pulse warnings, shield overlays, and boss segmented bars.
      </SurfaceCard>

      <div className={`grid grid-cols-1 md:grid-cols-2 ${DZIN_SPACING.full.gap}`}>
        {/* Health States */}
        <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
          <SectionLabel icon={Heart} label="Health States" color={ACCENT} />
          <div className="space-y-2 mt-2">
            {HEALTH_STATES.map((s, i) => (
              <motion.div
                key={s.name}
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
                className="flex items-center gap-2 text-xs"
              >
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                <span className="font-mono font-bold" style={{ color: s.color }}>{s.name}</span>
                <span className="text-text-muted ml-auto">{s.effect}</span>
              </motion.div>
            ))}
          </div>
        </SurfaceCard>

        {/* Radar */}
        <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden flex items-center justify-center`}>
          <RadarChart data={HEALTH_RADAR} size={180} accent={ACCENT} />
        </SurfaceCard>
      </div>

      {/* Feature cards */}
      {HEALTH_FEATURES.map((name) => (
        <FeatureCard key={name} name={name} featureMap={featureMap} defs={defs} expanded={expanded} onToggle={onToggle} accent={ACCENT} />
      ))}

      {/* Pipeline */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel label="Health Bar Pipeline" />
        <div className={DZIN_SPACING.full.pipelineMt}>
          <PipelineFlow steps={[...HEALTH_PIPELINE]} accent={ACCENT} />
        </div>
      </SurfaceCard>
    </div>
  );
}

/* ── Main ───────────────────────────────────────────────────────────────── */

export function UIHealthBarsPanel({ featureMap, defs }: UIHealthBarsPanelProps) {
  const density = useDensity();

  return (
    <PanelFrame title="Health Bars" icon={<Heart className="w-4 h-4" />}>
      <AnimatePresence mode="wait">
        <motion.div
          key={density}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: TRANSITION_EXIT }}
          transition={TRANSITION_ENTER}
        >
          {density === 'micro' && <HealthMicro />}
          {density === 'compact' && <HealthCompact />}
          {density === 'full' && <HealthFull featureMap={featureMap} defs={defs} />}
        </motion.div>
      </AnimatePresence>
    </PanelFrame>
  );
}
