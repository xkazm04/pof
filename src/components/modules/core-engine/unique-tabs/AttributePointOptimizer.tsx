'use client';

import { useMemo, useState, useCallback } from 'react';
import {
  Zap, Shield, Droplets, Swords, Target, TrendingUp,
  RotateCcw, ArrowRight, AlertTriangle, CheckCircle2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  STATUS_WARNING, STATUS_ERROR, STATUS_SUCCESS,
  ACCENT_CYAN, ACCENT_VIOLET, ACCENT_EMERALD,
  OPACITY_10, OPACITY_15, OPACITY_20,
} from '@/lib/chart-colors';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { SectionLabel, RadarChart, SubTabNavigation } from './_shared';
import type { SubTab } from './_shared';
import type { SubModuleId } from '@/types/modules';
import type { RadarDataPoint } from '@/types/unique-tab-improvements';

/* ── UE5 Constants (from ARPGPlayerCharacter.h) ───────────────────────────── */

const UE5 = {
  maxLevel: 50,
  attributePointsPerLevel: 3,
  baseHP: 100,
  baseMana: 50,
  baseAttackPower: 10,
  baseCritChance: 0.05,
  baseCritDamage: 1.5,
  healthPerLevel: 10,
  manaPerLevel: 5,
  attackPowerPerSTR: 2.0,
  critChancePerDEX: 0.005,
  maxManaPerINT: 5.0,
} as const;

const TOTAL_POINTS = (UE5.maxLevel - 1) * UE5.attributePointsPerLevel; // 147

/* ── Optimization Targets ─────────────────────────────────────────────────── */

type OptTarget = 'max-dps' | 'max-ehp' | 'balanced' | 'crit-mana' | 'custom';

interface OptPreset {
  id: OptTarget;
  label: string;
  description: string;
  icon: typeof Swords;
  color: string;
  weights: { dps: number; ehp: number; mana: number };
}

const OPT_PRESETS: OptPreset[] = [
  { id: 'max-dps', label: 'Max DPS', description: 'Maximize raw damage per second', icon: Swords, color: STATUS_ERROR, weights: { dps: 1.0, ehp: 0.0, mana: 0.0 } },
  { id: 'max-ehp', label: 'Max EHP', description: 'Maximize effective hit points', icon: Shield, color: ACCENT_EMERALD, weights: { dps: 0.0, ehp: 1.0, mana: 0.0 } },
  { id: 'balanced', label: 'Balanced', description: 'Equal weight on DPS and survivability', icon: Target, color: STATUS_WARNING, weights: { dps: 0.5, ehp: 0.3, mana: 0.2 } },
  { id: 'crit-mana', label: 'Crit + Mana', description: 'Maximize crit chance and mana pool', icon: Zap, color: ACCENT_VIOLET, weights: { dps: 0.3, ehp: 0.0, mana: 0.7 } },
];

const ACCENT = ACCENT_CYAN;

/* ── Build Calculation ────────────────────────────────────────────────────── */

interface Allocation {
  str: number;
  dex: number;
  int: number;
}

interface BuildStats {
  attackPower: number;
  critChance: number;
  critDamage: number;
  maxHP: number;
  maxMana: number;
  effectiveDPS: number;
  effectiveHP: number;
  manaPool: number;
}

function calcStats(alloc: Allocation, level: number): BuildStats {
  const attackPower = UE5.baseAttackPower + alloc.str * UE5.attackPowerPerSTR;
  const critChance = Math.min(UE5.baseCritChance + alloc.dex * UE5.critChancePerDEX, 1.0);
  const critDamage = UE5.baseCritDamage;
  const maxHP = UE5.baseHP + level * UE5.healthPerLevel;
  const maxMana = UE5.baseMana + level * UE5.manaPerLevel + alloc.int * UE5.maxManaPerINT;

  // Effective DPS: base AP * (1 + critChance * (critDamage - 1))
  const effectiveDPS = attackPower * (1 + critChance * (critDamage - 1));
  const effectiveHP = maxHP; // No armor scaling in current UE5 build
  const manaPool = maxMana;

  return { attackPower, critChance, critDamage, maxHP, maxMana, effectiveDPS, effectiveHP, manaPool };
}

function objectiveScore(stats: BuildStats, weights: { dps: number; ehp: number; mana: number }): number {
  // Normalize each dimension to roughly 0-1 range for fair weighting
  const dpsNorm = stats.effectiveDPS / 300; // ~max at full STR
  const ehpNorm = stats.effectiveHP / 600;  // max HP at level 50
  const manaNorm = stats.manaPool / 1000;   // ~max at full INT
  return weights.dps * dpsNorm + weights.ehp * ehpNorm + weights.mana * manaNorm;
}

/** Brute-force optimizer: iterate all possible STR/DEX/INT allocations that sum to totalPoints. */
function optimize(totalPoints: number, level: number, weights: { dps: number; ehp: number; mana: number }): Allocation {
  let best: Allocation = { str: 0, dex: 0, int: 0 };
  let bestScore = -Infinity;

  for (let s = 0; s <= totalPoints; s++) {
    for (let d = 0; d <= totalPoints - s; d++) {
      const i = totalPoints - s - d;
      const stats = calcStats({ str: s, dex: d, int: i }, level);
      const score = objectiveScore(stats, weights);
      if (score > bestScore) {
        bestScore = score;
        best = { str: s, dex: d, int: i };
      }
    }
  }
  return best;
}

/* ── Attribute Bar ────────────────────────────────────────────────────────── */

interface AttrBarProps {
  label: string;
  value: number;
  max: number;
  color: string;
  icon: typeof Swords;
  perPoint: string;
  onChange?: (v: number) => void;
  disabled?: boolean;
}

function AttrBar({ label, value, max, color, icon: Icon, perPoint, onChange, disabled }: AttrBarProps) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Icon className="w-3.5 h-3.5" style={{ color }} />
          <span className="text-xs font-bold text-text">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-text-muted">{perPoint}</span>
          <span className="text-sm font-mono font-bold" style={{ color }}>{value}</span>
        </div>
      </div>
      {onChange ? (
        <input
          title={label}
          type="range"
          min={0}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          disabled={disabled}
          className="w-full h-1.5 bg-surface-deep rounded-lg appearance-none cursor-pointer"
          style={{ accentColor: color }}
        />
      ) : (
        <div className="w-full h-1.5 bg-surface-deep rounded-lg overflow-hidden">
          <motion.div
            className="h-full rounded-lg"
            style={{ backgroundColor: color }}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />
        </div>
      )}
    </div>
  );
}

/* ── Delta Badge ──────────────────────────────────────────────────────────── */

function DeltaBadge({ current, optimal, label, unit, higherIsBetter = true }: {
  current: number; optimal: number; label: string; unit: string; higherIsBetter?: boolean;
}) {
  const delta = optimal - current;
  const isPositive = higherIsBetter ? delta > 0 : delta < 0;
  const isZero = Math.abs(delta) < 0.001;
  const color = isZero ? 'text-text-muted' : isPositive ? 'text-emerald-400' : 'text-red-400';
  const sign = delta > 0 ? '+' : '';
  const displayDelta = unit === '%' ? (delta * 100).toFixed(1) : delta.toFixed(1);
  const displayCurrent = unit === '%' ? (current * 100).toFixed(1) : current.toFixed(1);
  const displayOptimal = unit === '%' ? (optimal * 100).toFixed(1) : optimal.toFixed(1);

  return (
    <div className="flex items-center justify-between px-2 py-1.5 rounded-md bg-surface/50 border border-border/30">
      <span className="text-xs font-medium text-text-muted">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono text-text">{displayCurrent}{unit}</span>
        <ArrowRight className="w-3 h-3 text-text-muted" />
        <span className="text-xs font-mono font-bold text-text">{displayOptimal}{unit}</span>
        {!isZero && (
          <span className={`text-xs font-mono font-bold ${color}`}>
            ({sign}{displayDelta}{unit})
          </span>
        )}
      </div>
    </div>
  );
}

/* ── Component ─────────────────────────────────────────────────────────────── */

interface AttributePointOptimizerProps {
  moduleId: SubModuleId;
}

export function AttributePointOptimizer({ moduleId: _moduleId }: AttributePointOptimizerProps) {
  const [activeTab, setActiveTab] = useState('optimizer');
  const [target, setTarget] = useState<OptTarget>('max-dps');
  const [level, setLevel] = useState<number>(UE5.maxLevel);
  const [customWeights, setCustomWeights] = useState({ dps: 0.4, ehp: 0.3, mana: 0.3 });

  // Current (manual) allocation
  const [currentAlloc, setCurrentAlloc] = useState<Allocation>({ str: 49, dex: 49, int: 49 });

  const totalAvailable = useMemo(() => Math.max(0, level - 1) * UE5.attributePointsPerLevel, [level]);
  const currentUsed = currentAlloc.str + currentAlloc.dex + currentAlloc.int;
  const remaining = totalAvailable - currentUsed;

  const tabs: SubTab[] = useMemo(() => [
    { id: 'optimizer', label: 'Optimizer', icon: Target },
    { id: 'comparison', label: 'Comparison', icon: TrendingUp },
  ], []);

  // Get the active weights
  const activeWeights = useMemo(() => {
    if (target === 'custom') return customWeights;
    return OPT_PRESETS.find(p => p.id === target)!.weights;
  }, [target, customWeights]);

  // Compute optimal allocation
  const optimalAlloc = useMemo(() => optimize(totalAvailable, level, activeWeights), [totalAvailable, level, activeWeights]);

  // Compute stats for both allocations
  const currentStats = useMemo(() => calcStats(currentAlloc, level), [currentAlloc, level]);
  const optimalStats = useMemo(() => calcStats(optimalAlloc, level), [optimalAlloc, level]);

  // Radar data
  const currentRadar: RadarDataPoint[] = useMemo(() => [
    { axis: 'STR', value: totalAvailable > 0 ? currentAlloc.str / totalAvailable : 0 },
    { axis: 'DEX', value: totalAvailable > 0 ? currentAlloc.dex / totalAvailable : 0 },
    { axis: 'INT', value: totalAvailable > 0 ? currentAlloc.int / totalAvailable : 0 },
    { axis: 'DPS', value: currentStats.effectiveDPS / Math.max(optimalStats.effectiveDPS, 1) },
    { axis: 'EHP', value: currentStats.effectiveHP / Math.max(optimalStats.effectiveHP, 1) },
  ], [currentAlloc, totalAvailable, currentStats, optimalStats]);

  const optimalRadar: RadarDataPoint[] = useMemo(() => [
    { axis: 'STR', value: totalAvailable > 0 ? optimalAlloc.str / totalAvailable : 0 },
    { axis: 'DEX', value: totalAvailable > 0 ? optimalAlloc.dex / totalAvailable : 0 },
    { axis: 'INT', value: totalAvailable > 0 ? optimalAlloc.int / totalAvailable : 0 },
    { axis: 'DPS', value: 1 },
    { axis: 'EHP', value: 1 },
  ], [optimalAlloc, totalAvailable]);

  // Handle allocation changes with clamping
  const updateAlloc = useCallback((attr: keyof Allocation, value: number) => {
    setCurrentAlloc(prev => {
      const otherSum = (attr === 'str' ? 0 : prev.str) + (attr === 'dex' ? 0 : prev.dex) + (attr === 'int' ? 0 : prev.int);
      const clamped = Math.min(value, totalAvailable - otherSum);
      return { ...prev, [attr]: Math.max(0, clamped) };
    });
  }, [totalAvailable]);

  const applyOptimal = useCallback(() => {
    setCurrentAlloc(optimalAlloc);
  }, [optimalAlloc]);

  const resetAlloc = useCallback(() => {
    const even = Math.floor(totalAvailable / 3);
    const remainder = totalAvailable - even * 3;
    setCurrentAlloc({ str: even + (remainder > 0 ? 1 : 0), dex: even + (remainder > 1 ? 1 : 0), int: even });
  }, [totalAvailable]);

  const activePreset = OPT_PRESETS.find(p => p.id === target);
  const accentColor = activePreset?.color ?? ACCENT;

  // Efficiency: how close current is to optimal
  const currentScore = objectiveScore(currentStats, activeWeights);
  const optimalScore = objectiveScore(optimalStats, activeWeights);
  const efficiency = optimalScore > 0 ? Math.round((currentScore / optimalScore) * 100) : 100;

  return (
    <div className="space-y-2.5">
      <div className="flex flex-col gap-1.5">
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between pb-2 border-b border-border/40"
        >
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg relative overflow-hidden group">
              <div className="absolute inset-0 opacity-20" style={{ backgroundColor: ACCENT }} />
              <Target className="w-4 h-4 relative z-10" style={{ color: ACCENT, filter: `drop-shadow(0 0 4px ${ACCENT}80)` }} />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-text tracking-wide">Attribute Optimizer</span>
              <span className="text-xs text-text-muted">
                <span className="font-mono font-medium" style={{ color: ACCENT }}>{totalAvailable}</span>
                <span className="opacity-60"> points at Lv.{level}</span>
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="px-2 py-1 rounded-md text-xs font-mono border border-border/40" style={{ backgroundColor: `${accentColor}${OPACITY_10}`, color: accentColor }}>
              {efficiency}% efficient
            </div>
          </div>
        </motion.div>
        <SubTabNavigation tabs={tabs} activeTabId={activeTab} onChange={setActiveTab} accent={ACCENT} />
      </div>

      <AnimatePresence mode="sync">
        {/* ═══ OPTIMIZER TAB ═══ */}
        {activeTab === 'optimizer' && (
          <motion.div key="optimizer" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="space-y-2.5">

            {/* Level Selector + Target Presets */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-2.5">

              {/* Target Presets */}
              <SurfaceCard level={2} className="lg:col-span-2 p-3">
                <SectionLabel icon={Target} label="Optimization Target" color={ACCENT} />
                <div className="grid grid-cols-2 gap-1.5 mt-2">
                  {OPT_PRESETS.map(preset => {
                    const Icon = preset.icon;
                    const isActive = target === preset.id;
                    return (
                      <button
                        key={preset.id}
                        onClick={() => setTarget(preset.id)}
                        className="relative text-left p-2.5 rounded-lg border transition-all focus-visible:outline-none focus-visible:ring-2"
                        style={{
                          borderColor: isActive ? `${preset.color}60` : 'var(--border)',
                          backgroundColor: isActive ? `${preset.color}${OPACITY_10}` : 'transparent',
                          '--tw-ring-color': preset.color,
                        } as React.CSSProperties}
                      >
                        {isActive && (
                          <motion.div
                            layoutId="optTargetBg"
                            className="absolute inset-0 rounded-lg opacity-10"
                            style={{ backgroundColor: preset.color }}
                            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                          />
                        )}
                        <div className="flex items-center gap-2 relative z-10">
                          <Icon className="w-4 h-4" style={{ color: preset.color }} />
                          <div>
                            <div className="text-xs font-bold text-text">{preset.label}</div>
                            <div className="text-xs text-text-muted leading-tight">{preset.description}</div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Custom Weights */}
                {target === 'custom' && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-2 space-y-2 border-t border-border/30 pt-2">
                    {(['dps', 'ehp', 'mana'] as const).map(key => (
                      <div key={key} className="flex items-center gap-2">
                        <span className="text-xs font-mono w-10 text-text-muted uppercase">{key}</span>
                        <input title={key} type="range" min={0} max={1} step={0.05} value={customWeights[key]}
                          onChange={e => setCustomWeights(w => ({ ...w, [key]: Number(e.target.value) }))}
                          className="flex-1 h-1.5 rounded-lg appearance-none cursor-pointer" style={{ accentColor: ACCENT }}
                        />
                        <span className="text-xs font-mono w-8 text-right" style={{ color: ACCENT }}>{(customWeights[key] * 100).toFixed(0)}%</span>
                      </div>
                    ))}
                  </motion.div>
                )}
              </SurfaceCard>

              {/* Level Selector */}
              <SurfaceCard level={2} className="p-3">
                <SectionLabel icon={TrendingUp} label="Character Level" color={ACCENT} />
                <div className="mt-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-mono font-bold" style={{ color: ACCENT }}>{level}</span>
                    <span className="text-xs font-mono text-text-muted">/ {UE5.maxLevel}</span>
                  </div>
                  <input title="Level" type="range" min={1} max={UE5.maxLevel} value={level}
                    onChange={e => setLevel(Number(e.target.value))}
                    className="w-full h-1.5 bg-surface-deep rounded-lg appearance-none cursor-pointer" style={{ accentColor: ACCENT }}
                  />
                  <div className="grid grid-cols-2 gap-1.5 text-xs font-mono">
                    <div className="px-2 py-1 rounded bg-surface/50 border border-border/30">
                      <span className="text-text-muted">Points:</span>{' '}
                      <span className="text-text font-bold">{totalAvailable}</span>
                    </div>
                    <div className="px-2 py-1 rounded bg-surface/50 border border-border/30">
                      <span className="text-text-muted">Per Lv:</span>{' '}
                      <span className="text-text font-bold">{UE5.attributePointsPerLevel}</span>
                    </div>
                  </div>

                  {/* UE5 Ratios */}
                  <div className="border-t border-border/30 pt-2">
                    <div className="text-xs text-text-muted font-bold uppercase tracking-widest mb-1.5">UE5 Per-Point Ratios</div>
                    <div className="space-y-1 text-xs font-mono">
                      <div className="flex justify-between"><span style={{ color: STATUS_ERROR }}>STR</span><span className="text-text">+{UE5.attackPowerPerSTR} AP</span></div>
                      <div className="flex justify-between"><span style={{ color: ACCENT_EMERALD }}>DEX</span><span className="text-text">+{(UE5.critChancePerDEX * 100).toFixed(1)}% Crit</span></div>
                      <div className="flex justify-between"><span style={{ color: ACCENT_CYAN }}>INT</span><span className="text-text">+{UE5.maxManaPerINT} Mana</span></div>
                    </div>
                  </div>
                </div>
              </SurfaceCard>
            </div>

            {/* Allocation Sliders */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
              <SurfaceCard level={2} className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <SectionLabel icon={Swords} label="Current Allocation" color={accentColor} />
                  <div className="flex gap-1">
                    <button onClick={applyOptimal} className="text-xs px-2 py-0.5 rounded border border-border/40 hover:bg-surface-hover/50 transition-colors flex items-center gap-1 text-text-muted hover:text-text">
                      <CheckCircle2 className="w-3 h-3" style={{ color: STATUS_SUCCESS }} /> Apply Optimal
                    </button>
                    <button onClick={resetAlloc} className="text-xs px-2 py-0.5 rounded border border-border/40 hover:bg-surface-hover/50 transition-colors flex items-center gap-1 text-text-muted hover:text-text">
                      <RotateCcw className="w-3 h-3" /> Reset
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <AttrBar label="Strength" value={currentAlloc.str} max={totalAvailable} color={STATUS_ERROR} icon={Swords} perPoint={`+${UE5.attackPowerPerSTR} AP`} onChange={v => updateAlloc('str', v)} />
                  <AttrBar label="Dexterity" value={currentAlloc.dex} max={totalAvailable} color={ACCENT_EMERALD} icon={Zap} perPoint={`+${(UE5.critChancePerDEX * 100).toFixed(1)}% Crit`} onChange={v => updateAlloc('dex', v)} />
                  <AttrBar label="Intelligence" value={currentAlloc.int} max={totalAvailable} color={ACCENT_CYAN} icon={Droplets} perPoint={`+${UE5.maxManaPerINT} Mana`} onChange={v => updateAlloc('int', v)} />
                </div>

                {/* Remaining points indicator */}
                <div className="mt-2 pt-2 border-t border-border/30 flex items-center justify-between text-xs font-mono">
                  <span className="text-text-muted">Unspent</span>
                  <span className={remaining > 0 ? 'text-amber-400 font-bold' : remaining < 0 ? 'text-red-400 font-bold' : 'text-emerald-400'}>
                    {remaining > 0 && <AlertTriangle className="w-3 h-3 inline mr-1" />}
                    {remaining} pts
                  </span>
                </div>
              </SurfaceCard>

              {/* Optimal Allocation */}
              <SurfaceCard level={2} className="p-3">
                <SectionLabel icon={Target} label="Optimal Allocation" color={STATUS_SUCCESS} />
                <div className="mt-2 space-y-3">
                  <AttrBar label="Strength" value={optimalAlloc.str} max={totalAvailable} color={STATUS_ERROR} icon={Swords} perPoint={`+${UE5.attackPowerPerSTR} AP`} />
                  <AttrBar label="Dexterity" value={optimalAlloc.dex} max={totalAvailable} color={ACCENT_EMERALD} icon={Zap} perPoint={`+${(UE5.critChancePerDEX * 100).toFixed(1)}% Crit`} />
                  <AttrBar label="Intelligence" value={optimalAlloc.int} max={totalAvailable} color={ACCENT_CYAN} icon={Droplets} perPoint={`+${UE5.maxManaPerINT} Mana`} />
                </div>

                {/* Radar overlay */}
                <div className="mt-3 flex justify-center">
                  <RadarChart
                    data={optimalRadar}
                    accent={STATUS_SUCCESS}
                    size={140}
                    overlays={[{ data: currentRadar, color: accentColor, label: 'Current' }]}
                  />
                </div>
                <div className="flex justify-center gap-4 mt-1 text-xs">
                  <span className="flex items-center gap-1"><span className="w-2 h-0.5 rounded" style={{ backgroundColor: STATUS_SUCCESS }} /> Optimal</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-0.5 rounded border border-dashed" style={{ borderColor: accentColor }} /> Current</span>
                </div>
              </SurfaceCard>
            </div>
          </motion.div>
        )}

        {/* ═══ COMPARISON TAB ═══ */}
        {activeTab === 'comparison' && (
          <motion.div key="comparison" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="space-y-2.5">

            {/* Stat Comparison */}
            <SurfaceCard level={2} className="p-3">
              <SectionLabel icon={TrendingUp} label="Stat Comparison — Current vs Optimal" color={ACCENT} />
              <div className="mt-2 space-y-1">
                <DeltaBadge current={currentStats.attackPower} optimal={optimalStats.attackPower} label="Attack Power" unit="" />
                <DeltaBadge current={currentStats.critChance} optimal={optimalStats.critChance} label="Crit Chance" unit="%" />
                <DeltaBadge current={currentStats.effectiveDPS} optimal={optimalStats.effectiveDPS} label="Effective DPS" unit="" />
                <DeltaBadge current={currentStats.maxHP} optimal={optimalStats.maxHP} label="Max HP" unit="" />
                <DeltaBadge current={currentStats.maxMana} optimal={optimalStats.maxMana} label="Max Mana" unit="" />
              </div>
            </SurfaceCard>

            {/* Allocation Delta */}
            <SurfaceCard level={2} className="p-3">
              <SectionLabel icon={Target} label="Allocation Delta" color={ACCENT} />
              <div className="mt-2 grid grid-cols-3 gap-2">
                {([
                  { key: 'str' as const, label: 'STR', color: STATUS_ERROR },
                  { key: 'dex' as const, label: 'DEX', color: ACCENT_EMERALD },
                  { key: 'int' as const, label: 'INT', color: ACCENT_CYAN },
                ]).map(({ key, label, color }) => {
                  const curr = currentAlloc[key];
                  const opt = optimalAlloc[key];
                  const delta = opt - curr;
                  return (
                    <div key={key} className="text-center p-3 rounded-lg border border-border/30 bg-surface/30">
                      <div className="text-xs font-bold uppercase tracking-widest text-text-muted mb-1">{label}</div>
                      <div className="flex items-center justify-center gap-1.5">
                        <span className="text-lg font-mono text-text">{curr}</span>
                        <ArrowRight className="w-3 h-3 text-text-muted" />
                        <span className="text-lg font-mono font-bold" style={{ color }}>{opt}</span>
                      </div>
                      {delta !== 0 && (
                        <div className={`text-xs font-mono mt-1 ${delta > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {delta > 0 ? '+' : ''}{delta} pts
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </SurfaceCard>

            {/* Efficiency Score */}
            <SurfaceCard level={2} className="p-3">
              <SectionLabel icon={Target} label="Build Efficiency" color={ACCENT} />
              <div className="mt-2 flex items-center gap-4">
                <div className="flex-1">
                  <div className="w-full h-3 bg-surface-deep rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ backgroundColor: efficiency >= 90 ? STATUS_SUCCESS : efficiency >= 70 ? STATUS_WARNING : STATUS_ERROR }}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(efficiency, 100)}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                    />
                  </div>
                </div>
                <span className="text-lg font-mono font-bold" style={{ color: efficiency >= 90 ? STATUS_SUCCESS : efficiency >= 70 ? STATUS_WARNING : STATUS_ERROR }}>
                  {efficiency}%
                </span>
              </div>
              <p className="text-xs text-text-muted mt-2 leading-relaxed">
                {efficiency >= 95 ? 'Your allocation is near-optimal for the selected target.'
                  : efficiency >= 80 ? 'Good allocation, but there is room for improvement. Consider redistributing points.'
                  : 'Significant gains available. Click "Apply Optimal" to see the recommended allocation.'}
              </p>
            </SurfaceCard>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
