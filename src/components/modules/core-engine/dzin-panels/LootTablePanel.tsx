'use client';

import { useState } from 'react';
import { Coins } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useDensity, PanelFrame } from '@/lib/dzin/core';
import { DZIN_SPACING, TRANSITION_ENTER, TRANSITION_EXIT } from '@/lib/dzin/animation-constants';
import {
  FeatureCard,
  PipelineFlow,
  SectionLabel,
} from '@/components/modules/core-engine/unique-tabs/_shared';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { STATUS_WARNING, ACCENT_RED, ACCENT_EMERALD, ACCENT_ORANGE } from '@/lib/chart-colors';
import type { FeatureRow } from '@/types/feature-matrix';

/* ── Props ──────────────────────────────────────────────────────────────── */

export interface LootTablePanelProps {
  featureMap: Map<string, FeatureRow>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
}

/* ── Constants ──────────────────────────────────────────────────────────── */

const ACCENT = STATUS_WARNING;

const LOOT_TABLES = [
  { name: 'LT_GoblinCommon', entries: 8, dropRate: '35%', color: ACCENT_EMERALD },
  { name: 'LT_BossElite', entries: 12, dropRate: '100%', color: ACCENT_RED },
  { name: 'LT_ChestTreasure', entries: 6, dropRate: '80%', color: ACCENT_ORANGE },
  { name: 'LT_WorldDrop', entries: 20, dropRate: '5%', color: STATUS_WARNING },
] as const;

const DROP_PIPELINE = ['EnemyDeath', 'LootTable', 'WeightedRoll', 'WorldItem', 'Pickup'] as const;

const LOOT_FEATURES = [
  'UARPGLootTable', 'Weighted random selection', 'AARPGWorldItem',
  'Loot drop on death', 'Item pickup', 'Loot visual feedback', 'Chest/container actors',
];

/* ── Micro density ──────────────────────────────────────────────────────── */

function LootMicro() {
  return (
    <div className={DZIN_SPACING.micro.wrapper}>
      <Coins className="w-5 h-5" style={{ color: ACCENT }} />
      <span className="font-mono text-xs">{LOOT_TABLES.length} tables</span>
    </div>
  );
}

/* ── Compact density ────────────────────────────────────────────────────── */

function LootCompact() {
  return (
    <div className={`${DZIN_SPACING.compact.wrapper} text-xs`}>
      {LOOT_TABLES.map((lt) => (
        <div key={lt.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: lt.color }} />
          <span className="font-mono text-text flex-1 truncate">{lt.name}</span>
          <span className="text-text-muted">{lt.dropRate}</span>
        </div>
      ))}
      <div className={`border-t border-border/40 ${DZIN_SPACING.compact.divider} text-text-muted`}>
        {LOOT_TABLES.reduce((s, t) => s + t.entries, 0)} entries total
      </div>
    </div>
  );
}

/* ── Full density ───────────────────────────────────────────────────────── */

function LootFull({ featureMap, defs }: LootTablePanelProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const onToggle = (name: string) => setExpanded((prev) => (prev === name ? null : name));

  return (
    <div className={DZIN_SPACING.full.wrapper}>
      {/* Description */}
      <SurfaceCard level={3} className={`${DZIN_SPACING.full.card} bg-surface-deep/50 border-border/40 text-sm text-text-muted leading-relaxed`}>
        Loot table system using <span className="font-mono text-xs text-text">UARPGLootTable</span> data assets
        with weighted random selection, rarity ranges, and world item spawning on enemy death.
      </SurfaceCard>

      {/* Loot Table Cards */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={Coins} label="Loot Tables" color={ACCENT} />
        <div className={`grid grid-cols-2 ${DZIN_SPACING.full.gridGap} mt-2`}>
          {LOOT_TABLES.map((lt, i) => (
            <motion.div
              key={lt.name}
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.08 }}
              className="bg-surface-deep border rounded-xl p-3 relative overflow-hidden group"
              style={{ borderColor: `${lt.color}40` }}
            >
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ background: `radial-gradient(ellipse at 50% 50%, ${lt.color}10, transparent 70%)` }}
              />
              <div className="text-xs font-mono font-bold mb-1" style={{ color: lt.color }}>{lt.name}</div>
              <div className="flex justify-between text-2xs text-text-muted">
                <span>{lt.entries} entries</span>
                <span>Drop: {lt.dropRate}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </SurfaceCard>

      {/* Feature cards */}
      {LOOT_FEATURES.map((name) => (
        <FeatureCard key={name} name={name} featureMap={featureMap} defs={defs} expanded={expanded} onToggle={onToggle} accent={ACCENT} />
      ))}

      {/* Drop Pipeline */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel label="Drop Pipeline" />
        <div className={DZIN_SPACING.full.pipelineMt}>
          <PipelineFlow steps={[...DROP_PIPELINE]} accent={ACCENT} />
        </div>
      </SurfaceCard>
    </div>
  );
}

/* ── Main ───────────────────────────────────────────────────────────────── */

export function LootTablePanel({ featureMap, defs }: LootTablePanelProps) {
  const density = useDensity();

  return (
    <PanelFrame title="Loot Tables" icon={<Coins className="w-4 h-4" />}>
      <AnimatePresence mode="wait">
        <motion.div
          key={density}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: TRANSITION_EXIT }}
          transition={TRANSITION_ENTER}
        >
          {density === 'micro' && <LootMicro />}
          {density === 'compact' && <LootCompact />}
          {density === 'full' && <LootFull featureMap={featureMap} defs={defs} />}
        </motion.div>
      </AnimatePresence>
    </PanelFrame>
  );
}
