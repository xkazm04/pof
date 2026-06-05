'use client';

import { TrendingUp, AlertTriangle } from 'lucide-react';
import {
  STATUS_SUCCESS, STATUS_ERROR,
  ACCENT_CYAN, ACCENT_ORANGE, ACCENT_EMERALD, ACCENT_VIOLET,
  OPACITY_15,
} from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '../../unique-tabs/_design';
import { LevelSweepChart, LEVEL_SWEEP_METRICS } from './LevelSweepChart';
import type { LevelSweepPoint, LevelSweepConfig } from './data';
import { TEXT_SCALE } from '@/lib/typography-scale';

interface Props {
  show: boolean;
  points: LevelSweepPoint[] | null;
  breakpoints: { level: number; reason: string }[];
  running: boolean;
  config: LevelSweepConfig;
  setConfig: React.Dispatch<React.SetStateAction<LevelSweepConfig>>;
  onRun: () => void;
}

export function LevelSweepPanel({ show, points, breakpoints, running, config, setConfig, onRun }: Props) {
  return (
    <BlueprintPanel color={ACCENT_VIOLET} className="p-3">
      <div className="flex items-center justify-between">
        <SectionHeader icon={TrendingUp} label="Level Scaling Curve Sweep" color={ACCENT_VIOLET} />
        <button onClick={onRun} disabled={running}
          className="text-2xs px-2 py-1 rounded-md border border-border/40 hover:border-border text-text-muted hover:text-text transition-colors disabled:opacity-50">
          {running ? 'Sweeping...' : 'Run Sweep'}
        </button>
      </div>
      <p className={`${TEXT_SCALE.body} text-text-muted mt-0.5 mb-2`}>
        Simulates combat across player levels {config.minLevel}\u2013{config.maxLevel}, plotting TTK, DPS, survival rate, and EHP. Red zones indicate balance breakpoints.
      </p>

      {/* Sweep config */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
        <div>
          <label className="text-2xs text-text-muted block mb-0.5">Level Range</label>
          <div className="flex items-center gap-1">
            <input type="number" min={1} max={49} value={config.minLevel}
              onChange={e => setConfig(c => ({ ...c, minLevel: Math.max(1, Math.min(c.maxLevel - 1, Number(e.target.value))) }))}
              className="w-12 bg-surface-deep border border-border/40 rounded px-1 py-0.5 text-2xs font-mono text-text text-center" />
            <span className="text-2xs text-text-muted">\u2013</span>
            <input type="number" min={2} max={50} value={config.maxLevel}
              onChange={e => setConfig(c => ({ ...c, maxLevel: Math.max(c.minLevel + 1, Math.min(50, Number(e.target.value))) }))}
              className="w-12 bg-surface-deep border border-border/40 rounded px-1 py-0.5 text-2xs font-mono text-text text-center" />
          </div>
        </div>
        <div>
          <label className="text-2xs text-text-muted block mb-0.5">Enemy Scaling</label>
          <select value={config.enemyScaling}
            onChange={e => setConfig(c => ({ ...c, enemyScaling: e.target.value as LevelSweepConfig['enemyScaling'] }))}
            className="w-full bg-surface-deep border border-border/40 rounded px-1 py-0.5 text-2xs text-text">
            <option value="match">Match Player</option>
            <option value="fixed">Fixed Level</option>
            <option value="offset">Level Offset</option>
          </select>
        </div>
        {config.enemyScaling === 'offset' && (
          <div>
            <label className="text-2xs text-text-muted block mb-0.5">Level Offset</label>
            <input type="number" min={-20} max={20} value={config.enemyLevelOffset}
              onChange={e => setConfig(c => ({ ...c, enemyLevelOffset: Number(e.target.value) }))}
              className="w-full bg-surface-deep border border-border/40 rounded px-1 py-0.5 text-2xs font-mono text-text text-center" />
          </div>
        )}
        <div>
          <label className="text-2xs text-text-muted block mb-0.5">Iter/Level</label>
          <input type="number" min={50} max={2000} step={50} value={config.iterationsPerLevel}
            onChange={e => setConfig(c => ({ ...c, iterationsPerLevel: Math.max(50, Number(e.target.value)) }))}
            className="w-full bg-surface-deep border border-border/40 rounded px-1 py-0.5 text-2xs font-mono text-text text-center" />
        </div>
      </div>

      {show && points && points.length > 0 && (
        <div className="space-y-3">
          {/* Legend */}
          <div className="flex items-center gap-3 flex-wrap">
            {LEVEL_SWEEP_METRICS.map(m => (
              <div key={m.label} className="flex items-center gap-1">
                <div className="w-3 h-0.5 rounded" style={{ backgroundColor: m.color }} />
                <span className="text-2xs" style={{ color: m.color }}>{m.label}</span>
              </div>
            ))}
            {breakpoints.length > 0 && (
              <div className="flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" style={{ color: STATUS_ERROR }} />
                <span className="text-2xs" style={{ color: STATUS_ERROR }}>
                  {breakpoints.length} breakpoint{breakpoints.length !== 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>

          {/* Chart */}
          <div className="overflow-x-auto">
            <LevelSweepChart points={points} breakpoints={breakpoints}
              width={Math.max(600, (config.maxLevel - config.minLevel) * 14)} height={180} />
          </div>

          {/* Breakpoint details */}
          {breakpoints.length > 0 && (
            <div className="space-y-1">
              <span className="text-2xs font-semibold" style={{ color: STATUS_ERROR }}>Balance Breakpoints:</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                {breakpoints.slice(0, 9).map((bp, i) => (
                  <div key={i} className="flex items-center gap-1.5 px-2 py-1 rounded text-2xs font-mono"
                    style={{ backgroundColor: `${STATUS_ERROR}${OPACITY_15}` }}>
                    <AlertTriangle className="w-3 h-3 flex-shrink-0" style={{ color: STATUS_ERROR }} />
                    <span className="text-text">Lv.{bp.level}</span>
                    <span className="text-text-muted">{bp.reason}</span>
                  </div>
                ))}
                {breakpoints.length > 9 && (
                  <span className="text-2xs text-text-muted px-2 py-1">+{breakpoints.length - 9} more</span>
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
                {points.filter((_, i) => i % Math.max(1, Math.floor(points.length / 10)) === 0 || i === points.length - 1).map(p => {
                  const isBp = breakpoints.some(bp => bp.level === p.level);
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
  );
}
