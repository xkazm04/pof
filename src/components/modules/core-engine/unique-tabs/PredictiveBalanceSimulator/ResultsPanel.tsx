'use client';

import {
  AlertTriangle, TrendingUp, Shield,
  Heart, Swords, Crosshair, Timer, Activity,
} from 'lucide-react';
import {
  ACCENT_CYAN, ACCENT_ORANGE, ACCENT_EMERALD, ACCENT_VIOLET,
  STATUS_ERROR, STATUS_WARNING, OPACITY_15,
} from '@/lib/chart-colors';
import {
  ACCENT, ENCOUNTER_COLORS, SENS_COLORS,
  survivalColor, type BalanceReport,
} from './data';
import { GlowStat } from './design';
import { Section } from './Section';
import { SurvivalHeatmap } from './SurvivalHeatmap';
import { SurvivalCurveChart } from './SurvivalCurveChart';
import { DPSBreakdownChart } from './DPSBreakdownChart';
import { SensitivityChart } from './SensitivityChart';
import { AlertBadges } from './AlertBadges';

export function ResultsPanel({ report, levels, enemyLabels }: {
  report: BalanceReport;
  levels: number[];
  enemyLabels: string[];
}) {
  const midLevel = Math.floor((levels[0] + levels[levels.length - 1]) / 2);
  const midCells = report.heatmap.filter(c => c.playerLevel === midLevel);
  const avg = (fn: (c: typeof midCells[0]) => number) =>
    midCells.length > 0 ? midCells.reduce((s, c) => s + fn(c), 0) / midCells.length : 0;

  const avgSurv = avg(c => c.survivalRate);
  const avgTTK = avg(c => c.avgTTK);
  const avgDPS = avg(c => c.avgDPS);
  const avgEHP = avg(c => c.avgEHP);

  const hasCritical = report.alerts.some(a => a.severity === 'critical');

  return (
    <div className="space-y-3">
      {/* Summary banner */}
      <div className="px-3 py-2 rounded-lg bg-surface-deep border border-border/30 text-xs font-mono text-text-muted">
        {report.summary}
        <span className="text-text-muted ml-2 opacity-60">({report.durationMs}ms)</span>
      </div>

      {/* Stat badges */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <GlowStat label="Survival" value={`${(avgSurv * 100).toFixed(0)}%`}
          color={survivalColor(avgSurv)} delay={0} />
        <GlowStat label="Avg TTK" value={avgTTK.toFixed(1)} unit="s"
          color={ACCENT_CYAN} delay={0.05} />
        <GlowStat label="Avg DPS" value={avgDPS.toFixed(1)}
          color={ACCENT_ORANGE} delay={0.1} />
        <GlowStat label="Avg EHP" value={avgEHP.toFixed(0)}
          color={ACCENT_EMERALD} delay={0.15} />
        <GlowStat label="Alerts" value={`${report.alerts.length}`}
          color={hasCritical ? STATUS_ERROR : STATUS_WARNING} delay={0.2} />
      </div>

      {/* Survival Heatmap */}
      <Section title="Survival Heatmap — Level x Encounter" icon={Crosshair}
        color={ACCENT} defaultOpen>
        <SurvivalHeatmap cells={report.heatmap} levels={levels} enemies={enemyLabels} />
      </Section>

      {/* Survival Curves */}
      <Section title="Survival Curves by Level" icon={TrendingUp}
        color={ACCENT_CYAN} defaultOpen>
        <div className="space-y-3">
          <SurvivalCurveChart curves={report.survivalCurves} width={480} height={180} />
          <div className="flex flex-wrap gap-3 text-xs font-mono">
            {Object.keys(report.survivalCurves).map((label, i) => (
              <span key={label} className="flex items-center gap-1">
                <span className="w-2 h-0.5 rounded"
                  style={{ backgroundColor: ENCOUNTER_COLORS[i % ENCOUNTER_COLORS.length] }} />
                <span className="text-text-muted">{label}</span>
              </span>
            ))}
          </div>
        </div>
      </Section>

      {/* DPS Breakdowns */}
      <Section title="DPS Breakdown by Ability" icon={Swords} color={ACCENT_ORANGE}>
        <DPSBreakdownChart breakdowns={report.dpsBreakdowns} />
      </Section>

      {/* Sensitivity Analysis */}
      <Section title="Sensitivity Analysis" icon={Activity} color={ACCENT_VIOLET}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {report.sensitivity.map(curve => {
            const color = SENS_COLORS[curve.attribute] ?? ACCENT;
            return (
              <div key={curve.attribute}>
                <div className="text-[10px] font-mono font-bold uppercase tracking-[0.15em] mb-1"
                  style={{ color }}>
                  {curve.attribute}
                </div>
                <SensitivityChart curve={curve} width={220} height={120} color={color} />
              </div>
            );
          })}
        </div>
      </Section>

      {/* Balance Alerts */}
      <Section
        title={`Balance Alerts (${report.alerts.length})`}
        icon={AlertTriangle}
        color={hasCritical ? STATUS_ERROR : STATUS_WARNING}
      >
        <AlertBadges alerts={report.alerts} />
      </Section>
    </div>
  );
}
