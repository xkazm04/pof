'use client';

import { useMemo } from 'react';
import {
  Zap, Swords, Droplets, Target, TrendingUp,
  RotateCcw, CheckCircle2, AlertTriangle,
} from 'lucide-react';
import { motion } from 'framer-motion';
import {
  STATUS_SUCCESS, STATUS_ERROR, STATUS_WARNING,
  ACCENT_CYAN, ACCENT_EMERALD,
  OPACITY_10, OPACITY_20, OPACITY_50, OPACITY_37,
  GLOW_SM,
  withOpacity,
} from '@/lib/chart-colors';
import { RadarChart } from '../_shared';
import type { RadarDataPoint } from '@/types/unique-tab-improvements';
import { BlueprintPanel, SectionHeader } from './design';
import { AttrBar } from './AttrBar';
import { GlowStat } from './design';
import {
  UE5, OPT_PRESETS, ACCENT,
  type Allocation, type OptTarget, type OptWeights, type BuildStats,
} from './data';

/* ── Optimizer Tab ────────────────────────────────────────────────────────── */

interface OptimizerTabProps {
  target: OptTarget;
  setTarget: (t: OptTarget) => void;
  level: number;
  setLevel: (l: number) => void;
  customWeights: OptWeights;
  setCustomWeights: React.Dispatch<React.SetStateAction<OptWeights>>;
  currentAlloc: Allocation;
  optimalAlloc: Allocation;
  totalAvailable: number;
  remaining: number;
  accentColor: string;
  currentStats: BuildStats;
  optimalStats: BuildStats;
  updateAlloc: (attr: keyof Allocation, value: number) => void;
  applyOptimal: () => void;
  resetAlloc: () => void;
}

export function OptimizerTab({
  target, setTarget, level, setLevel,
  customWeights, setCustomWeights,
  currentAlloc, optimalAlloc, totalAvailable, remaining,
  accentColor, currentStats, optimalStats,
  updateAlloc, applyOptimal, resetAlloc,
}: OptimizerTabProps) {
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

  return (
    <motion.div key="optimizer" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="space-y-4">
      {/* ── Presets + Level ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <BlueprintPanel color={accentColor} className="lg:col-span-2 p-4">
          <SectionHeader icon={Target} label="Optimization Target" color={accentColor} />
          <div className="grid grid-cols-2 gap-2">
            {OPT_PRESETS.map(preset => {
              const Icon = preset.icon;
              const isActive = target === preset.id;
              return (
                <button
                  key={preset.id}
                  onClick={() => setTarget(preset.id)}
                  className="relative text-left p-2.5 rounded-lg border transition-all focus-visible:outline-none focus-visible:ring-2"
                  style={{
                    borderColor: isActive ? withOpacity(preset.color, OPACITY_37) : withOpacity(preset.color, OPACITY_10),
                    backgroundColor: isActive ? `${preset.color}${OPACITY_10}` : 'transparent',
                    '--tw-ring-color': preset.color,
                  } as React.CSSProperties}
                >
                  {isActive && (
                    <motion.div layoutId="optTargetBg" className="absolute inset-0 rounded-lg opacity-10" style={{ backgroundColor: preset.color }} transition={{ type: 'spring', stiffness: 300, damping: 25 }} />
                  )}
                  <div className="flex items-center gap-2 relative z-10">
                    <Icon className="w-4 h-4" style={{ color: preset.color, filter: `drop-shadow(${GLOW_SM} ${withOpacity(preset.color, OPACITY_50)})` }} />
                    <div>
                      <div className="text-xs font-mono uppercase tracking-[0.15em] text-text">{preset.label}</div>
                      <div className="text-xs text-text-muted leading-tight">{preset.description}</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {target === 'custom' && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-3 space-y-3 border-t pt-3" style={{ borderColor: withOpacity(ACCENT, OPACITY_10) }}>
              {(['dps', 'ehp', 'mana'] as const).map(key => (
                <div key={key} className="flex items-center gap-2">
                  <span className="text-xs font-mono uppercase tracking-[0.15em] w-10 text-text-muted">{key}</span>
                  <input title={key} type="range" min={0} max={1} step={0.05} value={customWeights[key]}
                    onChange={e => setCustomWeights(w => ({ ...w, [key]: Number(e.target.value) }))}
                    className="flex-1 h-1.5 rounded-lg appearance-none cursor-pointer" style={{ accentColor: ACCENT }}
                  />
                  <span className="text-xs font-mono w-8 text-right" style={{ color: ACCENT }}>{(customWeights[key] * 100).toFixed(0)}%</span>
                </div>
              ))}
            </motion.div>
          )}
        </BlueprintPanel>

        {/* ── Level Selector ── */}
        <BlueprintPanel color={ACCENT} className="p-4">
          <SectionHeader icon={TrendingUp} label="Character Level" color={ACCENT} />
          <div className="space-y-3">
            <GlowStat label="Level" value={level} unit={`/ ${UE5.maxLevel}`} color={ACCENT} />
            <input title="Level" type="range" min={1} max={UE5.maxLevel} value={level}
              onChange={e => setLevel(Number(e.target.value))}
              className="w-full h-1.5 bg-surface-deep rounded-lg appearance-none cursor-pointer" style={{ accentColor: ACCENT }}
            />
            <div className="grid grid-cols-2 gap-2">
              <GlowStat label="Points" value={totalAvailable} color={ACCENT} delay={0.05} />
              <GlowStat label="Per Lv" value={UE5.attributePointsPerLevel} color={ACCENT} delay={0.1} />
            </div>
            <div className="border-t pt-3" style={{ borderColor: withOpacity(ACCENT, OPACITY_10) }}>
              <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted mb-2">UE5 Per-Point Ratios</div>
              <div className="space-y-1.5 text-xs font-mono">
                <div className="flex justify-between"><span style={{ color: STATUS_ERROR }}>STR</span><span className="text-text">+{UE5.attackPowerPerSTR} AP</span></div>
                <div className="flex justify-between"><span style={{ color: ACCENT_EMERALD }}>DEX</span><span className="text-text">+{(UE5.critChancePerDEX * 100).toFixed(1)}% Crit</span></div>
                <div className="flex justify-between"><span style={{ color: ACCENT_CYAN }}>INT</span><span className="text-text">+{UE5.maxManaPerINT} Mana</span></div>
              </div>
            </div>
          </div>
        </BlueprintPanel>
      </div>

      {/* ── Allocation Sliders ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BlueprintPanel color={accentColor} className="p-4">
          <div className="flex items-center justify-between mb-3">
            <SectionHeader icon={Swords} label="Current Allocation" color={accentColor} />
            <div className="flex gap-1">
              <button onClick={applyOptimal} className="text-xs font-mono uppercase tracking-[0.15em] px-2 py-0.5 rounded border hover:bg-surface-hover/50 transition-colors flex items-center gap-1 text-text-muted hover:text-text" style={{ borderColor: withOpacity(STATUS_SUCCESS, OPACITY_20) }}>
                <CheckCircle2 className="w-3 h-3" style={{ color: STATUS_SUCCESS }} /> Apply
              </button>
              <button onClick={resetAlloc} className="text-xs font-mono uppercase tracking-[0.15em] px-2 py-0.5 rounded border border-border/40 hover:bg-surface-hover/50 transition-colors flex items-center gap-1 text-text-muted hover:text-text">
                <RotateCcw className="w-3 h-3" /> Reset
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <AttrBar label="Strength" value={currentAlloc.str} max={totalAvailable} color={STATUS_ERROR} icon={Swords} perPoint={`+${UE5.attackPowerPerSTR} AP`} onChange={v => updateAlloc('str', v)} />
            <AttrBar label="Dexterity" value={currentAlloc.dex} max={totalAvailable} color={ACCENT_EMERALD} icon={Zap} perPoint={`+${(UE5.critChancePerDEX * 100).toFixed(1)}% Crit`} onChange={v => updateAlloc('dex', v)} />
            <AttrBar label="Intelligence" value={currentAlloc.int} max={totalAvailable} color={ACCENT_CYAN} icon={Droplets} perPoint={`+${UE5.maxManaPerINT} Mana`} onChange={v => updateAlloc('int', v)} />
          </div>

          <div className="mt-3 pt-3 flex items-center justify-between text-xs font-mono" style={{ borderTop: `1px solid ${withOpacity(ACCENT, OPACITY_10)}` }}>
            <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">Unspent</span>
            <span className={remaining !== 0 ? 'font-bold' : ''} style={{ color: remaining > 0 ? STATUS_WARNING : remaining < 0 ? STATUS_ERROR : ACCENT_EMERALD }}>
              {remaining > 0 && <AlertTriangle className="w-3 h-3 inline mr-1" />}
              {remaining} pts
            </span>
          </div>
        </BlueprintPanel>

        {/* ── Optimal Allocation ── */}
        <BlueprintPanel color={STATUS_SUCCESS} className="p-4">
          <SectionHeader icon={Target} label="Optimal Allocation" color={STATUS_SUCCESS} />
          <div className="space-y-3">
            <AttrBar label="Strength" value={optimalAlloc.str} max={totalAvailable} color={STATUS_ERROR} icon={Swords} perPoint={`+${UE5.attackPowerPerSTR} AP`} />
            <AttrBar label="Dexterity" value={optimalAlloc.dex} max={totalAvailable} color={ACCENT_EMERALD} icon={Zap} perPoint={`+${(UE5.critChancePerDEX * 100).toFixed(1)}% Crit`} />
            <AttrBar label="Intelligence" value={optimalAlloc.int} max={totalAvailable} color={ACCENT_CYAN} icon={Droplets} perPoint={`+${UE5.maxManaPerINT} Mana`} />
          </div>

          <div className="mt-4 flex justify-center">
            <RadarChart data={optimalRadar} accent={STATUS_SUCCESS} size={140} overlays={[{ data: currentRadar, color: accentColor, label: 'Current' }]} />
          </div>
          <div className="flex justify-center gap-4 mt-2 text-xs">
            <span className="flex items-center gap-1"><span className="w-2 h-0.5 rounded" style={{ backgroundColor: STATUS_SUCCESS }} /> Optimal</span>
            <span className="flex items-center gap-1"><span className="w-2 h-0.5 rounded border border-dashed" style={{ borderColor: accentColor }} /> Current</span>
          </div>
        </BlueprintPanel>
      </div>
    </motion.div>
  );
}
