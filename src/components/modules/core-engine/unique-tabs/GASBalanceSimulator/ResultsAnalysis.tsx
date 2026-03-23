'use client';

import { useState, useCallback } from 'react';
import { TrendingDown, TrendingUp, AlertTriangle } from 'lucide-react';
import {
  STATUS_SUCCESS, STATUS_ERROR, STATUS_WARNING,
  ACCENT_CYAN, ACCENT_ORANGE, ACCENT_EMERALD, ACCENT_VIOLET,
  MODULE_COLORS, OPACITY_15,
} from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '../_design';
import { SensitivityChart } from './SensitivityChart';
import { LevelSweepChart, LEVEL_SWEEP_METRICS } from './LevelSweepChart';
import { runSensitivity, runLevelSweep, detectBreakpoints } from './simulation';
import type { SimScenario, SimResults, SensitivityResult, LevelSweepPoint, LevelSweepConfig, CombatantStats } from './data';
import { ACCENT, DEFAULT_SWEEP_CONFIG } from './data';

export function ResultsAnalysis({ scenario }: { scenario: SimScenario }) {
  const [showSensitivity, setShowSensitivity] = useState(false);
  const [sensitivityResults, setSensitivityResults] = useState<SensitivityResult[]>([]);
  const [runningSensitivity, setRunningSensitivity] = useState(false);

  const [sweepConfig, setSweepConfig] = useState<LevelSweepConfig>({ ...DEFAULT_SWEEP_CONFIG });
  const [sweepPoints, setSweepPoints] = useState<LevelSweepPoint[] | null>(null);
  const [sweepBreakpoints, setSweepBreakpoints] = useState<{ level: number; reason: string }[]>([]);
  const [runningSweep, setRunningSweep] = useState(false);
  const [showSweep, setShowSweep] = useState(false);

  const runSensitivityAnalysis = useCallback(() => {
    setRunningSensitivity(true);
    requestAnimationFrame(() => {
      const attrs: { key: keyof CombatantStats; min: number; max: number }[] = [
        { key: 'strength', min: 5, max: 100 },
        { key: 'armor', min: 0, max: 200 },
        { key: 'criticalChance', min: 0, max: 0.8 },
        { key: 'attackPower', min: 10, max: 300 },
        { key: 'baseDamage', min: 10, max: 200 },
      ];
      const newResults = attrs.map(a => runSensitivity(scenario, a.key, { min: a.min, max: a.max, steps: 12 }));
      setSensitivityResults(newResults);
      setRunningSensitivity(false);
      setShowSensitivity(true);
    });
  }, [scenario]);

  const runLevelSweepAnalysis = useCallback(() => {
    setRunningSweep(true);
    requestAnimationFrame(() => {
      const pts = runLevelSweep(scenario, sweepConfig);
      const bps = detectBreakpoints(pts);
      setSweepPoints(pts);
      setSweepBreakpoints(bps);
      setRunningSweep(false);
      setShowSweep(true);
    });
  }, [scenario, sweepConfig]);

  const sensColors: Record<string, string> = {
    strength: ACCENT_ORANGE, armor: MODULE_COLORS.core,
    criticalChance: STATUS_WARNING, attackPower: STATUS_ERROR, baseDamage: ACCENT_CYAN,
  };

  return (
    <div className="space-y-4">
      {/* Sensitivity Analysis */}
      <BlueprintPanel color={ACCENT_VIOLET} className="p-3">
        <div className="flex items-center justify-between">
          <SectionHeader icon={TrendingDown} label="Attribute Sensitivity Analysis" color={ACCENT_VIOLET} />
          <button onClick={runSensitivityAnalysis} disabled={runningSensitivity}
            className="text-2xs px-2 py-1 rounded-md border border-border/40 hover:border-border text-text-muted hover:text-text transition-colors disabled:opacity-50">
            {runningSensitivity ? 'Running...' : 'Run Analysis'}
          </button>
        </div>
        <p className="text-2xs text-text-muted mt-0.5 mb-2">
          Sweeps each attribute across its range (500 iterations per point) to identify diminishing returns and optimal breakpoints.
        </p>
        {showSensitivity && sensitivityResults.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3 mt-2">
            {sensitivityResults.map(sr => {
              const c = sensColors[sr.attribute] ?? ACCENT;
              return (
                <BlueprintPanel key={sr.attribute} color={c} className="p-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-2xs font-bold capitalize" style={{ color: c }}>{sr.attribute}</span>
                    {sr.diminishingAt !== null && (
                      <span className="text-2xs flex items-center gap-0.5" style={{ color: STATUS_WARNING }}>
                        <AlertTriangle className="w-3 h-3" /> DR at {sr.diminishingAt.toFixed(0)}
                      </span>
                    )}
                  </div>
                  <SensitivityChart result={sr} color={c} />
                  <div className="text-2xs text-text-muted text-center mt-0.5">DPS vs {sr.attribute}</div>
                </BlueprintPanel>
              );
            })}
          </div>
        )}
      </BlueprintPanel>

      {/* Level Sweep */}
      <BlueprintPanel color={ACCENT_VIOLET} className="p-3">
        <div className="flex items-center justify-between">
          <SectionHeader icon={TrendingUp} label="Level Scaling Curve Sweep" color={ACCENT_VIOLET} />
          <button onClick={runLevelSweepAnalysis} disabled={runningSweep}
            className="text-2xs px-2 py-1 rounded-md border border-border/40 hover:border-border text-text-muted hover:text-text transition-colors disabled:opacity-50">
            {runningSweep ? 'Sweeping...' : 'Run Sweep'}
          </button>
        </div>
        <p className="text-2xs text-text-muted mt-0.5 mb-2">
          Simulates combat across player levels {sweepConfig.minLevel}\u2013{sweepConfig.maxLevel}, plotting TTK, DPS, survival rate, and EHP. Red zones indicate balance breakpoints.
        </p>

        {/* Sweep config */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          <div>
            <label className="text-2xs text-text-muted block mb-0.5">Level Range</label>
            <div className="flex items-center gap-1">
              <input type="number" min={1} max={49} value={sweepConfig.minLevel}
                onChange={e => setSweepConfig(c => ({ ...c, minLevel: Math.max(1, Math.min(c.maxLevel - 1, Number(e.target.value))) }))}
                className="w-12 bg-surface-deep border border-border/40 rounded px-1 py-0.5 text-2xs font-mono text-text text-center" />
              <span className="text-2xs text-text-muted">\u2013</span>
              <input type="number" min={2} max={50} value={sweepConfig.maxLevel}
                onChange={e => setSweepConfig(c => ({ ...c, maxLevel: Math.max(c.minLevel + 1, Math.min(50, Number(e.target.value))) }))}
                className="w-12 bg-surface-deep border border-border/40 rounded px-1 py-0.5 text-2xs font-mono text-text text-center" />
            </div>
          </div>
          <div>
            <label className="text-2xs text-text-muted block mb-0.5">Enemy Scaling</label>
            <select value={sweepConfig.enemyScaling}
              onChange={e => setSweepConfig(c => ({ ...c, enemyScaling: e.target.value as LevelSweepConfig['enemyScaling'] }))}
              className="w-full bg-surface-deep border border-border/40 rounded px-1 py-0.5 text-2xs text-text">
              <option value="match">Match Player</option>
              <option value="fixed">Fixed Level</option>
              <option value="offset">Level Offset</option>
            </select>
          </div>
          {sweepConfig.enemyScaling === 'offset' && (
            <div>
              <label className="text-2xs text-text-muted block mb-0.5">Level Offset</label>
              <input type="number" min={-20} max={20} value={sweepConfig.enemyLevelOffset}
                onChange={e => setSweepConfig(c => ({ ...c, enemyLevelOffset: Number(e.target.value) }))}
                className="w-full bg-surface-deep border border-border/40 rounded px-1 py-0.5 text-2xs font-mono text-text text-center" />
            </div>
          )}
          <div>
            <label className="text-2xs text-text-muted block mb-0.5">Iter/Level</label>
            <input type="number" min={50} max={2000} step={50} value={sweepConfig.iterationsPerLevel}
              onChange={e => setSweepConfig(c => ({ ...c, iterationsPerLevel: Math.max(50, Number(e.target.value)) }))}
              className="w-full bg-surface-deep border border-border/40 rounded px-1 py-0.5 text-2xs font-mono text-text text-center" />
          </div>
        </div>

        {showSweep && sweepPoints && sweepPoints.length > 0 && (
          <div className="space-y-3">
            {/* Legend */}
            <div className="flex items-center gap-3 flex-wrap">
              {LEVEL_SWEEP_METRICS.map(m => (
                <div key={m.label} className="flex items-center gap-1">
                  <div className="w-3 h-0.5 rounded" style={{ backgroundColor: m.color }} />
                  <span className="text-2xs" style={{ color: m.color }}>{m.label}</span>
                </div>
              ))}
              {sweepBreakpoints.length > 0 && (
                <div className="flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" style={{ color: STATUS_ERROR }} />
                  <span className="text-2xs" style={{ color: STATUS_ERROR }}>
                    {sweepBreakpoints.length} breakpoint{sweepBreakpoints.length !== 1 ? 's' : ''}
                  </span>
                </div>
              )}
            </div>

            {/* Chart */}
            <div className="overflow-x-auto">
              <LevelSweepChart points={sweepPoints} breakpoints={sweepBreakpoints}
                width={Math.max(600, (sweepConfig.maxLevel - sweepConfig.minLevel) * 14)} height={180} />
            </div>

            {/* Breakpoint details */}
            {sweepBreakpoints.length > 0 && (
              <div className="space-y-1">
                <span className="text-2xs font-semibold" style={{ color: STATUS_ERROR }}>Balance Breakpoints:</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                  {sweepBreakpoints.slice(0, 9).map((bp, i) => (
                    <div key={i} className="flex items-center gap-1.5 px-2 py-1 rounded text-2xs font-mono"
                      style={{ backgroundColor: `${STATUS_ERROR}${OPACITY_15}` }}>
                      <AlertTriangle className="w-3 h-3 flex-shrink-0" style={{ color: STATUS_ERROR }} />
                      <span className="text-text">Lv.{bp.level}</span>
                      <span className="text-text-muted">{bp.reason}</span>
                    </div>
                  ))}
                  {sweepBreakpoints.length > 9 && (
                    <span className="text-2xs text-text-muted px-2 py-1">+{sweepBreakpoints.length - 9} more</span>
                  )}
                </div>
              </div>
            )}

            {/* Summary table */}
            <div className="overflow-x-auto">
              <table className="w-full text-2xs font-mono">
                <thead>
                  <tr className="border-b border-border/30">
                    <th className="text-left text-text-muted py-1 px-1">Level</th>
                    <th className="text-right py-1 px-1" style={{ color: ACCENT_CYAN }}>TTK</th>
                    <th className="text-right py-1 px-1" style={{ color: ACCENT_ORANGE }}>DPS</th>
                    <th className="text-right py-1 px-1" style={{ color: STATUS_SUCCESS }}>Survival</th>
                    <th className="text-right py-1 px-1" style={{ color: ACCENT_EMERALD }}>EHP</th>
                  </tr>
                </thead>
                <tbody>
                  {sweepPoints.filter((_, i) => i % Math.max(1, Math.floor(sweepPoints.length / 10)) === 0 || i === sweepPoints.length - 1).map(p => {
                    const isBp = sweepBreakpoints.some(bp => bp.level === p.level);
                    return (
                      <tr key={p.level} className="border-b border-border/10" style={isBp ? { backgroundColor: `${STATUS_ERROR}${OPACITY_15}` } : undefined}>
                        <td className="py-0.5 px-1 text-text">{p.level}</td>
                        <td className="py-0.5 px-1 text-right" style={{ color: ACCENT_CYAN }}>{p.ttk.toFixed(1)}s</td>
                        <td className="py-0.5 px-1 text-right" style={{ color: ACCENT_ORANGE }}>{p.dps.toFixed(0)}</td>
                        <td className="py-0.5 px-1 text-right" style={{ color: p.survivalRate > 0.5 ? STATUS_SUCCESS : STATUS_ERROR }}>
                          {(p.survivalRate * 100).toFixed(0)}%
                        </td>
                        <td className="py-0.5 px-1 text-right" style={{ color: ACCENT_EMERALD }}>{p.ehp.toFixed(0)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </BlueprintPanel>
    </div>
  );
}
