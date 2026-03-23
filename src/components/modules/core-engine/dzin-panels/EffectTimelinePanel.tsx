'use client';

import { Clock } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ACCENT_RED, MODULE_COLORS, ACCENT_EMERALD_DARK, ACCENT_GREEN, STATUS_STALE,
} from '@/lib/chart-colors';
import { useDensity, PanelFrame } from '@/lib/dzin/core';
import { DZIN_TIMING } from '@/lib/dzin/animation-constants';
import { TimelineStrip, SectionLabel } from '@/components/modules/core-engine/unique-tabs/_shared';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import type { FeatureRow } from '@/types/feature-matrix';
import type { TimelineEvent } from '@/types/unique-tab-improvements';

/* ── Props ──────────────────────────────────────────────────────────────── */

export interface EffectTimelinePanelProps {
  featureMap: Map<string, FeatureRow>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
}

/* ── Constants ──────────────────────────────────────────────────────────── */

const EFFECT_TIMELINE_EVENTS: TimelineEvent[] = [
  { id: 'e1', timestamp: 0.5, label: 'GE_Damage', category: 'damage', color: ACCENT_RED, details: 'Instant damage' },
  { id: 'e2', timestamp: 1.0, label: 'GE_Buff(AtkUp)', category: 'buff', color: MODULE_COLORS.core, duration: 3.0, details: 'Attack buff 3s' },
  { id: 'e3', timestamp: 2.0, label: 'GE_Regen', category: 'regen', color: ACCENT_EMERALD_DARK, duration: 5.0, details: 'HP regen 5s' },
  { id: 'e4', timestamp: 3.5, label: 'GE_Damage', category: 'damage', color: ACCENT_RED, details: 'Instant damage' },
  { id: 'e5', timestamp: 4.0, label: 'GE_Buff(DefUp)', category: 'buff', color: MODULE_COLORS.core, duration: 4.0, details: 'Defense buff 4s' },
  { id: 'e6', timestamp: 5.5, label: 'GE_Heal', category: 'heal', color: ACCENT_GREEN, details: 'Instant heal' },
  { id: 'e7', timestamp: 7.0, label: 'GE_Damage', category: 'damage', color: ACCENT_RED, details: 'Instant damage' },
  { id: 'e8', timestamp: 8.5, label: 'GE_Regen', category: 'regen', color: STATUS_STALE, duration: 2.0, details: 'Mana regen 2s' },
];

/* ── Computed constants ─────────────────────────────────────────────────── */

const MIN_TIMESTAMP = Math.min(...EFFECT_TIMELINE_EVENTS.map((e) => e.timestamp));
const MAX_TIMESTAMP = Math.max(
  ...EFFECT_TIMELINE_EVENTS.map((e) => e.timestamp + (e.duration ?? 0)),
);

/* ── Micro density ──────────────────────────────────────────────────────── */

function TimelineMicro() {
  return (
    <div className="flex flex-col items-center justify-center gap-1 p-2">
      <Clock className="w-5 h-5 text-red-400" />
      <span className="font-mono text-2xs text-text-muted">
        {MIN_TIMESTAMP.toFixed(1)}s - {MAX_TIMESTAMP.toFixed(1)}s
      </span>
    </div>
  );
}

/* ── Compact density ────────────────────────────────────────────────────── */

function TimelineCompact() {
  const range = MAX_TIMESTAMP - MIN_TIMESTAMP || 1;

  return (
    <div className="p-2">
      <div className="relative w-full h-6 bg-surface-deep rounded-md overflow-hidden">
        {EFFECT_TIMELINE_EVENTS.map((evt) => {
          const left = ((evt.timestamp - MIN_TIMESTAMP) / range) * 100;
          const width = evt.duration ? ((evt.duration / range) * 100) : 2;
          return (
            <div
              key={evt.id}
              className="absolute top-0 h-full rounded-sm opacity-70"
              style={{
                left: `${left}%`,
                width: `${Math.max(width, 1.5)}%`,
                backgroundColor: evt.color,
              }}
              title={`${evt.label}: ${evt.details}`}
            />
          );
        })}
      </div>
      <div className="flex justify-between mt-1 text-2xs text-text-muted font-mono">
        <span>{MIN_TIMESTAMP.toFixed(1)}s</span>
        <span>{MAX_TIMESTAMP.toFixed(1)}s</span>
      </div>
    </div>
  );
}

/* ── Full density ───────────────────────────────────────────────────────── */

function TimelineFull() {
  return (
    <div className="space-y-2.5">
      <SurfaceCard level={2} className="p-3 relative overflow-hidden">
        <SectionLabel label="Effect Stack Timeline" />
        <div className="mt-3">
          <TimelineStrip
            events={EFFECT_TIMELINE_EVENTS}
            accent="#ef4444"
            height={80}
          />
        </div>
      </SurfaceCard>
    </div>
  );
}

/* ── Main EffectTimelinePanel ───────────────────────────────────────────── */

export function EffectTimelinePanel({ featureMap: _featureMap, defs: _defs }: EffectTimelinePanelProps) {
  const density = useDensity();

  return (
    <PanelFrame title="Effect Timeline" icon={<Clock className="w-4 h-4" />}>
      <AnimatePresence mode="wait">
        <motion.div
          key={density}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: DZIN_TIMING.DENSITY / 2 }}
        >
          {density === 'micro' && <TimelineMicro />}
          {density === 'compact' && <TimelineCompact />}
          {density === 'full' && <TimelineFull />}
        </motion.div>
      </AnimatePresence>
    </PanelFrame>
  );
}
