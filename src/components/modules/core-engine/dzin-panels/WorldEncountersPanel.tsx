'use client';

import { useState } from 'react';
import { Swords } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useDensity, PanelFrame } from '@/lib/dzin/core';
import { DZIN_SPACING, TRANSITION_ENTER, TRANSITION_EXIT } from '@/lib/dzin/animation-constants';
import {
  FeatureCard,
  SectionLabel,
} from '@/components/modules/core-engine/unique-tabs/_shared';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { ACCENT_PINK, ACCENT_RED, ACCENT_ORANGE, STATUS_WARNING, ACCENT_CYAN } from '@/lib/chart-colors';
import type { FeatureRow } from '@/types/feature-matrix';

/* ── Props ──────────────────────────────────────────────────────────────── */

export interface WorldEncountersPanelProps {
  featureMap: Map<string, FeatureRow>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
}

/* ── Constants ──────────────────────────────────────────────────────────── */

const ACCENT = ACCENT_PINK;

const ENCOUNTER_TYPES = [
  { name: 'Ambient', desc: 'Roaming enemies in open world', count: 12, color: ACCENT_ORANGE },
  { name: 'Wave', desc: 'Triggered multi-wave spawns', count: 5, color: ACCENT_RED },
  { name: 'Boss', desc: 'Multi-phase boss encounters', count: 2, color: ACCENT_CYAN },
  { name: 'Trap', desc: 'Environmental hazard encounters', count: 8, color: STATUS_WARNING },
] as const;

const ENCOUNTER_FEATURES = [
  'Enemy spawn placement', 'Boss encounter',
  'Environmental hazards', 'Interactive world objects',
];

/* ── Micro density ──────────────────────────────────────────────────────── */

function EncountersMicro() {
  const total = ENCOUNTER_TYPES.reduce((s, t) => s + t.count, 0);
  return (
    <div className={DZIN_SPACING.micro.wrapper}>
      <Swords className="w-5 h-5" style={{ color: ACCENT }} />
      <span className="font-mono text-xs">{total} encounters</span>
    </div>
  );
}

/* ── Compact density ────────────────────────────────────────────────────── */

function EncountersCompact() {
  return (
    <div className={`${DZIN_SPACING.compact.wrapper} text-xs`}>
      {ENCOUNTER_TYPES.map((t) => (
        <div key={t.name} className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: t.color }}
          />
          <span className="text-text font-medium flex-1">{t.name}</span>
          <span className="font-mono text-text-muted">{t.count}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Full density ───────────────────────────────────────────────────────── */

function EncountersFull({ featureMap, defs }: WorldEncountersPanelProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const onToggle = (name: string) => setExpanded((prev) => (prev === name ? null : name));

  return (
    <div className={DZIN_SPACING.full.wrapper}>
      <SurfaceCard level={3} className={`${DZIN_SPACING.full.card} bg-surface-deep/50 border-border/40 text-sm text-text-muted leading-relaxed`}>
        World encounter design with {ENCOUNTER_TYPES.length} types including ambient spawns,
        wave events, boss phases, and environmental traps.
      </SurfaceCard>

      {/* Encounter Type Grid */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={Swords} label="Encounter Types" color={ACCENT} />
        <div className={`grid grid-cols-2 ${DZIN_SPACING.full.gridGap} mt-2`}>
          {ENCOUNTER_TYPES.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.08 }}
              className="bg-surface-deep border rounded-xl p-3 relative overflow-hidden"
              style={{ borderColor: `${t.color}40` }}
            >
              <div className="text-xs font-mono font-bold" style={{ color: t.color }}>{t.name}</div>
              <div className="text-2xs text-text-muted mt-0.5">{t.desc}</div>
              <div className="text-xs font-mono mt-1" style={{ color: t.color }}>{t.count} placed</div>
            </motion.div>
          ))}
        </div>
      </SurfaceCard>

      {/* Feature cards */}
      {ENCOUNTER_FEATURES.map((name) => (
        <FeatureCard key={name} name={name} featureMap={featureMap} defs={defs} expanded={expanded} onToggle={onToggle} accent={ACCENT} />
      ))}
    </div>
  );
}

/* ── Main ───────────────────────────────────────────────────────────────── */

export function WorldEncountersPanel({ featureMap, defs }: WorldEncountersPanelProps) {
  const density = useDensity();

  return (
    <PanelFrame title="World Encounters" icon={<Swords className="w-4 h-4" />}>
      <AnimatePresence mode="wait">
        <motion.div
          key={density}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: TRANSITION_EXIT }}
          transition={TRANSITION_ENTER}
        >
          {density === 'micro' && <EncountersMicro />}
          {density === 'compact' && <EncountersCompact />}
          {density === 'full' && <EncountersFull featureMap={featureMap} defs={defs} />}
        </motion.div>
      </AnimatePresence>
    </PanelFrame>
  );
}
