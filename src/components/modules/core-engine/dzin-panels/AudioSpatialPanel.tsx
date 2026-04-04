'use client';

import { useState } from 'react';
import { Volume2 } from 'lucide-react';
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
import { ACCENT_CYAN, ACCENT_VIOLET, ACCENT_ORANGE, ACCENT_EMERALD, ACCENT_PINK } from '@/lib/chart-colors';
import type { FeatureRow } from '@/types/feature-matrix';
import type { RadarDataPoint } from '@/types/unique-tab-improvements';

/* ── Props ──────────────────────────────────────────────────────────────── */

export interface AudioSpatialPanelProps {
  featureMap: Map<string, FeatureRow>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
}

/* ── Constants ──────────────────────────────────────────────────────────── */

const ACCENT = ACCENT_CYAN;

const AUDIO_SYSTEMS = [
  { name: 'Sound Manager', role: 'Core Subsystem', color: ACCENT_CYAN },
  { name: 'Ambient Sounds', role: 'Spatial Actors', color: ACCENT_EMERALD },
  { name: 'Dynamic Music', role: 'Layer Transitions', color: ACCENT_VIOLET },
  { name: 'MetaSounds', role: 'Procedural Audio', color: ACCENT_ORANGE },
  { name: 'Reverb Zones', role: 'Audio Volumes', color: ACCENT_PINK },
] as const;

const AUDIO_RADAR: RadarDataPoint[] = [
  { axis: 'Spatialization', value: 0.8 },
  { axis: 'Occlusion', value: 0.6 },
  { axis: 'Reverb', value: 0.7 },
  { axis: 'Concurrency', value: 0.5 },
  { axis: 'Procedural', value: 0.65 },
];

const AUDIO_PIPELINE = ['Source', 'Attenuation', 'Occlusion', 'Reverb', 'Mix'] as const;

const AUDIO_FEATURES = [
  'Sound manager subsystem', 'Ambient sound system', 'Dynamic music system',
  'Audio volumes and reverb', 'MetaSounds integration', 'Sound concurrency settings',
];

/* ── Micro density ──────────────────────────────────────────────────────── */

function AudioMicro() {
  return (
    <div className={DZIN_SPACING.micro.wrapper}>
      <Volume2 className="w-5 h-5" style={{ color: ACCENT }} />
      <span className="font-mono text-xs">{AUDIO_SYSTEMS.length} systems</span>
    </div>
  );
}

/* ── Compact density ────────────────────────────────────────────────────── */

function AudioCompact() {
  return (
    <div className={`${DZIN_SPACING.compact.wrapper} text-xs`}>
      {AUDIO_SYSTEMS.map((s) => (
        <div key={s.name} className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: s.color }}
          />
          <span className="text-text font-medium flex-1">{s.name}</span>
          <span className="text-text-muted">{s.role}</span>
        </div>
      ))}
      <div className={`border-t border-border/40 ${DZIN_SPACING.compact.divider} text-text-muted`}>
        {AUDIO_PIPELINE.length}-stage audio pipeline
      </div>
    </div>
  );
}

/* ── Full density ───────────────────────────────────────────────────────── */

function AudioFull({ featureMap, defs }: AudioSpatialPanelProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const onToggle = (name: string) => setExpanded((prev) => (prev === name ? null : name));

  return (
    <div className={DZIN_SPACING.full.wrapper}>
      <SurfaceCard level={3} className={`${DZIN_SPACING.full.card} bg-surface-deep/50 border-border/40 text-sm text-text-muted leading-relaxed`}>
        Spatial audio system with {AUDIO_SYSTEMS.length} subsystems covering attenuation, occlusion,
        reverb zones, MetaSounds procedural audio, and dynamic music state transitions.
      </SurfaceCard>

      <div className={`grid grid-cols-1 md:grid-cols-2 ${DZIN_SPACING.full.gap}`}>
        {/* Systems */}
        <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
          <SectionLabel icon={Volume2} label="Audio Systems" color={ACCENT} />
          <div className="space-y-2 mt-2">
            {AUDIO_SYSTEMS.map((s, i) => (
              <motion.div
                key={s.name}
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
                className="flex items-center gap-2 text-xs"
              >
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                <span className="font-mono font-bold" style={{ color: s.color }}>{s.name}</span>
                <span className="text-text-muted ml-auto">{s.role}</span>
              </motion.div>
            ))}
          </div>
        </SurfaceCard>

        {/* Radar */}
        <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden flex items-center justify-center`}>
          <RadarChart data={AUDIO_RADAR} size={180} accent={ACCENT} />
        </SurfaceCard>
      </div>

      {/* Feature cards */}
      {AUDIO_FEATURES.map((name) => (
        <FeatureCard key={name} name={name} featureMap={featureMap} defs={defs} expanded={expanded} onToggle={onToggle} accent={ACCENT} />
      ))}

      {/* Pipeline */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel label="Audio Processing Pipeline" />
        <div className={DZIN_SPACING.full.pipelineMt}>
          <PipelineFlow steps={[...AUDIO_PIPELINE]} accent={ACCENT} />
        </div>
      </SurfaceCard>
    </div>
  );
}

/* ── Main ───────────────────────────────────────────────────────────────── */

export function AudioSpatialPanel({ featureMap, defs }: AudioSpatialPanelProps) {
  const density = useDensity();

  return (
    <PanelFrame title="Spatial Audio" icon={<Volume2 className="w-4 h-4" />}>
      <AnimatePresence mode="wait">
        <motion.div
          key={density}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: TRANSITION_EXIT }}
          transition={TRANSITION_ENTER}
        >
          {density === 'micro' && <AudioMicro />}
          {density === 'compact' && <AudioCompact />}
          {density === 'full' && <AudioFull featureMap={featureMap} defs={defs} />}
        </motion.div>
      </AnimatePresence>
    </PanelFrame>
  );
}
