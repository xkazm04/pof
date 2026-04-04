'use client';

import { useState } from 'react';
import { Film } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useDensity, PanelFrame } from '@/lib/dzin/core';
import { DZIN_SPACING, TRANSITION_ENTER, TRANSITION_EXIT } from '@/lib/dzin/animation-constants';
import {
  FeatureCard,
  SectionLabel,
  statusInfo,
} from '@/components/modules/core-engine/unique-tabs/_shared';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { ACCENT_PINK, ACCENT_RED, ACCENT_CYAN, ACCENT_ORANGE, STATUS_SUBDUED } from '@/lib/chart-colors';
import type { FeatureRow } from '@/types/feature-matrix';

/* ── Props ──────────────────────────────────────────────────────────────── */

export interface AnimationMontagesPanelProps {
  featureMap: Map<string, FeatureRow>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
}

/* ── Constants ──────────────────────────────────────────────────────────── */

const ACCENT = ACCENT_PINK;

interface MontageInfo {
  name: string;
  type: string;
  sections: string[];
  color: string;
}

const MONTAGES: MontageInfo[] = [
  { name: 'AM_MeleeCombo', type: 'Attack', sections: ['Attack1', 'Attack2', 'Attack3'], color: ACCENT_RED },
  { name: 'AM_Dodge', type: 'Movement', sections: ['DodgeStart', 'DodgeEnd'], color: ACCENT_CYAN },
  { name: 'AM_HitReact', type: 'Feedback', sections: ['HitFront', 'HitBack'], color: ACCENT_ORANGE },
  { name: 'AM_Death', type: 'Feedback', sections: ['DeathFall'], color: STATUS_SUBDUED },
];

const MONTAGE_FEATURES = ['Attack montages', 'Anim Notify classes', 'Motion Warping'] as const;

const NOTIFY_TYPES = [
  { name: 'ComboWindow', desc: 'Opens input buffer for next combo hit' },
  { name: 'HitDetection', desc: 'Enables weapon trace for damage' },
  { name: 'SpawnVFX', desc: 'Spawns visual effects at sockets' },
  { name: 'PlaySound', desc: 'Plays SFX at notify time' },
] as const;

/* ── Micro density ──────────────────────────────────────────────────────── */

function MontagesMicro({ featureMap }: AnimationMontagesPanelProps) {
  const completed = MONTAGE_FEATURES.filter((f) => {
    const s = featureMap.get(f)?.status;
    return s === 'implemented' || s === 'improved';
  }).length;

  return (
    <div className={DZIN_SPACING.micro.wrapper}>
      <Film className="w-5 h-5 text-pink-400" />
      <span className="font-mono text-xs">{completed}/{MONTAGE_FEATURES.length}</span>
      <span className="text-2xs text-text-muted">{MONTAGES.length} montages</span>
    </div>
  );
}

/* ── Compact density ────────────────────────────────────────────────────── */

function MontagesCompact({ featureMap }: AnimationMontagesPanelProps) {
  const montageStatus = featureMap.get('Attack montages')?.status;
  const { color: dotColor, label: dotLabel } = statusInfo(montageStatus);

  return (
    <div className={`${DZIN_SPACING.compact.wrapper} text-xs`}>
      <div className="flex items-center gap-2 mb-1">
        <span
          className="w-3 h-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: dotColor, boxShadow: `0 0 0 3px ${dotColor}33` }}
          title={dotLabel}
        />
        <span className="font-medium text-text">Montages</span>
      </div>
      {MONTAGES.map((m) => (
        <div key={m.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: m.color }} />
          <span className="text-text-muted font-mono">{m.name}</span>
          <span className="text-2xs text-text-muted/60">{m.sections.length}s</span>
        </div>
      ))}
    </div>
  );
}

/* ── Full density ───────────────────────────────────────────────────────── */

function MontagesFull({ featureMap, defs }: AnimationMontagesPanelProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const onToggle = (name: string) => setExpanded((prev) => (prev === name ? null : name));

  return (
    <div className={DZIN_SPACING.full.wrapper}>
      <SurfaceCard level={3} className={`${DZIN_SPACING.full.card} bg-surface-deep/50 border-border/40 text-sm text-text-muted leading-relaxed`}>
        Animation montages drive combo attacks, dodge rolls, hit reactions, and death sequences.
        Each montage uses <span className="font-mono text-xs text-text">CompositeSections</span> with
        linked <span className="font-mono text-xs text-text">NextSectionName</span> for combo chaining.
      </SurfaceCard>

      {/* Feature cards */}
      {MONTAGE_FEATURES.map((name) => (
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

      {/* Montage Catalog */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel label="Montage Catalog" />
        <div className={`space-y-2 ${DZIN_SPACING.full.contentMt}`}>
          {MONTAGES.map((m, mi) => (
            <motion.div
              key={m.name}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: mi * 0.06 }}
              className="bg-surface p-2.5 rounded-lg border border-border/50 shadow-sm"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: m.color, boxShadow: `0 0 0 3px ${m.color}33` }}
                />
                <span className="text-xs font-bold font-mono text-text">{m.name}</span>
                <span className="text-2xs px-1.5 py-0.5 rounded bg-surface-deep text-text-muted">{m.type}</span>
              </div>
              <div className="ml-5 flex flex-wrap gap-1">
                {m.sections.map((sec) => (
                  <span
                    key={sec}
                    className="text-2xs font-mono px-1.5 py-0.5 rounded border border-border/40 text-text-muted"
                  >
                    {sec}
                  </span>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </SurfaceCard>

      {/* Notify Types */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel label="Anim Notify Types" />
        <div className={`grid grid-cols-2 ${DZIN_SPACING.full.gridGap} ${DZIN_SPACING.full.contentMt}`}>
          {NOTIFY_TYPES.map((n) => (
            <div key={n.name} className="bg-surface p-2 rounded-lg border border-border/50 shadow-sm">
              <span className="text-xs font-mono font-medium text-text">{n.name}</span>
              <p className="text-2xs text-text-muted mt-0.5">{n.desc}</p>
            </div>
          ))}
        </div>
      </SurfaceCard>
    </div>
  );
}

/* ── Main ───────────────────────────────────────────────────────────────── */

export function AnimationMontagesPanel({ featureMap, defs }: AnimationMontagesPanelProps) {
  const density = useDensity();

  return (
    <PanelFrame title="Montages" icon={<Film className="w-4 h-4" />}>
      <AnimatePresence mode="wait">
        <motion.div
          key={density}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: TRANSITION_EXIT }}
          transition={TRANSITION_ENTER}
        >
          {density === 'micro' && <MontagesMicro featureMap={featureMap} defs={defs} />}
          {density === 'compact' && <MontagesCompact featureMap={featureMap} defs={defs} />}
          {density === 'full' && <MontagesFull featureMap={featureMap} defs={defs} />}
        </motion.div>
      </AnimatePresence>
    </PanelFrame>
  );
}
