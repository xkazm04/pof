'use client';

import { BarChart3, PieChart, AlertTriangle } from 'lucide-react';
import {
  ACCENT_CYAN, ACCENT_EMERALD, ACCENT_ORANGE, ACCENT_VIOLET,
  STATUS_SUCCESS, STATUS_WARNING, OPACITY_10,
} from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader, NeonBar } from '../_design';
import type { ItemEconomyConfig, ItemEconomyResult } from '@/lib/economy/item-economy-engine';
import { ACCENT, STAT_LABELS } from './constants';
import { AffixHeatmap } from './AffixHeatmap';
import { AlertCard } from './AlertCard';

/* ── Affix Saturation Tab ─────────────────────────────────────────────── */

export function AffixTab({ result }: { result: ItemEconomyResult }) {
  return (
    <div className="space-y-3">
      <BlueprintPanel color={ACCENT} className="p-3 space-y-3">
        <SectionHeader icon={BarChart3} label="Affix Saturation Heatmap" color={ACCENT} />
        <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted">
          How affix distribution shifts per level. Brighter = higher prevalence.
        </p>
        <AffixHeatmap brackets={result.brackets} />
      </BlueprintPanel>

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
    </div>
  );
}

/* ── Balance Alerts Tab ───────────────────────────────────────────────── */

export function AlertsTab({ result, config }: {
  result: ItemEconomyResult; config: ItemEconomyConfig;
}) {
  return (
    <div className="space-y-3">
      <BlueprintPanel color={STATUS_WARNING} className="p-3 space-y-3">
        <div className="flex items-center justify-between">
          <SectionHeader icon={AlertTriangle} label="Balance Alerts" color={STATUS_WARNING} />
          <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted">
            {result.alerts.length} alert{result.alerts.length !== 1 ? 's' : ''} detected
          </span>
        </div>
        {result.alerts.length === 0 ? (
          <div className="text-center py-6">
            <span
              className="text-[10px] font-mono uppercase tracking-[0.15em]"
              style={{ color: STATUS_SUCCESS }}
            >
              No balance issues detected
            </span>
          </div>
        ) : (
          <div className="space-y-1.5">
            {result.alerts
              .sort((a, b) => {
                const order: Record<string, number> = { critical: 0, warning: 1, info: 2 };
                return (order[a.severity] ?? 2) - (order[b.severity] ?? 2);
              })
              .map((alert, i) => (
                <AlertCard key={`${alert.type}-${alert.level}-${i}`} alert={alert} />
              ))}
          </div>
        )}
      </BlueprintPanel>

      <BlueprintPanel color={ACCENT} className="p-2 space-y-1.5">
        <span className="text-[10px] font-mono font-bold uppercase tracking-[0.15em] text-text-muted">
          Simulation Pipeline
        </span>
        {[
          { step: '1. Agent Init', desc: `${config.playerCount} players, Lv1, 50g`, color: ACCENT },
          { step: '2. Hourly Ticks', desc: `${config.maxHours} hours of play`, color: ACCENT_EMERALD },
          { step: '3. Gold Flow', desc: 'Faucets (kills, quests) - Sinks (pots, repairs)', color: ACCENT_ORANGE },
          { step: '4. Item Drops', desc: `${config.dropsPerHour}/hr, UE5 rarity-gated rolling`, color: ACCENT_CYAN },
          { step: '5. Affix Rolling', desc: 'Weighted selection, magnitude * (1+0.1*level)', color: ACCENT_VIOLET },
          { step: '6. Equip Logic', desc: 'Replace if new totalPower > equipped', color: STATUS_SUCCESS },
          { step: '7. Alert Detection', desc: 'Power plateaus, rarity inflation, saturation', color: STATUS_WARNING },
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
    </div>
  );
}
