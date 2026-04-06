'use client';

import { useCallback } from 'react';
import {
  Swords, Heart, Zap, Shield, Target, Plus, Trash2,
  TrendingUp, Activity, Crosshair, Users, Settings2,
} from 'lucide-react';
import {
  STATUS_ERROR, ACCENT_CYAN, ACCENT_VIOLET, ACCENT_ORANGE,
  ACCENT_EMERALD, STATUS_WARNING, MODULE_COLORS,
  withOpacity, OPACITY_10, OPACITY_5,
} from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '../_design';
import { StatInput } from './StatInput';
import type { SimScenario, CombatantStats, EnemyConfig } from './data';
import { ENEMY_PRESETS } from './data';

export function ScenarioEditor({ scenario, onChange }: { scenario: SimScenario; onChange: (s: SimScenario) => void }) {
  const updatePlayer = useCallback((partial: Partial<CombatantStats>) => {
    onChange({ ...scenario, player: { ...scenario.player, ...partial } });
  }, [scenario, onChange]);

  const addEnemy = useCallback((preset: string) => {
    const stats = ENEMY_PRESETS[preset];
    if (!stats) return;
    onChange({ ...scenario, enemies: [...scenario.enemies, { id: `e-${Date.now()}`, stats: { ...stats }, count: 1 }] });
  }, [scenario, onChange]);

  const removeEnemy = useCallback((id: string) => {
    onChange({ ...scenario, enemies: scenario.enemies.filter(e => e.id !== id) });
  }, [scenario, onChange]);

  const updateEnemy = useCallback((id: string, partial: Partial<EnemyConfig>) => {
    onChange({ ...scenario, enemies: scenario.enemies.map(e => e.id === id ? { ...e, ...partial } : e) });
  }, [scenario, onChange]);

  const updateEnemyStats = useCallback((id: string, partial: Partial<CombatantStats>) => {
    onChange({ ...scenario, enemies: scenario.enemies.map(e => e.id === id ? { ...e, stats: { ...e.stats, ...partial } } : e) });
  }, [scenario, onChange]);

  const p = scenario.player;

  return (
    <div className="space-y-4">
      {/* Player Stats */}
      <BlueprintPanel color={ACCENT_CYAN} className="p-3">
        <SectionHeader label="Player Stats" icon={Swords} color={ACCENT_CYAN} />
        <div className="space-y-1.5">
          <StatInput label="Level" value={p.level} onChange={v => updatePlayer({ level: v })} min={1} max={50} icon={TrendingUp} color={ACCENT_VIOLET} />
          <StatInput label="Max HP" value={p.maxHealth} onChange={v => updatePlayer({ maxHealth: v })} min={100} max={5000} step={50} icon={Heart} color={STATUS_ERROR} />
          <StatInput label="Strength" value={p.strength} onChange={v => updatePlayer({ strength: v })} min={1} max={100} icon={Swords} color={ACCENT_ORANGE}
            hint={`+${p.strength * 2} AtkPow`} />
          <StatInput label="Dexterity" value={p.dexterity} onChange={v => updatePlayer({ dexterity: v })} min={1} max={100} icon={Crosshair} color={ACCENT_EMERALD} />
          <StatInput label="Intelligence" value={p.intelligence} onChange={v => updatePlayer({ intelligence: v })} min={1} max={100} icon={Zap} color={ACCENT_VIOLET} />
          <StatInput label="Armor" value={p.armor} onChange={v => updatePlayer({ armor: v })} min={0} max={200} icon={Shield} color={MODULE_COLORS.core}
            hint={`${(p.armor / (p.armor + 100) * 100).toFixed(1)}% mit`} />
          <StatInput label="Atk Power" value={p.attackPower} onChange={v => updatePlayer({ attackPower: v })} min={1} max={300} icon={Swords} color={STATUS_ERROR}
            hint={`\u03A3${p.attackPower + p.strength * 2} eff`} />
          <StatInput label="Base Dmg" value={p.baseDamage} onChange={v => updatePlayer({ baseDamage: v })} min={10} max={200} icon={Target} color={ACCENT_ORANGE} />
          <StatInput label="Crit %" value={p.criticalChance} onChange={v => updatePlayer({ criticalChance: v })} min={0} max={1} step={0.01} icon={Crosshair} color={STATUS_WARNING} unit=""
            hint={`+${(p.criticalChance * (p.criticalDamage - 1) * 100).toFixed(0)}% DPS`} />
          <StatInput label="Crit Mult" value={p.criticalDamage} onChange={v => updatePlayer({ criticalDamage: v })} min={1} max={4} step={0.1} icon={TrendingUp} color={STATUS_WARNING} unit="x"
            hint={`+${(p.criticalChance * (p.criticalDamage - 1) * 100).toFixed(0)}% DPS`} />
          <StatInput label="Atk Speed" value={p.attackSpeed} onChange={v => updatePlayer({ attackSpeed: v })} min={0.1} max={5} step={0.1} icon={Activity} color={ACCENT_CYAN} unit="/s" />
        </div>
      </BlueprintPanel>

      {/* Enemies */}
      <BlueprintPanel color={STATUS_ERROR} className="p-3">
        <SectionHeader label={`Enemies (${scenario.enemies.reduce((s, e) => s + e.count, 0)} total)`} icon={Users} color={STATUS_ERROR} />
        <div className="space-y-3">
          {scenario.enemies.map(enemy => (
            <div key={enemy.id} className="rounded-md border p-2 space-y-1.5" style={{ borderColor: `${withOpacity(STATUS_ERROR, OPACITY_10)}`, backgroundColor: `${withOpacity(STATUS_ERROR, OPACITY_5)}` }}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-text">{enemy.stats.name}</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-2xs text-text-muted">x</span>
                  <input type="number" min={1} max={20} value={enemy.count}
                    onChange={e => updateEnemy(enemy.id, { count: Math.max(1, Number(e.target.value)) })}
                    className="w-10 bg-surface-deep border border-border/40 rounded px-1 py-0.5 text-2xs font-mono text-text text-center" />
                  <button onClick={() => removeEnemy(enemy.id)} className="p-0.5 rounded hover:bg-surface-deep transition-colors" title="Remove">
                    <Trash2 className="w-3 h-3 text-text-muted hover:text-red-400" />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                <StatInput label="HP" value={enemy.stats.maxHealth} onChange={v => updateEnemyStats(enemy.id, { maxHealth: v })} min={50} max={5000} step={50} color={STATUS_ERROR} />
                <StatInput label="Armor" value={enemy.stats.armor} onChange={v => updateEnemyStats(enemy.id, { armor: v })} min={0} max={200} color={MODULE_COLORS.core} />
                <StatInput label="Atk Pow" value={enemy.stats.attackPower} onChange={v => updateEnemyStats(enemy.id, { attackPower: v })} min={1} max={200} color={ACCENT_ORANGE} />
                <StatInput label="Base Dmg" value={enemy.stats.baseDamage} onChange={v => updateEnemyStats(enemy.id, { baseDamage: v })} min={5} max={200} color={ACCENT_ORANGE} />
              </div>
            </div>
          ))}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-2xs text-text-muted">Add:</span>
            {Object.entries(ENEMY_PRESETS).map(([key, preset]) => (
              <button key={key} onClick={() => addEnemy(key)}
                className="text-2xs px-2 py-0.5 rounded-md border border-border/40 hover:border-border text-text-muted hover:text-text transition-colors">
                <Plus className="w-2.5 h-2.5 inline mr-0.5" />{preset.name}
              </button>
            ))}
          </div>
        </div>
      </BlueprintPanel>

      {/* Iterations */}
      <div className="flex items-center gap-2 px-1">
        <Settings2 className="w-3 h-3 text-text-muted" />
        <span className="text-2xs text-text-muted">Iterations:</span>
        <input type="number" min={100} max={10000} step={100} value={scenario.iterations}
          onChange={e => onChange({ ...scenario, iterations: Math.max(100, Number(e.target.value)) })}
          className="w-20 bg-surface-deep border border-border/40 rounded px-1.5 py-0.5 text-2xs font-mono text-text" />
      </div>
    </div>
  );
}
