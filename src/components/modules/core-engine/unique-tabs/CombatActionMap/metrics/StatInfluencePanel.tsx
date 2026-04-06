'use client';

import { useMemo, useState } from 'react';
import { Sliders } from 'lucide-react';
import { BlueprintPanel, SectionHeader, NeonBar } from '../../_design';
import { ACCENT } from '../data';
import { WEAPONS, parseDamageMidpoint } from '../data-metrics';
import type { Weapon, WeaponCategory } from '../data-metrics';

import { OVERLAY_WHITE, withOpacity, OPACITY_5, OPACITY_8, OPACITY_15 } from '@/lib/chart-colors';

const WEAPON_CATEGORIES: WeaponCategory[] = ['Sword', 'Axe', 'Mace', 'Bow', 'Staff', 'Dagger', 'Polearm'];
const WEAPONS_BY_CAT = WEAPON_CATEGORIES.map(cat => ({
  category: cat,
  weapons: WEAPONS.map((w, i) => ({ ...w, idx: i })).filter(w => w.category === cat),
}));

interface StatInfluencePanelProps {
  moduleId: string;
}

function computeDps(weapon: Weapon, str: number, dex: number) {
  const baseMid = parseDamageMidpoint(weapon.baseDamage);
  const effectiveDamage = baseMid + (str - 10) * 2;
  const effectiveSpeed = Math.max(0.3, parseFloat(weapon.attackSpeed) - (dex - 10) * 0.02);
  const effectiveCrit = parseInt(weapon.critChance) + Math.floor((dex - 10) / 2);
  return { effectiveDamage, effectiveSpeed, effectiveCrit, dps: effectiveDamage / effectiveSpeed * (1 + effectiveCrit / 100) };
}

export function StatInfluencePanel({ moduleId: _moduleId }: StatInfluencePanelProps) {
  const [str, setStr] = useState(10);
  const [dex, setDex] = useState(10);
  const [selectedIdx, setSelectedIdx] = useState(0);

  const weapon = WEAPONS[selectedIdx];

  const computed = useMemo(() => computeDps(weapon, str, dex), [weapon, str, dex]);

  const allWeaponDps = useMemo(() => {
    const entries = WEAPONS.map((w) => ({
      name: w.name,
      color: w.color,
      dps: computeDps(w, str, dex).dps,
    }));
    entries.sort((a, b) => b.dps - a.dps);
    return entries;
  }, [str, dex]);

  const maxDps = allWeaponDps.length > 0 ? allWeaponDps[0].dps : 1;

  const stats = [
    { label: 'STR', value: str, set: setStr },
    { label: 'DEX', value: dex, set: setDex },
  ] as const;

  return (
    <div data-testid="stat-influence-panel">
    <BlueprintPanel color={ACCENT} className="p-3">
      <SectionHeader label="Stat Influence" color={ACCENT} icon={Sliders} />

      {/* Stat sliders */}
      <div className="grid grid-cols-2 gap-3 mt-2">
        {stats.map(({ label, value, set }) => (
          <div key={label}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">{label}</span>
              <span className="text-xs font-mono font-bold text-text-strong">{value}</span>
            </div>
            <input
              type="range" min={8} max={20} value={value}
              onChange={(e) => set(Number(e.target.value))}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(90deg, ${ACCENT} ${((value - 8) / 12) * 100}%, ${withOpacity(OVERLAY_WHITE, OPACITY_8)} ${((value - 8) / 12) * 100}%)`,
              }}
            />
          </div>
        ))}
      </div>

      {/* Weapon selector */}
      <div className="mt-3">
        <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">Weapon</span>
        <select
          value={selectedIdx}
          onChange={(e) => setSelectedIdx(Number(e.target.value))}
          className="mt-1 w-full bg-surface-deep border border-border/30 rounded px-2 py-1.5 text-xs font-mono text-text focus:outline-none focus:border-border/60"
        >
          {WEAPONS_BY_CAT.map(({ category, weapons }) => (
            <optgroup key={category} label={category}>
              {weapons.map(w => (
                <option key={w.id} value={w.idx}>{w.name} ({w.baseDamage})</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {/* Computed values */}
      <div className="grid grid-cols-4 gap-2 mt-3">
        {[
          { label: 'Eff. Damage', value: computed.effectiveDamage.toFixed(1), color: ACCENT },
          { label: 'Eff. Speed', value: `${computed.effectiveSpeed.toFixed(2)}s`, color: ACCENT },
          { label: 'Eff. Crit', value: `${computed.effectiveCrit}%`, color: ACCENT },
          { label: 'DPS', value: computed.dps.toFixed(1), color: weapon.color },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded border p-2 text-center" style={{ borderColor: withOpacity(color, OPACITY_15), backgroundColor: withOpacity(color, OPACITY_5) }}>
            <div className="text-xs font-mono text-text-muted uppercase tracking-[0.1em]">{label}</div>
            <div className="text-sm font-mono font-bold mt-0.5" style={{ color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* DPS comparison bar chart */}
      <div className="mt-3 pt-3 border-t border-border/30">
        <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">DPS Comparison (All Weapons)</span>
        <div className="mt-2 space-y-1 max-h-[300px] overflow-y-auto custom-scrollbar">
          {allWeaponDps.map((entry) => (
            <div key={entry.name} className="flex items-center gap-2 px-1 py-0.5 rounded hover:bg-surface-hover/30 transition-colors">
              <span className="text-xs font-mono text-text w-[140px] flex-shrink-0 truncate" title={entry.name}>
                {entry.name}
              </span>
              <div className="flex-1">
                <NeonBar pct={(entry.dps / maxDps) * 100} color={entry.color} />
              </div>
              <span className="text-xs font-mono font-bold w-[55px] text-right" style={{ color: entry.color }}>
                {entry.dps.toFixed(0)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </BlueprintPanel>
    </div>
  );
}
