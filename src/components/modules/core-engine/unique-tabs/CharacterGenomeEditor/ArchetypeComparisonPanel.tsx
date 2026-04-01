'use client';

import { useState } from 'react';
import { GitCompareArrows } from 'lucide-react';
import { STATUS_SUCCESS, STATUS_ERROR } from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '../_design';
import { RadarChart } from '../_shared';
import type { CharacterGenome } from '@/types/character-genome';
import type { RadarDataPoint } from '@/types/unique-tab-improvements';
import { ACCENT, COMPARISON_AXES } from './field-data';

/* ── Archetype Comparison Panel ────────────────────────────────────────── */

export function ArchetypeComparisonPanel({ genomes, activeGenome: _activeGenome }: {
  genomes: CharacterGenome[];
  activeGenome: CharacterGenome;
}) {
  const [leftId, setLeftId] = useState(genomes[0]?.id ?? '');
  const [rightId, setRightId] = useState(genomes[1]?.id ?? genomes[0]?.id ?? '');

  const leftGenome = genomes.find((g) => g.id === leftId) ?? genomes[0];
  const rightGenome = genomes.find((g) => g.id === rightId) ?? (genomes[1] ?? genomes[0]);

  if (genomes.length < 2) return null;

  const leftRadar: RadarDataPoint[] = COMPARISON_AXES.map((a) => ({
    axis: a.label, value: Math.min(a.getValue(leftGenome) / a.max, 1),
  }));
  const rightRadar: RadarDataPoint[] = COMPARISON_AXES.map((a) => ({
    axis: a.label, value: Math.min(a.getValue(rightGenome) / a.max, 1),
  }));

  const deltas = COMPARISON_AXES.map((axis) => {
    const lv = axis.getValue(leftGenome);
    const rv = axis.getValue(rightGenome);
    const diff = rv - lv;
    const pct = lv !== 0 ? ((diff / Math.abs(lv)) * 100) : (diff !== 0 ? 100 : 0);
    return { label: axis.label, unit: axis.unit, left: lv, right: rv, diff, pct, higherIsBetter: axis.higherIsBetter };
  });

  return (
    <BlueprintPanel color={ACCENT} className="p-3">
      <div className="space-y-4">
        <SectionHeader icon={GitCompareArrows} label="Archetype Comparison" color={ACCENT} />

        {/* Archetype Selectors */}
        <div className="flex items-center gap-2">
          <select value={leftId} onChange={(e) => setLeftId(e.target.value)}
            className="flex-1 text-xs font-mono font-bold bg-surface-deep border rounded-lg px-2 py-1.5 text-text focus:outline-none focus:border-blue-500/50"
            style={{ color: leftGenome.color, borderColor: `${leftGenome.color}25` }}>
            {genomes.map((g) => <option key={g.id} value={g.id} style={{ color: 'var(--text)' }}>{g.name}</option>)}
          </select>
          <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">vs</span>
          <select value={rightId} onChange={(e) => setRightId(e.target.value)}
            className="flex-1 text-xs font-mono font-bold bg-surface-deep border rounded-lg px-2 py-1.5 text-text focus:outline-none focus:border-blue-500/50"
            style={{ color: rightGenome.color, borderColor: `${rightGenome.color}25` }}>
            {genomes.map((g) => <option key={g.id} value={g.id} style={{ color: 'var(--text)' }}>{g.name}</option>)}
          </select>
        </div>

        {/* Overlaid Radar + Delta Badges */}
        <div className="flex flex-col xl:flex-row items-start gap-3">
          <div className="flex flex-col items-center flex-shrink-0">
            <RadarChart data={leftRadar} accent={leftGenome.color}
              overlays={[{ data: rightRadar, color: rightGenome.color, label: rightGenome.name }]} size={220} />
            <div className="flex gap-3 mt-2">
              <span className="flex items-center gap-1.5 text-xs font-mono font-bold" style={{ color: leftGenome.color }}>
                <span className="w-3 h-1 rounded-full" style={{ backgroundColor: leftGenome.color }} />
                {leftGenome.name}
              </span>
              <span className="flex items-center gap-1.5 text-xs font-mono font-bold" style={{ color: rightGenome.color }}>
                <span className="w-3 h-1 rounded-full opacity-70" style={{ backgroundColor: rightGenome.color }} />
                {rightGenome.name}
              </span>
            </div>
          </div>

          {/* Delta Badges */}
          <div className="flex-1 w-full">
            <div className="grid grid-cols-2 gap-1.5">
              {deltas.map((d) => {
                const isPositive = d.diff > 0;
                const isBetter = d.higherIsBetter ? isPositive : !isPositive;
                const badgeColor = d.diff === 0 ? 'var(--text-muted)' : isBetter ? STATUS_SUCCESS : STATUS_ERROR;
                const sign = d.diff > 0 ? '+' : '';
                return (
                  <div key={d.label} className="flex items-center justify-between p-1.5 rounded-lg border bg-surface-deep/30"
                    style={{ borderColor: `${badgeColor}20` }}>
                    <div className="flex flex-col">
                      <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">{d.label}</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs font-mono font-bold" style={{ color: leftGenome.color, textShadow: `0 0 12px ${leftGenome.color}40` }}>
                          {d.left % 1 !== 0 ? d.left.toFixed(1) : d.left}
                        </span>
                        <span className="text-xs text-text-muted">vs</span>
                        <span className="text-xs font-mono font-bold" style={{ color: rightGenome.color, textShadow: `0 0 12px ${rightGenome.color}40` }}>
                          {d.right % 1 !== 0 ? d.right.toFixed(1) : d.right}
                        </span>
                      </div>
                    </div>
                    {d.diff !== 0 && (
                      <span className="text-xs font-mono font-bold px-1.5 py-0.5 rounded-md whitespace-nowrap"
                        style={{ backgroundColor: `${badgeColor}15`, color: badgeColor, border: `1px solid ${badgeColor}30` }}>
                        {sign}{Math.abs(d.pct) >= 1 ? `${d.pct.toFixed(0)}%` : `${d.pct.toFixed(1)}%`}
                      </span>
                    )}
                    {d.diff === 0 && (
                      <span className="text-xs font-mono text-text-muted/50 px-1.5 py-0.5">{'\u2014'}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </BlueprintPanel>
  );
}
