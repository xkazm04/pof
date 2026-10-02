'use client';

import { motion } from 'framer-motion';
import { TrendingUp, Zap, BarChart3, Dna } from 'lucide-react';
import {
  ACCENT_ORANGE, STATUS_SUCCESS, STATUS_WARNING, OPACITY_10, OPACITY_20,
  withOpacity, OPACITY_25,
} from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader, GlowStat, NeonBar } from '@/components/modules/core-engine/unique-tabs/_design';
import type { ItemGenome } from '@/types/item-genome';
import { EVOLUTION_TIERS, MAX_EVOLUTION_TIER, nextTierXP, tierBonus } from '@/lib/item-dna/rules';
import { AXIS_CONFIGS } from './data';

/** Presentation only: one accent per tier row, indexed by tier - 1. */
const TIER_COLORS = [STATUS_WARNING, ACCENT_ORANGE, STATUS_SUCCESS];

/* ── Evolution Tab ─────────────────────────────────────────────────────── */

interface EvolutionTabProps {
  selected: ItemGenome;
  doEvolve: () => void;
}

export function EvolutionTab({ selected, doEvolve }: EvolutionTabProps) {
  const tier = selected.evolution?.tier ?? 0;
  const xp = selected.evolution?.evolutionXP ?? 0;
  const nextXP = nextTierXP(tier);
  const maxed = tier >= MAX_EVOLUTION_TIER || nextXP === undefined;

  return (
    <div className="space-y-3">
      <BlueprintPanel color={STATUS_SUCCESS} className="p-3 space-y-3">
        <SectionHeader icon={TrendingUp} label="Item Evolution" color={STATUS_SUCCESS} />
        <p className="text-xs text-text-muted leading-relaxed">
          Items used in combat accumulate evolution XP. At certain thresholds, they tier up --
          strengthening their dominant (highest-weight) trait. Tier 0 &rarr; {EVOLUTION_TIERS.map((t) => t.tier).join(' → ')}.
        </p>
        <div className="grid grid-cols-4 gap-2">
          <GlowStat label="Tier" value={tier} color={STATUS_SUCCESS} delay={0} />
          <GlowStat label="XP" value={xp} color={selected.color} delay={0.05} />
          <GlowStat label="Uses" value={selected.evolution?.usageCount ?? 0} color={selected.color} delay={0.1} />
          <GlowStat
            label="Next"
            value={maxed ? 'MAX' : `${Math.max(0, nextXP - xp)}`}
            color={STATUS_WARNING}
            delay={0.15}
          />
        </div>
        {/* XP progress bar */}
        {maxed ? (
          <div className="text-xs font-mono uppercase tracking-[0.15em] text-center" style={{ color: STATUS_SUCCESS }}>
            Maximum evolution reached
          </div>
        ) : (
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-mono uppercase tracking-[0.15em] text-text-muted">
              <span>Tier {tier}</span>
              <span>{xp} / {nextXP} XP</span>
              <span>Tier {tier + 1}</span>
            </div>
            <NeonBar pct={Math.min(100, (xp / nextXP) * 100)} color={STATUS_SUCCESS} height={8} glow />
          </div>
        )}
        <button
          onClick={doEvolve}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all hover:scale-105"
          style={{ backgroundColor: `${STATUS_SUCCESS}${OPACITY_20}`, color: STATUS_SUCCESS, border: `1px solid ${withOpacity(STATUS_SUCCESS, OPACITY_25)}` }}
        >
          <Zap className="w-3.5 h-3.5" /> Simulate Combat Usage (+50-150 XP)
        </button>
      </BlueprintPanel>

      {/* Evolution trait comparison */}
      <div className="grid grid-cols-2 gap-3">
        <BlueprintPanel color={selected.color} className="p-3 space-y-3">
          <SectionHeader icon={BarChart3} label="Current Traits" color={selected.color} />
          {selected.traits.map((gene) => {
            const cfg = AXIS_CONFIGS.find((c) => c.axis === gene.axis)!;
            const Icon = cfg.icon;
            return (
              <div key={gene.axis} className="flex items-center gap-2 text-xs font-mono">
                <Icon className="w-3 h-3" style={{ color: cfg.color }} />
                <span className="text-xs font-mono uppercase tracking-[0.15em] w-16 font-bold" style={{ color: cfg.color }}>{cfg.label}</span>
                <div className="flex-1">
                  <NeonBar pct={gene.weight * 100} color={cfg.color} />
                </div>
                <span className="w-10 text-right font-bold">{(gene.weight * 100).toFixed(0)}%</span>
              </div>
            );
          })}
        </BlueprintPanel>
        <BlueprintPanel color={STATUS_SUCCESS} className="p-3 space-y-3">
          <SectionHeader icon={Dna} label="Evolution Thresholds" color={STATUS_SUCCESS} />
          {EVOLUTION_TIERS.map((t) => {
            const reached = tier >= t.tier;
            const color = TIER_COLORS[t.tier - 1] ?? STATUS_SUCCESS;
            // Cumulative: the exact bonus evolveGenome has applied once this tier is held.
            const bonus = `+${Math.round(tierBonus(t.tier) * 100)}% dominant weight`;
            return (
              <motion.div
                key={t.tier}
                data-testid="evolution-tier-row"
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: t.tier * 0.1 }}
                className="flex items-center gap-2 text-xs font-mono px-2 py-1.5 rounded-md"
                style={{
                  backgroundColor: reached ? `${color}${OPACITY_10}` : 'transparent',
                  border: `1px solid ${reached ? withOpacity(color, OPACITY_25) : 'var(--border)'}`,
                  opacity: reached ? 1 : 0.5,
                }}
              >
                <span className="font-bold" style={{ color: reached ? color : 'var(--text-muted)' }}>
                  T{t.tier}
                </span>
                <span className="font-bold text-text">{t.label}</span>
                <span className="ml-auto text-text-muted" data-testid="evolution-tier-xp">{t.xp} XP</span>
                <span style={{ color }} data-testid="evolution-tier-bonus">{bonus}</span>
              </motion.div>
            );
          })}
        </BlueprintPanel>
      </div>
    </div>
  );
}
