'use client';

import { motion } from 'framer-motion';
import { TrendingUp, Zap, BarChart3, Dna } from 'lucide-react';
import {
  ACCENT_ORANGE, STATUS_SUCCESS, STATUS_WARNING, OPACITY_10, OPACITY_20,
  withOpacity, OPACITY_25,
} from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader, GlowStat, NeonBar } from '@/components/modules/core-engine/unique-tabs/_design';
import type { ItemGenome } from '@/types/item-genome';
import { AXIS_CONFIGS } from './data';

/* ── Evolution Tab ─────────────────────────────────────────────────────── */

interface EvolutionTabProps {
  selected: ItemGenome;
  doEvolve: () => void;
}

export function EvolutionTab({ selected, doEvolve }: EvolutionTabProps) {
  const tier = selected.evolution?.tier ?? 0;
  const xp = selected.evolution?.evolutionXP ?? 0;
  const thresholds = [100, 500, 2000];

  return (
    <div className="space-y-3">
      <BlueprintPanel color={STATUS_SUCCESS} className="p-3 space-y-3">
        <SectionHeader icon={TrendingUp} label="Item Evolution" color={STATUS_SUCCESS} />
        <p className="text-xs text-text-muted leading-relaxed">
          Items used in combat accumulate evolution XP. At certain thresholds, they tier up --
          strengthening their dominant trait weights. Tier 0 &rarr; 1 &rarr; 2 &rarr; 3.
        </p>
        <div className="grid grid-cols-4 gap-2">
          <GlowStat label="Tier" value={tier} color={STATUS_SUCCESS} delay={0} />
          <GlowStat label="XP" value={xp} color={selected.color} delay={0.05} />
          <GlowStat label="Uses" value={selected.evolution?.usageCount ?? 0} color={selected.color} delay={0.1} />
          <GlowStat
            label="Next"
            value={tier >= 3 ? 'MAX' : `${thresholds[tier] - xp}`}
            color={STATUS_WARNING}
            delay={0.15}
          />
        </div>
        {/* XP progress bar */}
        {tier >= 3 ? (
          <div className="text-xs font-mono uppercase tracking-[0.15em] text-center" style={{ color: STATUS_SUCCESS }}>
            Maximum evolution reached
          </div>
        ) : (
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-mono uppercase tracking-[0.15em] text-text-muted">
              <span>Tier {tier}</span>
              <span>{xp} / {thresholds[tier]} XP</span>
              <span>Tier {tier + 1}</span>
            </div>
            <NeonBar pct={(xp / thresholds[tier]) * 100} color={STATUS_SUCCESS} height={8} glow />
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
          {[
            { tier: 1, xp: 100, label: 'Awakened', bonus: '+5% dominant weight', color: STATUS_WARNING },
            { tier: 2, xp: 500, label: 'Empowered', bonus: '+10% dominant weight', color: ACCENT_ORANGE },
            { tier: 3, xp: 2000, label: 'Ascended', bonus: '+15% dominant weight', color: STATUS_SUCCESS },
          ].map((t) => {
            const currentTier = selected.evolution?.tier ?? 0;
            const reached = currentTier >= t.tier;
            return (
              <motion.div
                key={t.tier}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: t.tier * 0.1 }}
                className="flex items-center gap-2 text-xs font-mono px-2 py-1.5 rounded-md"
                style={{
                  backgroundColor: reached ? `${t.color}${OPACITY_10}` : 'transparent',
                  border: `1px solid ${reached ? withOpacity(t.color, OPACITY_25) : 'var(--border)'}`,
                  opacity: reached ? 1 : 0.5,
                }}
              >
                <span className="font-bold" style={{ color: reached ? t.color : 'var(--text-muted)' }}>
                  T{t.tier}
                </span>
                <span className="font-bold text-text">{t.label}</span>
                <span className="ml-auto text-text-muted">{t.xp} XP</span>
                <span style={{ color: t.color }}>{t.bonus}</span>
              </motion.div>
            );
          })}
        </BlueprintPanel>
      </div>
    </div>
  );
}
