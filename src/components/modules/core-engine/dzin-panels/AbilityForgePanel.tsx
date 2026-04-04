'use client';

import { Wand2, Tag, Flame } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useDensity, PanelFrame } from '@/lib/dzin/core';
import { DZIN_SPACING, TRANSITION_ENTER, TRANSITION_EXIT } from '@/lib/dzin/animation-constants';
import { SectionLabel } from '@/components/modules/core-engine/unique-tabs/_shared';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { MODULE_COLORS, OPACITY_15 } from '@/lib/chart-colors';

/* ── Props ──────────────────────────────────────────────────────────────── */

export interface AbilityForgePanelProps {
  featureMap: Map<string, unknown>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
}

/* ── Constants ──────────────────────────────────────────────────────────── */

const ACCENT = MODULE_COLORS.core;

const ABILITY_TEMPLATES = [
  { name: 'Fireball', tags: ['projectile', 'aoe', 'fire'], cost: 35, cooldown: 4.0 },
  { name: 'Shield Bash', tags: ['melee', 'stun', 'physical'], cost: 20, cooldown: 6.0 },
  { name: 'Chain Lightning', tags: ['projectile', 'chain', 'lightning'], cost: 50, cooldown: 8.0 },
  { name: 'Shadow Step', tags: ['movement', 'stealth', 'shadow'], cost: 15, cooldown: 3.0 },
  { name: 'Healing Surge', tags: ['support', 'heal', 'holy'], cost: 40, cooldown: 10.0 },
] as const;

const TAG_TAXONOMY = [
  { category: 'Delivery', tags: ['projectile', 'melee', 'aoe', 'chain', 'movement'] },
  { category: 'Element', tags: ['fire', 'lightning', 'shadow', 'holy', 'physical'] },
  { category: 'Effect', tags: ['stun', 'stealth', 'heal', 'support'] },
] as const;

const PIPELINE_STAGES = [
  { name: 'Text Parse', status: 'done' as const },
  { name: 'Tag Extraction', status: 'done' as const },
  { name: 'Cost Balancing', status: 'active' as const },
  { name: 'UE5 Blueprint Gen', status: 'pending' as const },
] as const;

function stageColor(status: string): string {
  if (status === 'done') return ACCENT;
  if (status === 'active') return MODULE_COLORS.content;
  return 'var(--text-muted)';
}

/* ── Micro density ──────────────────────────────────────────────────────── */

function ForgeMicro() {
  return (
    <div className={DZIN_SPACING.micro.wrapper}>
      <Wand2 className="w-5 h-5" style={{ color: ACCENT }} />
      <span className="font-mono text-xs">{ABILITY_TEMPLATES.length} abilities</span>
    </div>
  );
}

/* ── Compact density ────────────────────────────────────────────────────── */

function ForgeCompact() {
  return (
    <div className={`${DZIN_SPACING.compact.wrapper} text-xs`}>
      <div className="flex items-center justify-between text-text-muted mb-1">
        <span>Ability Templates</span>
        <span className="font-mono text-text">{ABILITY_TEMPLATES.length} total</span>
      </div>
      {ABILITY_TEMPLATES.map((a) => (
        <div key={a.name} className="flex items-center gap-2">
          <Wand2 className="w-3 h-3 flex-shrink-0" style={{ color: ACCENT }} />
          <span className="text-text-muted flex-1 truncate">{a.name}</span>
          <span className="font-mono text-text">{a.cost}mp {a.cooldown}s</span>
        </div>
      ))}
    </div>
  );
}

/* ── Full density ──────────────────────────────────────────────────────── */

function ForgeFull() {
  return (
    <div className={DZIN_SPACING.full.wrapper}>
      <SurfaceCard level={3} className={`${DZIN_SPACING.full.card} bg-surface-deep/50 border-border/40 text-sm text-text-muted leading-relaxed`}>
        AI-powered ability generation from text descriptions with automatic tag extraction and cost balancing.
      </SurfaceCard>

      {/* Ability Templates */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={Wand2} label="Ability Templates" color={ACCENT} />
        <div className="space-y-2 mt-2">
          {ABILITY_TEMPLATES.map((ability, i) => (
            <motion.div
              key={ability.name}
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="text-xs"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-text font-medium">{ability.name}</span>
                <span className="text-text-muted font-mono">{ability.cost}mp / {ability.cooldown}s cd</span>
              </div>
              <div className="flex gap-1 flex-wrap">
                {ability.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-1.5 py-0.5 rounded text-2xs"
                    style={{ backgroundColor: `${ACCENT}${OPACITY_15}`, color: ACCENT }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </SurfaceCard>

      {/* Generation Pipeline */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={Flame} label="Generation Pipeline" color={ACCENT} />
        <div className="space-y-1.5 mt-2">
          {PIPELINE_STAGES.map((stage, i) => (
            <motion.div
              key={stage.name}
              initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
              className="flex items-center gap-2 text-xs"
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: stageColor(stage.status) }}
              />
              <span className="text-text flex-1 truncate">{stage.name}</span>
              <span
                className="text-2xs px-1.5 py-0.5 rounded capitalize"
                style={{ backgroundColor: `${stageColor(stage.status)}${OPACITY_15}`, color: stageColor(stage.status) }}
              >
                {stage.status}
              </span>
            </motion.div>
          ))}
        </div>
      </SurfaceCard>

      {/* Tag Taxonomy */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={Tag} label="Tag Taxonomy" color={ACCENT} />
        <div className="space-y-2 mt-2">
          {TAG_TAXONOMY.map((group, i) => (
            <motion.div
              key={group.category}
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="text-xs"
            >
              <span className="text-text font-medium text-2xs uppercase tracking-wider">{group.category}</span>
              <div className="flex gap-1 flex-wrap mt-1">
                {group.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-1.5 py-0.5 rounded text-2xs text-text-muted"
                    style={{ backgroundColor: `${ACCENT}${OPACITY_15}` }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </SurfaceCard>
    </div>
  );
}

/* ── Main ──────────────────────────────────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function AbilityForgePanel({ featureMap, defs }: AbilityForgePanelProps) {
  const density = useDensity();

  return (
    <PanelFrame title="Ability Forge" icon={<Wand2 className="w-4 h-4" />}>
      <AnimatePresence mode="wait">
        <motion.div
          key={density}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: TRANSITION_EXIT }}
          transition={TRANSITION_ENTER}
        >
          {density === 'micro' && <ForgeMicro />}
          {density === 'compact' && <ForgeCompact />}
          {density === 'full' && <ForgeFull />}
        </motion.div>
      </AnimatePresence>
    </PanelFrame>
  );
}
