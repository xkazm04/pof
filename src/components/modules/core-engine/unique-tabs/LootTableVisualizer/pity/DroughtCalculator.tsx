'use client';

import { useState, useMemo } from 'react';
import { Calculator } from 'lucide-react';
import {
  ACCENT_CYAN, OPACITY_6, OPACITY_8, OPACITY_30,
  STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, OVERLAY_WHITE,
  withOpacity, OPACITY_37,
} from '@/lib/chart-colors';
import { TabButtonGroup } from '../../_shared';
import { DROUGHT_RARITY_OPTIONS } from '../data';
import { cumulativeProbCurve, findPercentileKill } from '../math';
import { BlueprintPanel, SectionHeader } from '../design';

interface DroughtCalculatorProps {
  pityThreshold: number;
}

export function DroughtCalculator({ pityThreshold }: DroughtCalculatorProps) {
  const [droughtRarity, setDroughtRarity] = useState<number>(4);
  const [droughtPityEnabled, setDroughtPityEnabled] = useState(true);

  const droughtData = useMemo(() => {
    const opt = DROUGHT_RARITY_OPTIONS[droughtRarity];
    const rate = opt.dropRate;
    const pity = droughtPityEnabled ? pityThreshold : null;
    const maxKills = Math.min(Math.max(Math.ceil(5 / rate), 50), 500);
    const curve = cumulativeProbCurve(rate, maxKills, pity);
    const expectedDry = Math.round(1 / rate);
    const p50 = findPercentileKill(rate, 50, null);
    const p95 = findPercentileKill(rate, 95, null);
    const p99 = findPercentileKill(rate, 99, null);
    const p95Pity = findPercentileKill(rate, 95, pity);
    const p99Pity = findPercentileKill(rate, 99, pity);
    return { opt, rate, pity, maxKills, curve, expectedDry, p50, p95, p99, p95Pity, p99Pity };
  }, [droughtRarity, droughtPityEnabled, pityThreshold]);

  return (
    <BlueprintPanel className="p-3">
      <SectionHeader icon={Calculator} label="Drought Streak Calculator" color={droughtData.opt.color} />
      <div className="text-2xs font-mono text-text-muted mb-3">P(drop) = {(droughtData.rate * 100).toFixed(1)}%</div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <TabButtonGroup
          items={DROUGHT_RARITY_OPTIONS.map((opt, i) => ({ value: String(i), label: opt.name, color: opt.color }))}
          selected={String(droughtRarity)}
          onSelect={(v) => setDroughtRarity(Number(v))}
          accent={droughtData.opt.color}
          ariaLabel="Drought calculator rarity selection"
        />
        <button onClick={() => setDroughtPityEnabled(v => !v)} className="text-2xs font-mono px-2 py-0.5 rounded border transition-all hover:opacity-80 ml-auto cursor-pointer"
          style={{ borderColor: droughtPityEnabled ? withOpacity(STATUS_SUCCESS, OPACITY_30) : 'var(--border)', backgroundColor: droughtPityEnabled ? withOpacity(STATUS_SUCCESS, OPACITY_8) : 'transparent', color: droughtPityEnabled ? STATUS_SUCCESS : 'var(--text-muted)' }}>
          {droughtPityEnabled ? `Pity @ ${pityThreshold}` : 'No Pity'}
        </button>
      </div>

      {/* Key stats row */}
      <div className="grid grid-cols-4 gap-2 mb-3">
        {[
          { label: 'Expected Dry', value: `${droughtData.expectedDry} kills`, color: droughtData.opt.color },
          { label: 'Median (P50)', value: `${droughtData.p50} kills`, color: ACCENT_CYAN },
          { label: 'P95 Worst', value: `${droughtPityEnabled ? droughtData.p95Pity : droughtData.p95} kills`, color: STATUS_WARNING },
          { label: 'P99 Worst', value: `${droughtPityEnabled ? droughtData.p99Pity : droughtData.p99} kills`, color: STATUS_ERROR },
        ].map(stat => (
          <div key={stat.label} className="text-center p-1.5 rounded border" style={{ borderColor: withOpacity(stat.color, OPACITY_30), backgroundColor: withOpacity(stat.color, OPACITY_8) }}>
            <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">{stat.label}</div>
            <div className="text-xs font-mono font-bold" style={{ color: stat.color }}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Cumulative probability curve SVG */}
      <div className="relative min-h-[200px] bg-surface-deep/30 rounded-lg p-2">
        <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted mb-1">{'Cumulative P(\u22651 drop) vs Kill Count'}</div>
        <svg viewBox="0 0 400 180" className="w-full" role="img" aria-label={`Cumulative probability curve for ${droughtData.opt.name} rarity drops over ${droughtData.maxKills} kills`}>
          <title>Drought Streak Probability Curve</title>
          <desc>Shows the probability of receiving at least one drop as kill count increases, with and without pity timer.</desc>
          {[0.25, 0.5, 0.75, 1.0].map(pct => (
            <g key={pct}>
              <line x1={40} y1={160 - pct * 140} x2={390} y2={160 - pct * 140} stroke={withOpacity(OVERLAY_WHITE, OPACITY_6)} strokeWidth="0.5" />
              <text x={36} y={160 - pct * 140 + 3} textAnchor="end" className="text-xs font-mono" fill="var(--text-muted)">{Math.round(pct * 100)}%</text>
            </g>
          ))}
          {Array.from({ length: 5 }, (_, i) => {
            const kill = Math.round((droughtData.maxKills / 4) * i);
            const x = 40 + (kill / droughtData.maxKills) * 350;
            return <text key={i} x={x} y={175} textAnchor="middle" className="text-xs font-mono" fill="var(--text-muted)">{kill}</text>;
          })}
          <polyline fill="none" stroke={droughtData.opt.color} strokeWidth="1.5" strokeDasharray="4 3" opacity={droughtPityEnabled ? 0.35 : 0.8}
            points={droughtData.curve.map(p => `${40 + (p.kill / droughtData.maxKills) * 350},${160 - p.probNoPity * 140}`).join(' ')} />
          {droughtPityEnabled && (
            <polyline fill="none" stroke={droughtData.opt.color} strokeWidth="2"
              points={droughtData.curve.map(p => `${40 + (p.kill / droughtData.maxKills) * 350},${160 - p.probWithPity * 140}`).join(' ')}
              style={{ filter: `drop-shadow(0 0 3px ${withOpacity(droughtData.opt.color, OPACITY_37)})` }} />
          )}
          {droughtPityEnabled && droughtData.pity && droughtData.pity <= droughtData.maxKills && (
            <g>
              <line x1={40 + (droughtData.pity / droughtData.maxKills) * 350} y1={18} x2={40 + (droughtData.pity / droughtData.maxKills) * 350} y2={160} stroke={STATUS_SUCCESS} strokeWidth="1" strokeDasharray="3 2" opacity={0.6} />
              <text x={40 + (droughtData.pity / droughtData.maxKills) * 350} y={14} textAnchor="middle" className="text-xs font-mono font-bold" fill={STATUS_SUCCESS}>Pity@{droughtData.pity}</text>
            </g>
          )}
          {[
            { label: 'P50', kill: droughtData.p50, pct: 0.5, color: ACCENT_CYAN },
            { label: 'P95', kill: droughtPityEnabled ? droughtData.p95Pity : droughtData.p95, pct: 0.95, color: STATUS_WARNING },
            { label: 'P99', kill: droughtPityEnabled ? droughtData.p99Pity : droughtData.p99, pct: 0.99, color: STATUS_ERROR },
          ].filter(a => a.kill <= droughtData.maxKills).map(ann => {
            const x = 40 + (ann.kill / droughtData.maxKills) * 350;
            const y = 160 - ann.pct * 140;
            return (
              <g key={ann.label}>
                <circle cx={x} cy={y} r={3} fill={ann.color} opacity={0.8} />
                <text x={x} y={y - 6} textAnchor="middle" className="text-xs font-mono font-bold" fill={ann.color}>{ann.label} ({ann.kill})</text>
              </g>
            );
          })}
          <text x={215} y={175} textAnchor="middle" className="text-xs font-mono" fill="var(--text-muted)">Kills</text>
        </svg>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-1 text-2xs font-mono text-text-muted">
        {droughtPityEnabled && (
          <>
            <span className="flex items-center gap-1"><span className="inline-block w-4 h-0.5 rounded" style={{ backgroundColor: droughtData.opt.color }} /> With Pity</span>
            <span className="flex items-center gap-1"><span className="inline-block w-4 h-0.5 rounded opacity-40" style={{ backgroundColor: droughtData.opt.color, borderTop: '1px dashed' }} /> No Pity</span>
          </>
        )}
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: ACCENT_CYAN }} /> P50</span>
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: STATUS_WARNING }} /> P95</span>
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: STATUS_ERROR }} /> P99</span>
      </div>

      {/* Interpretation */}
      <div className="mt-2 p-2 rounded border text-2xs font-mono" style={{ borderColor: withOpacity(droughtData.opt.color, OPACITY_30), backgroundColor: withOpacity(droughtData.opt.color, OPACITY_8) }}>
        <span style={{ color: droughtData.opt.color }} className="font-bold">{droughtData.opt.name}</span>
        <span className="text-text-muted"> &mdash; {(droughtData.rate * 100).toFixed(1)}% per kill. </span>
        <span className="text-text-muted">50% of players get a drop within </span>
        <span className="text-text font-bold">{droughtData.p50}</span>
        <span className="text-text-muted"> kills. 99% within </span>
        <span className="text-text font-bold">{droughtPityEnabled ? droughtData.p99Pity : droughtData.p99}</span>
        <span className="text-text-muted"> kills{droughtPityEnabled ? ` (pity caps at ${pityThreshold})` : ''}.</span>
      </div>
    </BlueprintPanel>
  );
}
