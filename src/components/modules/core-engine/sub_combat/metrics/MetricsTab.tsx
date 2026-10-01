'use client';

import { BarChart3, Activity } from 'lucide-react';
import { motion } from 'framer-motion';
import { BlueprintPanel, SectionHeader, NeonBar } from '../../unique-tabs/_design';
import { ACCENT, KPI_CARDS } from '../_shared/data';
import { WEAPON_ROSTER } from '../_shared/data-metrics';
import { StatInfluencePanel } from './StatInfluencePanel';
import { AbilityQuickPicker } from '../../sub_character/input/AbilityQuickPicker';
import { CumulativeDamageSvg } from './CumulativeDamageSvg';
import { ProportionalSankey } from './ProportionalSankey';
import { GroupedDpsBarChart } from './GroupedDpsBarChart';
import { WeaponMatchupPanel } from './WeaponMatchupPanel';

/** DPS Calculator rows: the roster's top 6 under the one weapon-DPS law (also plotted cumulatively). */
const CALC_TOP = WEAPON_ROSTER.rows.slice(0, 6);
const CALC_MAX = CALC_TOP[0]?.dps || 1;

export function MetricsTab() {
  return (
    <motion.div key="metrics" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="space-y-4">
      {/* Weapon Comparison: vs a target (time-to-kill + band) */}
      <WeaponMatchupPanel />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* DPS Calculator */}
        <BlueprintPanel color={ACCENT} className="p-3">
          <SectionHeader label="DPS Calculator" color={ACCENT} icon={BarChart3} />
          <p className="text-xs text-text-muted font-mono mt-1">Top {CALC_TOP.length} of {WEAPON_ROSTER.rows.length} weapons · expected hit (canon crit) / attack interval, no target armour.</p>
          <div className="mt-2 space-y-1.5">
            {CALC_TOP.map((row, idx) => (
              <motion.div key={row.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.08 }} className="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-surface-hover/30 transition-colors">
                <span className="text-xs font-mono uppercase tracking-[0.15em] text-text w-[130px] flex-shrink-0 truncate" title={row.name}>{row.name}</span>
                <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted w-[50px] flex-shrink-0" title="Attack interval">{row.intervalSec}s</span>
                <div className="flex-1">
                  <NeonBar pct={(row.dps / CALC_MAX) * 100} color={row.weapon.color} />
                </div>
                <span className="text-xs font-mono font-bold w-[55px] text-right" style={{ color: row.weapon.color }}>{row.dps.toFixed(1)} DPS</span>
              </motion.div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-border/30">
            <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">DPS by Weapon Category</span>
            <div className="bg-surface-deep/30 rounded-lg p-2 mt-2">
              <GroupedDpsBarChart />
            </div>
            <details className="mt-2">
              <summary className="text-xs font-mono text-text-muted cursor-pointer hover:text-text transition-colors">Cumulative Damage (5s)</summary>
              <div className="bg-surface-deep/30 rounded-lg p-2 mt-1">
                <CumulativeDamageSvg />
              </div>
            </details>
          </div>
        </BlueprintPanel>

        <div className="space-y-4">
          {/* Combat Flow Sankey */}
          <BlueprintPanel color={ACCENT} className="p-3">
            <SectionHeader label="Combat Flow Sankey" color={ACCENT} icon={Activity} />
            <div className="mt-3">
              <ProportionalSankey />
            </div>
          </BlueprintPanel>

          {/* KPI Cards */}
          <div className="grid grid-cols-2 gap-4">
            {KPI_CARDS.map((kpi, idx) => (
              <BlueprintPanel key={idx} color={kpi.barColor ?? kpi.trendColor ?? ACCENT} className="p-3">
                <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">{kpi.label}</span>
                <div className="mt-1 flex items-end justify-between">
                  <span className="text-lg font-mono font-bold text-text-strong">{kpi.value}</span>
                  {kpi.trend && <span className="text-xs font-mono font-bold" style={{ color: kpi.trendColor }}>{kpi.trend}</span>}
                </div>
                {kpi.barPct !== undefined && kpi.barColor && (
                  <div className="mt-2">
                    <NeonBar pct={kpi.barPct} color={kpi.barColor} glow />
                  </div>
                )}
              </BlueprintPanel>
            ))}
          </div>
        </div>
      </div>
      {/* Stat Influence */}
      <StatInfluencePanel moduleId="combat-action-map" />
      {/* Ability Reference */}
      <AbilityQuickPicker />
    </motion.div>
  );
}
