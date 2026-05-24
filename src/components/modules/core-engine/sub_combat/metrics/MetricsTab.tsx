'use client';

import { useState, useMemo, useCallback } from 'react';
import { BarChart3, Activity, Swords } from 'lucide-react';
import { motion } from 'framer-motion';
import { BlueprintPanel, SectionHeader, NeonBar } from '../../unique-tabs/_design';
import {
  ACCENT, DPS_STRATEGIES, DPS_MAX, KPI_CARDS,
} from '../_shared/data';
import { WEAPONS, COMBO_SEQUENCES, parseDamageMidpoint } from '../_shared/data-metrics';
import type { Weapon, WeaponCategory } from '../_shared/data-metrics';
import { StatInfluencePanel } from './StatInfluencePanel';
import { AbilityQuickPicker } from '../../sub_character/input/AbilityQuickPicker';
import { CumulativeDamageSvg } from './CumulativeDamageSvg';
import { ProportionalSankey } from './ProportionalSankey';
import { GroupedDpsBarChart } from './GroupedDpsBarChart';

import { withOpacity, OPACITY_10, OPACITY_30 } from '@/lib/chart-colors';

const MAX_COMPARE = 4;
const WEAPON_CATEGORIES: WeaponCategory[] = ['Sword', 'Axe', 'Mace', 'Bow', 'Staff', 'Dagger', 'Polearm'];
const WEAPONS_BY_CATEGORY = WEAPON_CATEGORIES.map(cat => ({
  category: cat,
  weapons: WEAPONS.filter(w => w.category === cat),
}));

function weaponDps(w: Weapon): number {
  const mid = parseDamageMidpoint(w.baseDamage);
  const speed = parseFloat(w.attackSpeed);
  const crit = parseInt(w.critChance);
  return mid / speed * (1 + crit / 100);
}

export function MetricsTab() {
  const [compareIds, setCompareIds] = useState<string[]>([]);

  const toggleCompare = useCallback((id: string) => {
    setCompareIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= MAX_COMPARE) return prev;
      return [...prev, id];
    });
  }, []);

  const compared = useMemo(
    () => compareIds.map(id => WEAPONS.find(w => w.id === id)!).filter(Boolean),
    [compareIds],
  );

  const comparedDps = useMemo(
    () => compared.map(w => ({ weapon: w, dps: weaponDps(w) })).sort((a, b) => b.dps - a.dps),
    [compared],
  );

  const compareDpsMax = comparedDps.length > 0 ? comparedDps[0].dps : 1;

  /** Combos for compared weapons (by category). */
  const comparedCombos = useMemo(() => {
    if (compared.length === 0) return [];
    const cats = new Set(compared.map(w => w.category));
    return COMBO_SEQUENCES.filter(c => cats.has(c.weaponCategory));
  }, [compared]);

  return (
    <motion.div key="metrics" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="space-y-4">
      {/* Weapon Comparison Selector */}
      <BlueprintPanel color={ACCENT} className="p-3">
        <SectionHeader label={`Weapon DPS Comparison (${compareIds.length}/${MAX_COMPARE})`} color={ACCENT} icon={Swords} />
        <p className="text-xs text-text-muted font-mono mb-2">Select 2-4 weapons to compare DPS side-by-side.</p>
        <div className="max-h-[220px] overflow-y-auto custom-scrollbar space-y-2">
          {WEAPONS_BY_CATEGORY.map(({ category, weapons }) => (
            <div key={category}>
              <div className="text-2xs font-mono uppercase tracking-[0.15em] text-text-muted mb-1 sticky top-0 bg-surface-deep/80 backdrop-blur-sm py-0.5 px-1">{category} ({weapons.length})</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-1">
                {weapons.map(w => {
                  const sel = compareIds.includes(w.id);
                  return (
                    <button
                      key={w.id}
                      onClick={() => toggleCompare(w.id)}
                      disabled={!sel && compareIds.length >= MAX_COMPARE}
                      className="px-2 py-1.5 rounded border text-xs font-mono text-left transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed hover:brightness-110"
                      style={{
                        borderColor: sel ? withOpacity(w.color, OPACITY_30) : 'var(--border)',
                        backgroundColor: sel ? withOpacity(w.color, OPACITY_10) : 'transparent',
                        color: sel ? w.color : 'var(--text-muted)',
                      }}
                    >
                      <div className="truncate font-bold" style={{ color: sel ? w.color : 'var(--text)' }}>{w.name}</div>
                      <div className="text-2xs">{w.tier}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        {comparedDps.length >= 2 && (
          <div className="mt-3 pt-3 border-t border-border/30 space-y-1.5">
            {comparedDps.map(({ weapon, dps }) => (
              <div key={weapon.id} className="flex items-center gap-2 px-1 py-0.5">
                <span className="text-xs font-mono text-text w-[140px] flex-shrink-0 truncate">{weapon.name}</span>
                <div className="flex-1"><NeonBar pct={(dps / compareDpsMax) * 100} color={weapon.color} /></div>
                <span className="text-xs font-mono font-bold w-[60px] text-right" style={{ color: weapon.color }}>{dps.toFixed(0)} DPS</span>
              </div>
            ))}
          </div>
        )}
        {comparedCombos.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border/30">
            <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted mb-2 block">Related Combos ({comparedCombos.length})</span>
            <div className="space-y-1">
              {comparedCombos.slice(0, 8).map(c => (
                <div key={c.id} className="flex items-center gap-2 text-xs font-mono px-1 py-0.5">
                  <span className="text-text w-[130px] truncate">{c.name}</span>
                  <span className="text-text-muted w-[60px]">{c.weaponCategory}</span>
                  <span className="text-text-muted w-[40px]">{c.hits}h</span>
                  <div className="flex-1"><NeonBar pct={(c.dps / DPS_MAX) * 100} color={ACCENT} /></div>
                  <span className="font-bold w-[55px] text-right" style={{ color: ACCENT }}>{c.dps} DPS</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </BlueprintPanel>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* DPS Calculator */}
        <BlueprintPanel color={ACCENT} className="p-3">
          <SectionHeader label="DPS Calculator" color={ACCENT} icon={BarChart3} />
          <div className="mt-3 space-y-1.5">
            {DPS_STRATEGIES.map((strat, idx) => (
              <motion.div key={strat.name} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.08 }} className="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-surface-hover/30 transition-colors">
                <span className="text-xs font-mono uppercase tracking-[0.15em] text-text w-[130px] flex-shrink-0 truncate">{strat.name}</span>
                <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted w-[50px] flex-shrink-0">{strat.time}</span>
                <div className="flex-1">
                  <NeonBar pct={(strat.dps / DPS_MAX) * 100} color={strat.color} />
                </div>
                <span className="text-xs font-mono font-bold w-[55px] text-right" style={{ color: strat.color }}>{strat.dps} DPS</span>
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
