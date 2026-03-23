'use client';

import { useMemo } from 'react';
import {
  BarChart3, Target, Shield, Swords, Heart,
  Crosshair, Activity, TrendingUp,
} from 'lucide-react';
import {
  STATUS_SUCCESS, STATUS_ERROR, STATUS_WARNING,
  ACCENT_CYAN, ACCENT_ORANGE, ACCENT_EMERALD, ACCENT_VIOLET,
  MODULE_COLORS, OPACITY_15,
} from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader, GlowStat } from '../_design';
import { HistogramChart } from './HistogramChart';
import { buildHistogram } from './simulation';
import type { SimResults, SimScenario } from './data';
import { ACCENT } from './data';

/** Stat badge with icon */
function StatBadge({ label, value, color, unit, icon: Icon }: {
  label: string; value: string | number; color: string; unit?: string; icon?: typeof Heart;
}) {
  return (
    <div className="flex flex-col items-center px-2 py-1.5 rounded-md" style={{ backgroundColor: `${color}${OPACITY_15}` }}>
      <div className="flex items-center gap-1">
        {Icon && <Icon className="w-3 h-3" style={{ color }} />}
        <span className="text-xs font-bold font-mono" style={{ color }}>{value}{unit ?? ''}</span>
      </div>
      <span className="text-2xs text-text-muted mt-0.5">{label}</span>
    </div>
  );
}

export function ResultsSummary({ results, scenario }: { results: SimResults; scenario: SimScenario }) {
  const ttkHist = useMemo(() => buildHistogram(results.iterations.map(it => it.ttk), 25), [results.iterations]);
  const dpsHist = useMemo(() => buildHistogram(results.iterations.map(it => it.ttk > 0 ? it.totalDamage / it.ttk : 0), 25), [results.iterations]);

  const maxBin = Math.max(...ttkHist.bins.map(b => b.count), 1);
  const maxDpsBin = Math.max(...dpsHist.bins.map(b => b.count), 1);

  const armorBreakpoints = useMemo(() => {
    const points: { armor: number; mitigation: number; ehp: number }[] = [];
    for (let a = 0; a <= 200; a += 10) {
      const mit = a / (a + 100);
      points.push({ armor: a, mitigation: mit, ehp: scenario.player.maxHealth / (1 - mit) });
    }
    return points;
  }, [scenario.player.maxHealth]);

  const playerArmor = scenario.player.armor;
  const playerMit = playerArmor / (playerArmor + 100);
  const threshold50Armor = 100;

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <BlueprintPanel color={ACCENT} className="p-3">
        <SectionHeader icon={BarChart3} label="Simulation Summary" color={ACCENT} />
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-2">
          <StatBadge label="Mean TTK" value={results.ttkStats.mean.toFixed(1)} unit="s" color={ACCENT_CYAN} icon={Target} />
          <StatBadge label="Mean DPS" value={results.dpsStats.mean.toFixed(0)} color={ACCENT_ORANGE} icon={Swords} />
          <StatBadge label="Crit Rate" value={`${(results.critRate * 100).toFixed(1)}%`} color={STATUS_WARNING} icon={Crosshair} />
          <StatBadge label="Survival" value={`${(results.survivalRate * 100).toFixed(0)}%`} color={results.survivalRate > 0.5 ? STATUS_SUCCESS : STATUS_ERROR} icon={Heart} />
          <StatBadge label="EHP" value={results.effectiveHp.toFixed(0)} color={ACCENT_EMERALD} icon={Shield} />
          <StatBadge label="Armor Mit." value={`${(results.armorMitigation * 100).toFixed(1)}%`} color={MODULE_COLORS.core} icon={Shield} />
        </div>
      </BlueprintPanel>

      {/* TTK Distribution */}
      <BlueprintPanel color={ACCENT_CYAN} className="p-3">
        <SectionHeader icon={Activity} label="TTK Distribution (Time-to-Kill)" color={ACCENT_CYAN} />
        <p className="text-2xs text-text-muted mt-0.5 mb-2">
          {results.iterations.length.toLocaleString()} iterations — Median: {results.ttkStats.median.toFixed(2)}s, P10: {results.ttkStats.p10.toFixed(2)}s, P90: {results.ttkStats.p90.toFixed(2)}s
        </p>
        <HistogramChart bins={ttkHist.bins} maxCount={maxBin} color={ACCENT_CYAN}
          formatRange={b => `${b.low.toFixed(1)}\u2013${b.high.toFixed(1)}s`} barHeight={80} />
        <div className="flex justify-between mt-1">
          <span className="text-2xs text-text-muted">{ttkHist.min.toFixed(1)}s</span>
          <span className="text-2xs text-text-muted">{ttkHist.max.toFixed(1)}s</span>
        </div>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {[
            { label: 'Min', value: results.ttkStats.min, color: STATUS_SUCCESS },
            { label: 'P10', value: results.ttkStats.p10, color: ACCENT_EMERALD },
            { label: 'Median', value: results.ttkStats.median, color: ACCENT_CYAN },
            { label: 'P90', value: results.ttkStats.p90, color: STATUS_WARNING },
            { label: 'Max', value: results.ttkStats.max, color: STATUS_ERROR },
          ].map(m => (
            <span key={m.label} className="text-2xs px-1.5 py-0.5 rounded" style={{ backgroundColor: `${m.color}${OPACITY_15}`, color: m.color }}>
              {m.label}: {m.value.toFixed(2)}s
            </span>
          ))}
          <span className="text-2xs px-1.5 py-0.5 rounded" style={{ backgroundColor: `${ACCENT_VIOLET}${OPACITY_15}`, color: ACCENT_VIOLET }}>
            StdDev: {results.ttkStats.stdDev.toFixed(2)}s
          </span>
        </div>
      </BlueprintPanel>

      {/* DPS Distribution */}
      <BlueprintPanel color={ACCENT_ORANGE} className="p-3">
        <SectionHeader icon={TrendingUp} label="DPS Distribution" color={ACCENT_ORANGE} />
        <p className="text-2xs text-text-muted mt-0.5 mb-2">
          Mean: {results.dpsStats.mean.toFixed(0)}, Median: {results.dpsStats.median.toFixed(0)}, Range: {results.dpsStats.min.toFixed(0)}\u2013{results.dpsStats.max.toFixed(0)}
        </p>
        <HistogramChart bins={dpsHist.bins} maxCount={maxDpsBin} color={ACCENT_ORANGE}
          formatRange={b => `${b.low.toFixed(0)}\u2013${b.high.toFixed(0)} DPS`} barHeight={64} />
        <div className="flex justify-between mt-1">
          <span className="text-2xs text-text-muted">{dpsHist.min.toFixed(0)}</span>
          <span className="text-2xs text-text-muted">{dpsHist.max.toFixed(0)}</span>
        </div>
      </BlueprintPanel>

      {/* Armor Breakpoints */}
      <BlueprintPanel color={MODULE_COLORS.core} className="p-3">
        <SectionHeader icon={Shield} label="Armor Breakpoint Analysis" color={MODULE_COLORS.core} />
        <p className="text-2xs text-text-muted mt-0.5 mb-2">
          Formula: mitigation = armor / (armor + 100). Shows diminishing returns on damage reduction.
        </p>
        <div className="overflow-x-auto">
          <div className="relative flex items-end gap-0.5 min-w-[400px]">
            {armorBreakpoints.map(bp => {
              const hPct = bp.mitigation * 100;
              const isCurrent = bp.armor === Math.round(playerArmor / 10) * 10;
              const is50 = bp.armor === threshold50Armor;
              return (
                <div key={bp.armor} className="flex flex-col items-center flex-1 min-w-[16px] relative"
                  title={`${bp.armor} Armor \u2192 ${(bp.mitigation * 100).toFixed(1)}% mitigation, ${bp.ehp.toFixed(0)} EHP`}>
                  <div className="w-full h-12 flex items-end relative">
                    <div className="w-full rounded-t-sm" style={{
                      backgroundColor: isCurrent ? STATUS_SUCCESS : is50 ? STATUS_WARNING : MODULE_COLORS.core,
                      height: `${hPct}%`,
                      opacity: isCurrent ? 1 : is50 ? 0.85 : 0.5 + bp.mitigation * 0.5,
                    }} />
                  </div>
                  {bp.armor % 40 === 0 && <span className="text-2xs text-text-muted mt-0.5">{bp.armor}</span>}
                </div>
              );
            })}
            {/* Current armor marker */}
            <div className="absolute bottom-0 pointer-events-none" style={{ left: `${(Math.min(playerArmor, 200) / 200) * 100}%`, height: '100%' }}>
              <div className="absolute bottom-0 w-px h-full" style={{ backgroundColor: STATUS_SUCCESS }} />
              <div className="absolute -top-5 -translate-x-1/2 whitespace-nowrap text-2xs font-mono font-bold px-1 rounded"
                style={{ color: STATUS_SUCCESS, backgroundColor: `${STATUS_SUCCESS}15` }}>
                {playerArmor} \u2192 {(playerMit * 100).toFixed(1)}%
              </div>
            </div>
            {/* 50% threshold marker */}
            <div className="absolute bottom-0 pointer-events-none" style={{ left: `${(threshold50Armor / 200) * 100}%`, height: '100%' }}>
              <div className="absolute bottom-0 w-px h-full opacity-70" style={{ backgroundColor: STATUS_WARNING, borderLeft: `1px dashed ${STATUS_WARNING}` }} />
              <div className="absolute -top-5 -translate-x-1/2 whitespace-nowrap text-2xs font-mono px-1 rounded"
                style={{ color: STATUS_WARNING, backgroundColor: `${STATUS_WARNING}15` }}>
                50% @{threshold50Armor}
              </div>
            </div>
          </div>
        </div>
        {/* Key breakpoints */}
        <div className="grid grid-cols-5 gap-2 mt-2">
          <div className="text-center">
            <div className="text-2xs font-mono font-bold" style={{ color: STATUS_SUCCESS }}>You: {playerArmor}</div>
            <div className="text-xs font-bold text-text">{(playerMit * 100).toFixed(1)}%</div>
            <div className="text-2xs text-text-muted">current</div>
          </div>
          {[25, 50, 100, 200].map(a => {
            const mit = a / (a + 100);
            const is50 = a === threshold50Armor;
            return (
              <div key={a} className="text-center">
                <div className="text-2xs font-mono" style={{ color: is50 ? STATUS_WARNING : MODULE_COLORS.core }}>{a} Armor</div>
                <div className="text-xs font-bold text-text">{(mit * 100).toFixed(1)}%</div>
                <div className="text-2xs text-text-muted">{is50 ? '50% threshold' : 'mitigation'}</div>
              </div>
            );
          })}
        </div>
      </BlueprintPanel>
    </div>
  );
}
