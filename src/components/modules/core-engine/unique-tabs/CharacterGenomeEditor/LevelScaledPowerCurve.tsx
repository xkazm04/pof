'use client';

import { useState, useMemo, useCallback, useRef } from 'react';
import { TrendingUp } from 'lucide-react';
import { ACCENT_VIOLET, STATUS_SUCCESS } from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader, NeonBar } from '../_design';
import type { CharacterGenome } from '@/types/character-genome';
import type { PowerCurveStat } from './types';
import { POWER_CURVE_TABS } from './field-data';
import { getScaledStat, findPowerCurveCrossovers } from './sim-engine';

const PC_W = 600, PC_H = 240;
const PC_M = { t: 12, r: 16, b: 28, l: 52 };
const PC_PW = PC_W - PC_M.l - PC_M.r;
const PC_PH = PC_H - PC_M.t - PC_M.b;

export function LevelScaledPowerCurve({ genomes, activeId }: {
  genomes: CharacterGenome[];
  activeId: string;
}) {
  const [selectedStat, setSelectedStat] = useState<PowerCurveStat>('power');
  const [previewLevel, setPreviewLevel] = useState(50);
  const [hoverLevel, setHoverLevel] = useState<number | null>(null);
  const chartRef = useRef<SVGSVGElement>(null);
  const displayLevel = hoverLevel ?? previewLevel;

  const maxVal = useMemo(() => {
    let max = 0;
    for (const g of genomes) {
      const v = getScaledStat(g, selectedStat, 100);
      if (v > max) max = v;
    }
    return Math.max(max * 1.08, 1);
  }, [genomes, selectedStat]);

  const crossovers = useMemo(() => findPowerCurveCrossovers(genomes, selectedStat), [genomes, selectedStat]);
  const xScale = useCallback((level: number) => ((level - 1) / 99) * PC_PW, []);
  const yScale = useCallback((val: number) => PC_PH - (val / maxVal) * PC_PH, [maxVal]);

  const yTicks = useMemo(() => {
    const rawStep = maxVal / 5;
    if (rawStep <= 0) return [0];
    const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const norm = rawStep / mag;
    const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
    const step = nice * mag;
    const ticks: number[] = [];
    for (let v = 0; v <= maxVal + step * 0.01; v += step) ticks.push(Math.round(v));
    return ticks;
  }, [maxVal]);

  const paths = useMemo(() => genomes.map((g) => {
    const pts: string[] = [];
    for (let l = 1; l <= 100; l++) {
      const x = xScale(l), y = yScale(getScaledStat(g, selectedStat, l));
      pts.push(`${l === 1 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`);
    }
    return { id: g.id, color: g.color, d: pts.join(' ') };
  }), [genomes, selectedStat, xScale, yScale]);

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const svg = chartRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const plotX = ((e.clientX - rect.left) / rect.width) * PC_W - PC_M.l;
    if (plotX < 0 || plotX > PC_PW) { setHoverLevel(null); return; }
    setHoverLevel(Math.max(1, Math.min(100, Math.round((plotX / PC_PW) * 99 + 1))));
  }, []);

  const fmtTick = useCallback((v: number) => v >= 10000 ? `${(v / 1000).toFixed(0)}k` : v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v), []);
  const fmtVal = useCallback((v: number) => v >= 10000 ? `${(v / 1000).toFixed(1)}k` : v >= 100 ? v.toFixed(0) : v.toFixed(1), []);

  const levelStats = useMemo(() =>
    genomes.map((g) => ({ id: g.id, name: g.name, color: g.color, value: getScaledStat(g, selectedStat, displayLevel), isActive: g.id === activeId }))
      .sort((a, b) => b.value - a.value),
    [genomes, selectedStat, displayLevel, activeId],
  );

  const tabInfo = POWER_CURVE_TABS.find((s) => s.key === selectedStat)!;

  return (
    <BlueprintPanel color={ACCENT_VIOLET} className="p-3">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <SectionHeader icon={TrendingUp} label="Level-Scaled Power Curve" color={ACCENT_VIOLET} />
          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded" style={{ backgroundColor: `${tabInfo.color}15`, color: tabInfo.color }}>
            Lv.{displayLevel}
          </span>
        </div>

        <div className="flex gap-1 flex-wrap">
          {POWER_CURVE_TABS.map((s) => (
            <button key={s.key} onClick={() => setSelectedStat(s.key)}
              className="px-2.5 py-1 rounded-lg text-xs font-bold transition-all duration-200"
              style={{
                backgroundColor: selectedStat === s.key ? `${s.color}20` : 'transparent',
                color: selectedStat === s.key ? s.color : 'var(--text-muted)',
                border: `1px solid ${selectedStat === s.key ? `${s.color}50` : 'rgba(255,255,255,0.08)'}`,
              }}>
              {s.label}
            </button>
          ))}
        </div>

        <div className="w-full overflow-hidden rounded-lg bg-surface-deep/50 border" style={{ borderColor: `${ACCENT_VIOLET}25` }}>
          <svg ref={chartRef} viewBox={`0 0 ${PC_W} ${PC_H}`} className="w-full" style={{ height: 'auto' }}
            onMouseMove={handleMouseMove} onMouseLeave={() => setHoverLevel(null)}>
            <g transform={`translate(${PC_M.l},${PC_M.t})`}>
              {yTicks.map((tick) => (
                <g key={tick}>
                  <line x1={0} y1={yScale(tick)} x2={PC_PW} y2={yScale(tick)} stroke="rgba(255,255,255,0.06)" strokeWidth={0.5} />
                  <text x={-8} y={yScale(tick) + 3} textAnchor="end" fill="rgba(255,255,255,0.35)" fontSize={9} fontFamily="monospace">{fmtTick(tick)}</text>
                </g>
              ))}
              {[1, 25, 50, 75, 100].map((l) => (
                <text key={l} x={xScale(l)} y={PC_PH + 18} textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize={9} fontFamily="monospace">{l}</text>
              ))}
              {paths.map((p) => (
                <path key={p.id} d={p.d} fill="none" stroke={p.color} strokeWidth={p.id === activeId ? 2.5 : 1.5} strokeOpacity={p.id === activeId ? 1 : 0.6} strokeLinecap="round" />
              ))}
              {crossovers.map((cp, i) => {
                const cx = xScale(cp.level), cy = yScale(cp.value);
                return (
                  <g key={i}>
                    <circle cx={cx} cy={cy} r={5} fill="rgba(0,0,0,0.5)" stroke="rgba(255,255,255,0.9)" strokeWidth={1.5} />
                    <text x={cx} y={cy - 9} textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize={8} fontFamily="monospace" fontWeight="bold">Lv.{Math.round(cp.level)}</text>
                  </g>
                );
              })}
              <line x1={xScale(displayLevel)} y1={0} x2={xScale(displayLevel)} y2={PC_PH} stroke="rgba(255,255,255,0.25)" strokeWidth={1} strokeDasharray="3,3" />
              {genomes.map((g) => (
                <circle key={g.id} cx={xScale(displayLevel)} cy={yScale(getScaledStat(g, selectedStat, displayLevel))}
                  r={g.id === activeId ? 4 : 3} fill={g.color} stroke="rgba(0,0,0,0.3)" strokeWidth={1} />
              ))}
            </g>
          </svg>
        </div>

        <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-surface-deep/50 border" style={{ borderColor: `${ACCENT_VIOLET}25` }}>
          <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted w-10">Lv.</span>
          <div className="flex-1 relative h-5 flex items-center">
            <div className="absolute inset-x-0 h-1.5 bg-surface rounded-full" />
            <NeonBar pct={((previewLevel - 1) / 99) * 100} color={ACCENT_VIOLET} height={6} glow />
            <input type="range" min={1} max={100} step={1} value={previewLevel} onChange={(e) => setPreviewLevel(parseInt(e.target.value))} className="absolute inset-0 w-full opacity-0 cursor-pointer" />
            <div className="absolute w-3 h-3 rounded-full border-2 border-surface shadow-md pointer-events-none" style={{ left: `calc(${((previewLevel - 1) / 99) * 100}% - 6px)`, backgroundColor: ACCENT_VIOLET }} />
          </div>
          <input type="number" min={1} max={100} value={previewLevel}
            onChange={(e) => { const v = parseInt(e.target.value); if (!isNaN(v) && v >= 1 && v <= 100) setPreviewLevel(v); }}
            className="w-12 text-xs font-mono font-bold text-center bg-surface border border-border/40 rounded px-1 py-0.5 text-text focus:outline-none focus:border-blue-500/50" />
          <span className="text-[10px] font-mono text-text-muted/50">/ 100</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-1.5">
          {levelStats.map(({ id, name, color, value, isActive }, idx) => (
            <div key={id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border transition-colors"
              style={{ borderColor: isActive ? `${color}50` : `${color}08`, backgroundColor: isActive ? `${color}10` : 'transparent' }}>
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
              <span className="text-xs font-mono font-bold truncate" style={{ color, textShadow: `0 0 12px ${color}40` }}>{name}</span>
              <span className="ml-auto text-xs font-mono font-bold text-text whitespace-nowrap">{fmtVal(value)}</span>
              {idx === 0 && levelStats.length > 1 && (
                <span className="text-[10px] font-bold px-1 py-0.5 rounded" style={{ backgroundColor: `${STATUS_SUCCESS}15`, color: STATUS_SUCCESS }}>#1</span>
              )}
            </div>
          ))}
        </div>

        {crossovers.length > 0 && (
          <div className="pt-2 border-t" style={{ borderColor: `${ACCENT_VIOLET}20` }}>
            <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted">Crossover Points</span>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {crossovers.map((cp, i) => (
                <button key={i} onClick={() => setPreviewLevel(Math.round(cp.level))}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-mono border bg-surface-deep/50 hover:bg-surface/30 transition-colors"
                  style={{ borderColor: `${ACCENT_VIOLET}25` }}>
                  <span className="font-bold text-text">Lv.{Math.round(cp.level)}</span>
                  <span className="text-text-muted">{'\u2014'}</span>
                  <span style={{ color: cp.colorA }}>{cp.nameA}</span>
                  <span className="text-text-muted">{'\u2248'}</span>
                  <span style={{ color: cp.colorB }}>{cp.nameB}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </BlueprintPanel>
  );
}
