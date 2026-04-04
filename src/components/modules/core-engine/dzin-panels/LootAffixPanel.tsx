'use client';

import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useDensity, PanelFrame } from '@/lib/dzin/core';
import { DZIN_SPACING, TRANSITION_ENTER, TRANSITION_EXIT } from '@/lib/dzin/animation-constants';
import {
  FeatureCard,
  SectionLabel,
} from '@/components/modules/core-engine/unique-tabs/_shared';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { ACCENT_ORANGE, AFFIX_CATEGORY_COLORS } from '@/lib/chart-colors';
import type { FeatureRow } from '@/types/feature-matrix';

/* ── Props ──────────────────────────────────────────────────────────────── */

export interface LootAffixPanelProps {
  featureMap: Map<string, FeatureRow>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
}

/* ── Constants ──────────────────────────────────────────────────────────── */

const ACCENT = ACCENT_ORANGE;

const AFFIX_CATEGORIES = [
  { name: 'Offensive', count: 12, category: 'offensive' as const, examples: '+Damage, +CritChance, +AttackSpeed' },
  { name: 'Defensive', count: 8, category: 'defensive' as const, examples: '+Armor, +MaxHP, +BlockChance' },
  { name: 'Utility', count: 6, category: 'utility' as const, examples: '+MoveSpeed, +CooldownRedux, +XPBonus' },
] as const;

const ROLLING_TIERS = [
  { rarity: 'Common', prefixes: 0, suffixes: 0 },
  { rarity: 'Uncommon', prefixes: 1, suffixes: 0 },
  { rarity: 'Rare', prefixes: 1, suffixes: 1 },
  { rarity: 'Epic', prefixes: 2, suffixes: 1 },
  { rarity: 'Legendary', prefixes: 2, suffixes: 2 },
] as const;

const AFFIX_FEATURES = ['Affix system', 'UARPGItemInstance', 'UARPGItemDefinition'];

/* ── Micro density ──────────────────────────────────────────────────────── */

function AffixMicro() {
  const total = AFFIX_CATEGORIES.reduce((s, c) => s + c.count, 0);
  return (
    <div className={DZIN_SPACING.micro.wrapper}>
      <Sparkles className="w-5 h-5" style={{ color: ACCENT }} />
      <span className="font-mono text-xs">{total} affixes</span>
    </div>
  );
}

/* ── Compact density ────────────────────────────────────────────────────── */

function AffixCompact() {
  return (
    <div className={`${DZIN_SPACING.compact.wrapper} text-xs`}>
      {AFFIX_CATEGORIES.map((cat) => (
        <div key={cat.name} className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: AFFIX_CATEGORY_COLORS[cat.category] }}
          />
          <span className="text-text font-medium flex-1">{cat.name}</span>
          <span className="font-mono text-text-muted">{cat.count}</span>
        </div>
      ))}
      <div className={`border-t border-border/40 ${DZIN_SPACING.compact.divider} text-text-muted`}>
        5 rarity tiers
      </div>
    </div>
  );
}

/* ── Full density ───────────────────────────────────────────────────────── */

function AffixFull({ featureMap, defs }: LootAffixPanelProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const onToggle = (name: string) => setExpanded((prev) => (prev === name ? null : name));

  return (
    <div className={DZIN_SPACING.full.wrapper}>
      {/* Description */}
      <SurfaceCard level={3} className={`${DZIN_SPACING.full.card} bg-surface-deep/50 border-border/40 text-sm text-text-muted leading-relaxed`}>
        Affix crafting system with prefix/suffix slots per rarity tier, weighted pool selection,
        and category-based power budgets (offensive/defensive/utility).
      </SurfaceCard>

      {/* Affix Categories */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={Sparkles} label="Affix Categories" color={ACCENT} />
        <div className="space-y-2 mt-2">
          {AFFIX_CATEGORIES.map((cat, i) => (
            <motion.div
              key={cat.name}
              initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
              className="bg-surface-deep border rounded-lg p-2.5"
              style={{ borderColor: `${AFFIX_CATEGORY_COLORS[cat.category]}40` }}
            >
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: AFFIX_CATEGORY_COLORS[cat.category], boxShadow: `0 0 6px ${AFFIX_CATEGORY_COLORS[cat.category]}40` }}
                />
                <span className="text-xs font-mono font-bold" style={{ color: AFFIX_CATEGORY_COLORS[cat.category] }}>{cat.name}</span>
                <span className="ml-auto text-xs font-mono text-text-muted">{cat.count} affixes</span>
              </div>
              <div className="text-2xs text-text-muted pl-5">{cat.examples}</div>
            </motion.div>
          ))}
        </div>
      </SurfaceCard>

      {/* Rolling Tiers */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <div className="text-xs font-bold uppercase text-text-muted mb-2">Rolling Tiers by Rarity</div>
        <div className="space-y-1.5">
          {ROLLING_TIERS.map((tier) => (
            <div key={tier.rarity} className="flex items-center gap-2 text-xs">
              <span className="w-20 font-mono text-text-muted">{tier.rarity}</span>
              <div className="flex gap-1 flex-1">
                {Array.from({ length: tier.prefixes }).map((_, i) => (
                  <span key={`p${i}`} className="px-1.5 py-0.5 rounded text-2xs font-mono bg-surface-deep border border-border/40" style={{ color: ACCENT }}>P</span>
                ))}
                {Array.from({ length: tier.suffixes }).map((_, i) => (
                  <span key={`s${i}`} className="px-1.5 py-0.5 rounded text-2xs font-mono bg-surface-deep border border-border/40 text-text-muted">S</span>
                ))}
                {tier.prefixes === 0 && tier.suffixes === 0 && (
                  <span className="text-2xs text-text-muted italic">no affixes</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </SurfaceCard>

      {/* Feature cards */}
      {AFFIX_FEATURES.map((name) => (
        <FeatureCard key={name} name={name} featureMap={featureMap} defs={defs} expanded={expanded} onToggle={onToggle} accent={ACCENT} />
      ))}
    </div>
  );
}

/* ── Main ───────────────────────────────────────────────────────────────── */

export function LootAffixPanel({ featureMap, defs }: LootAffixPanelProps) {
  const density = useDensity();

  return (
    <PanelFrame title="Affix Crafting" icon={<Sparkles className="w-4 h-4" />}>
      <AnimatePresence mode="wait">
        <motion.div
          key={density}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: TRANSITION_EXIT }}
          transition={TRANSITION_ENTER}
        >
          {density === 'micro' && <AffixMicro />}
          {density === 'compact' && <AffixCompact />}
          {density === 'full' && <AffixFull featureMap={featureMap} defs={defs} />}
        </motion.div>
      </AnimatePresence>
    </PanelFrame>
  );
}
