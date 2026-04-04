'use client';

import { useState } from 'react';
import { Radio } from 'lucide-react';
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

export interface AudioEventCatalogPanelProps {
  featureMap: Map<string, FeatureRow>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
}

/* ── Constants ──────────────────────────────────────────────────────────── */

const ACCENT = ACCENT_ORANGE;

const AUDIO_EVENTS = [
  { name: 'Impact SFX', category: 'Combat', count: 24, color: ACCENT_ORANGE },
  { name: 'Ambient Loops', category: 'Environment', count: 18, color: ACCENT_EMERALD },
  { name: 'UI Feedback', category: 'Interface', count: 32, color: ACCENT_CYAN },
  { name: 'Voice Lines', category: 'Dialogue', count: 48, color: ACCENT_VIOLET },
  { name: 'Music Stingers', category: 'Music', count: 12, color: ACCENT_PINK },
] as const;

const AUDIO_EVENT_RADAR: RadarDataPoint[] = [
  { axis: 'Coverage', value: 0.75 },
  { axis: 'Variation', value: 0.65 },
  { axis: 'Priority', value: 0.8 },
  { axis: 'Streaming', value: 0.7 },
  { axis: 'Compression', value: 0.85 },
];

const EVENT_PIPELINE = ['Trigger', 'Priority', 'Pool', 'Spatialize', 'Output'] as const;

const EVENT_FEATURES = [
  'Audio event registry', 'Event priority system', 'Sound pool management',
  'Audio bus routing', 'Compression presets', 'Streaming audio banks',
];

/* ── Micro density ──────────────────────────────────────────────────────── */

function EventMicro() {
  return (
    <div className={DZIN_SPACING.micro.wrapper}>
      <Radio className="w-5 h-5" style={{ color: ACCENT }} />
      <span className="font-mono text-xs">{AUDIO_EVENTS.reduce((s, e) => s + e.count, 0)} events</span>
    </div>
  );
}

/* ── Compact density ────────────────────────────────────────────────────── */

function EventCompact() {
  return (
    <div className={`${DZIN_SPACING.compact.wrapper} text-xs`}>
      {AUDIO_EVENTS.map((e) => (
        <div key={e.name} className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: e.color }}
          />
          <span className="text-text font-medium flex-1">{e.name}</span>
          <span className="text-text-muted">{e.count} events</span>
        </div>
      ))}
      <div className={`border-t border-border/40 ${DZIN_SPACING.compact.divider} text-text-muted`}>
        {EVENT_PIPELINE.length}-stage event pipeline
      </div>
    </div>
  );
}

/* ── Full density ───────────────────────────────────────────────────────── */

function EventFull({ featureMap, defs }: AudioEventCatalogPanelProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const onToggle = (name: string) => setExpanded((prev) => (prev === name ? null : name));

  return (
    <div className={DZIN_SPACING.full.wrapper}>
      <SurfaceCard level={3} className={`${DZIN_SPACING.full.card} bg-surface-deep/50 border-border/40 text-sm text-text-muted leading-relaxed`}>
        Audio event catalog with {AUDIO_EVENTS.length} categories totalling{' '}
        {AUDIO_EVENTS.reduce((s, e) => s + e.count, 0)} registered events, priority-based pooling,
        bus routing, and streaming bank management.
      </SurfaceCard>

      <div className={`grid grid-cols-1 md:grid-cols-2 ${DZIN_SPACING.full.gap}`}>
        {/* Event categories */}
        <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
          <SectionLabel icon={Radio} label="Event Categories" color={ACCENT} />
          <div className="space-y-2 mt-2">
            {AUDIO_EVENTS.map((e, i) => (
              <motion.div
                key={e.name}
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
                className="flex items-center gap-2 text-xs"
              >
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: e.color }} />
                <span className="font-mono font-bold" style={{ color: e.color }}>{e.name}</span>
                <span className="text-text-muted ml-auto">{e.category} · {e.count}</span>
              </motion.div>
            ))}
          </div>
        </SurfaceCard>

        {/* Radar */}
        <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden flex items-center justify-center`}>
          <RadarChart data={AUDIO_EVENT_RADAR} size={180} accent={ACCENT} />
        </SurfaceCard>
      </div>

      {/* Feature cards */}
      {EVENT_FEATURES.map((name) => (
        <FeatureCard key={name} name={name} featureMap={featureMap} defs={defs} expanded={expanded} onToggle={onToggle} accent={ACCENT} />
      ))}

      {/* Pipeline */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel label="Audio Event Pipeline" />
        <div className={DZIN_SPACING.full.pipelineMt}>
          <PipelineFlow steps={[...EVENT_PIPELINE]} accent={ACCENT} />
        </div>
      </SurfaceCard>
    </div>
  );
}

/* ── Main ───────────────────────────────────────────────────────────────── */

export function AudioEventCatalogPanel({ featureMap, defs }: AudioEventCatalogPanelProps) {
  const density = useDensity();

  return (
    <PanelFrame title="Audio Event Catalog" icon={<Radio className="w-4 h-4" />}>
      <AnimatePresence mode="wait">
        <motion.div
          key={density}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: TRANSITION_EXIT }}
          transition={TRANSITION_ENTER}
        >
          {density === 'micro' && <EventMicro />}
          {density === 'compact' && <EventCompact />}
          {density === 'full' && <EventFull featureMap={featureMap} defs={defs} />}
        </motion.div>
      </AnimatePresence>
    </PanelFrame>
  );
}
