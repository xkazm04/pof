'use client';

import { type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { BarChart3, PieChart, AlertTriangle } from 'lucide-react';
import {
  ACCENT_CYAN, ACCENT_EMERALD, ACCENT_ORANGE, ACCENT_VIOLET,
  STATUS_SUCCESS, STATUS_WARNING, OPACITY_10,
} from '@/lib/chart-colors';
import { motionSafe, EASE_OUT, STAGGER } from '@/lib/motion';
import { BlueprintPanel, SectionHeader, NeonBar } from '../../unique-tabs/_design';
import type { ItemEconomyConfig, ItemEconomyResult } from '@/lib/economy/item-economy-engine';
import type { EconomyVerdict } from '@/lib/economy/item-economy-verdicts';
import { ACCENT, STAT_LABELS } from './constants';
import { AffixHeatmap } from './AffixHeatmap';
import { AlertCard } from './AlertCard';

/* ── Stagger helper ─ shared chart entrance rhythm ─────────────────────── */

function StaggerItem({ index, children }: { index: number; children: ReactNode }) {
  const prefersReduced = useReducedMotion();
  return (
    <motion.div
      initial={prefersReduced ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={motionSafe(
        { duration: 0.22, ease: EASE_OUT, delay: index * STAGGER.fast },
        prefersReduced,
      )}
    >
      {children}
    </motion.div>
  );
}

/* ── Affix Saturation Tab ─────────────────────────────────────────────── */

export function AffixTab({ result }: { result: ItemEconomyResult }) {
  return (
    <div className="space-y-3">
      <StaggerItem index={0}>
        <BlueprintPanel color={ACCENT} className="p-3 space-y-3">
          <SectionHeader icon={BarChart3} label="Affix Saturation Heatmap" color={ACCENT} />
          <p className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">
            How affix distribution shifts per level. Brighter = higher prevalence.
          </p>
          <AffixHeatmap brackets={result.brackets} />
        </BlueprintPanel>
      </StaggerItem>

      <StaggerItem index={1}>
        <BlueprintPanel color={ACCENT_CYAN} className="p-3 space-y-3">
          <SectionHeader icon={PieChart} label="Global Affix Distribution" color={ACCENT_CYAN} />
          <div className="space-y-1">
            {Object.entries(result.globalAffixSaturation)
              .sort(([, a], [, b]) => b - a)
              .map(([stat, pct]) => {
                const isSaturated = pct > 0.15;
                return (
                  <div key={stat} className="flex items-center gap-2 text-xs font-mono">
                    <span
                      className="w-12 text-right font-bold"
                      style={{ color: isSaturated ? STATUS_WARNING : 'var(--text)' }}
                    >
                      {STAT_LABELS[stat] ?? stat}
                    </span>
                    <div className="flex-1">
                      <NeonBar
                        pct={pct * 100 * 5}
                        color={isSaturated ? STATUS_WARNING : ACCENT_CYAN}
                        height={6}
                      />
                    </div>
                    <span
                      className="w-12 text-right"
                      style={{ color: isSaturated ? STATUS_WARNING : 'var(--text-muted)' }}
                    >
                      {(pct * 100).toFixed(1)}%
                    </span>
                  </div>
                );
              })}
          </div>
        </BlueprintPanel>
      </StaggerItem>
    </div>
  );
}

/* ── Balance Verdicts Tab ─ five decay detectors, unmeasured never green ── */

const STATE_ORDER: Record<EconomyVerdict['state'], number> = { critical: 0, warn: 1, unmeasured: 2, pass: 3 };

export function AlertsTab({ verdicts, config }: {
  verdicts: EconomyVerdict[]; config: ItemEconomyConfig;
}) {
  const findings = verdicts.filter((v) => v.state === 'warn' || v.state === 'critical').length;
  const unmeasured = verdicts.filter((v) => v.state === 'unmeasured').length;
  return (
    <div className="space-y-3">
      <StaggerItem index={0}>
        <BlueprintPanel color={STATUS_WARNING} className="p-3 space-y-3">
          <div className="flex items-center justify-between">
            <SectionHeader icon={AlertTriangle} label="Balance Verdicts" color={STATUS_WARNING} />
            <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">
              {findings} finding{findings !== 1 ? 's' : ''} &middot; {unmeasured} unmeasured
            </span>
          </div>
          <div className="space-y-1.5">
            {[...verdicts]
              .sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state])
              .map((v) => <AlertCard key={v.family} verdict={v} />)}
          </div>
        </BlueprintPanel>
      </StaggerItem>

      <StaggerItem index={1}>
        <BlueprintPanel color={ACCENT} className="p-2 space-y-1.5">
          <span className="text-xs font-mono font-bold uppercase tracking-[0.15em] text-text-muted">
            Simulation Pipeline
          </span>
          {[
            { step: '1. Agent Init', desc: `${config.playerCount} players, Lv1, 50g`, color: ACCENT },
            { step: '2. Hourly Ticks', desc: `${config.maxHours} hours of play`, color: ACCENT_EMERALD },
            { step: '3. Gold Flow', desc: 'Faucets (kills, quests) - Sinks (pots, repairs)', color: ACCENT_ORANGE },
            { step: '4. Item Drops', desc: `${config.dropsPerHour}/hr, UE5 rarity-gated rolling`, color: ACCENT_CYAN },
            { step: '5. Affix Rolling', desc: 'Weighted selection, magnitude * (1+0.1*level)', color: ACCENT_VIOLET },
            { step: '6. Equip Logic', desc: 'Replace if new totalPower > equipped', color: STATUS_SUCCESS },
            { step: '7. Verdicts', desc: 'Five decay detectors; unsampled endgame = unmeasured', color: STATUS_WARNING },
          ].map((s, i) => (
            <div
              key={i}
              className="flex items-center gap-2 text-xs font-mono px-2 py-0.5 rounded"
              style={{ backgroundColor: `${s.color}${OPACITY_10}` }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.color }} />
              <span className="font-bold" style={{ color: s.color }}>{s.step}</span>
              <span className="text-text-muted ml-auto">{s.desc}</span>
            </div>
          ))}
        </BlueprintPanel>
      </StaggerItem>
    </div>
  );
}
