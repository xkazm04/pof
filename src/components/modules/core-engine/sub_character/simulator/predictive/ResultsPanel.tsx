'use client';

import type { ReactNode } from 'react';
import {
  AlertTriangle, TrendingUp, Scale, Swords, Crosshair, Activity,
} from 'lucide-react';
import {
  ACCENT_CYAN, ACCENT_ORANGE, ACCENT_EMERALD, ACCENT_VIOLET,
  STATUS_ERROR, STATUS_WARNING,
} from '@/lib/chart-colors';
import {
  ACCENT, ENCOUNTER_COLORS, SENS_COLORS,
  survivalColor, type BalanceReport, type HeatmapCell,
} from './data';
import type { SweepCellRef, SweepDiff } from '@/lib/combat/sweep-tuning';
import { GlowStat } from './design';
import { Section } from './Section';
import { SurvivalHeatmap } from './SurvivalHeatmap';
import { SurvivalCurveChart } from './SurvivalCurveChart';
import { DPSBreakdownChart } from './DPSBreakdownChart';
import { SensitivityChart } from './SensitivityChart';
import { AlertBadges } from './AlertBadges';
import { CanonChecksPanel } from './CanonChecksPanel';
import { EnemySourcePanel } from './EnemySourcePanel';

/**
 * A finished sweep, rendered from the report ALONE (its own levels, encounters
 * and mid-level) — never from the live config, which may have changed since.
 * The tuning props are optional: a selectable heatmap, a slot for the tuner,
 * and the diff bar shown after an Apply.
 */
export function ResultsPanel({ report, diff, diffBar, selectedCell, onSelectCell, tuner }: {
  report: BalanceReport;
  /** Per-cell deltas against the run before the last Apply. */
  diff?: SweepDiff | null;
  /** Rendered under the summary (the Apply/Undo bar). */
  diffBar?: ReactNode;
  selectedCell?: SweepCellRef | null;
  onSelectCell?: (cell: HeatmapCell) => void;
  /** Rendered under the heatmap (the cell tuner). */
  tuner?: ReactNode;
}) {
  const { midLevel } = report;
  const midCells = report.heatmap.filter(c => c.playerLevel === midLevel);
  const avg = (fn: (c: typeof midCells[0]) => number) =>
    midCells.length > 0 ? midCells.reduce((s, c) => s + fn(c), 0) / midCells.length : 0;

  const avgSurv = avg(c => c.survivalRate);
  const avgTTK = avg(c => c.avgTTK);
  const avgDPS = avg(c => c.avgDPS);
  const avgEHP = avg(c => c.avgEHP);

  const hasCritical = report.alerts.some(a => a.severity === 'critical');
  const canonViolations = report.canonChecks.filter(c => c.status === 'violation').length;

  return (
    <div className="space-y-3">
      {/* Summary banner */}
      <div className="px-3 py-2 rounded-lg bg-surface-deep border border-border/30 text-xs font-mono tabular-nums text-text-muted">
        {report.summary}
        <span className="text-text-muted ml-2 opacity-60">({report.durationMs}ms)</span>
      </div>

      {diffBar}

      {/* Which enemies these numbers actually describe */}
      <EnemySourcePanel provenance={report.enemySource} />

      {/* Stat badges */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <GlowStat label={`Survival Lv.${midLevel}`} value={`${(avgSurv * 100).toFixed(0)}%`}
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
        <div className="space-y-2">
          <SurvivalHeatmap report={report} diff={diff} selected={selectedCell} onSelect={onSelectCell} />
          {tuner}
        </div>
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
                <div className="text-xs font-mono font-bold uppercase tracking-[0.15em] mb-1"
                  style={{ color }}>
                  {curve.attribute}
                </div>
                <SensitivityChart curve={curve} width={220} height={120} color={color} />
              </div>
            );
          })}
        </div>
      </Section>

      {/* Canon conformance (ARPG-LAWS) */}
      <Section
        title={`Canon Conformance (${canonViolations} violation${canonViolations === 1 ? '' : 's'})`}
        icon={Scale}
        color={canonViolations > 0 ? STATUS_ERROR : ACCENT_EMERALD}
        defaultOpen={canonViolations > 0}
      >
        <CanonChecksPanel checks={report.canonChecks} />
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
