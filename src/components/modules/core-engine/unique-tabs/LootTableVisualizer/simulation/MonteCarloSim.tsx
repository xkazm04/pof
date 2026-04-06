'use client';

import { useState, useCallback, useMemo } from 'react';
import { Dices } from 'lucide-react';
import { motion } from 'framer-motion';
import { TabButtonGroup } from '../../_shared';
import { RARITY_TIERS, TOTAL_WEIGHT } from '../data';
import { ACCENT_VIOLET, STATUS_WARNING, withOpacity, OPACITY_8, OPACITY_20 } from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '../design';

const MC_RUNS = 50;

function mcStats(vals: number[]) {
  const sorted = [...vals].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = sorted.reduce((s, v) => s + v, 0) / n;
  const median = n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)];
  const stddev = Math.sqrt(sorted.reduce((s, v) => s + (v - mean) ** 2, 0) / n);
  return { mean, median, stddev, min: sorted[0], max: sorted[n - 1] };
}

function buildBins(vals: number[], count: number) {
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const w = (hi - lo || 1) / count;
  const bins = Array.from({ length: count }, (_, i) => ({ lo: lo + i * w, hi: lo + (i + 1) * w, n: 0 }));
  for (const v of vals) { bins[Math.min(Math.floor((v - lo) / w), count - 1)].n++; }
  return bins;
}

/* ── Histogram SVG ────────────────────────────────────────────────────── */

function Histogram({ vals, color }: { vals: number[]; color: string }) {
  const binCount = Math.min(10, Math.max(5, Math.ceil(Math.sqrt(vals.length))));
  const bins = useMemo(() => buildBins(vals, binCount), [vals, binCount]);
  const stats = useMemo(() => mcStats(vals), [vals]);
  const maxN = Math.max(...bins.map(b => b.n), 1);

  const W = 280, H = 90, PL = 28, PR = 8, PT = 12, PB = 16;
  const cW = W - PL - PR, cH = H - PT - PB;
  const barW = cW / bins.length;
  const lo = bins[0].lo, hi = bins[bins.length - 1].hi, range = hi - lo || 1;
  const toX = (v: number) => PL + ((v - lo) / range) * cW;

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="w-full">
      {/* Stddev band */}
      <rect x={toX(stats.mean - stats.stddev)} y={PT} width={Math.max(toX(stats.mean + stats.stddev) - toX(stats.mean - stats.stddev), 0)} height={cH} fill={color} opacity={0.08} />
      {/* Bars */}
      {bins.map((bin, i) => {
        const bh = (bin.n / maxN) * cH;
        return (
          <rect key={i} x={PL + i * barW + 1} y={PT + cH - bh} width={Math.max(barW - 2, 1)} height={bh} fill={color} opacity={0.65} rx={1}>
            <title>{bin.lo.toFixed(0)}–{bin.hi.toFixed(0)}: {bin.n} runs</title>
          </rect>
        );
      })}
      {/* Curve overlay */}
      {bins.length > 2 && (
        <path
          d={bins.map((bin, i) => {
            const cx = PL + (i + 0.5) * barW;
            const cy = PT + cH - (bin.n / maxN) * cH;
            return `${i === 0 ? 'M' : 'L'} ${cx.toFixed(1)} ${cy.toFixed(1)}`;
          }).join(' ')}
          fill="none" stroke={color} strokeWidth={1.5} opacity={0.9}
        />
      )}
      {/* Mean line */}
      <line x1={toX(stats.mean)} y1={PT} x2={toX(stats.mean)} y2={PT + cH} stroke={color} strokeWidth={1.5} strokeDasharray="4 2" />
      <text x={toX(stats.mean)} y={PT - 2} textAnchor="middle" className="text-[8px] font-mono" fill={color}>μ={stats.mean.toFixed(1)}</text>
      {/* Median line */}
      <line x1={toX(stats.median)} y1={PT} x2={toX(stats.median)} y2={PT + cH} stroke="white" strokeWidth={1} strokeDasharray="2 2" opacity={0.5} />
      {/* Axis labels */}
      <text x={PL} y={H - 2} className="text-[8px] font-mono" fill="var(--text-muted)">{lo.toFixed(0)}</text>
      <text x={W - PR} y={H - 2} textAnchor="end" className="text-[8px] font-mono" fill="var(--text-muted)">{hi.toFixed(0)}</text>
      <text x={PL - 2} y={PT + 8} textAnchor="end" className="text-[8px] font-mono" fill="var(--text-muted)">{maxN}</text>
    </svg>
  );
}

/* ── Component ────────────────────────────────────────────────────────── */

export function MonteCarloSim() {
  const [mcRollCount, setMcRollCount] = useState<number | null>(null);
  const [mcResults, setMcResults] = useState<{ tally: Record<string, number[]>; total: number } | null>(null);
  const [histoRarity, setHistoRarity] = useState('Rare');

  const runMonteCarlo = useCallback((n: number) => {
    setMcRollCount(n);
    const tally: Record<string, number[]> = {};
    for (const t of RARITY_TIERS) tally[t.name] = [];
    for (let run = 0; run < MC_RUNS; run++) {
      const counts: Record<string, number> = {};
      for (const t of RARITY_TIERS) counts[t.name] = 0;
      for (let i = 0; i < n; i++) {
        let roll = Math.random() * TOTAL_WEIGHT;
        for (const tier of RARITY_TIERS) {
          roll -= tier.weight;
          if (roll <= 0) { counts[tier.name]++; break; }
        }
      }
      for (const t of RARITY_TIERS) tally[t.name].push(counts[t.name]);
    }
    setMcResults({ tally, total: n });
  }, []);

  const histoColor = RARITY_TIERS.find(t => t.name === histoRarity)?.color ?? ACCENT_VIOLET;

  return (
    <BlueprintPanel className="p-3">
      <div className="flex items-center gap-2 mb-3">
        <SectionHeader icon={Dices} label="Monte Carlo Simulation" color={ACCENT_VIOLET} />
      </div>
      <div className="mb-3">
        <TabButtonGroup
          items={[
            { value: '10', label: '10' },
            { value: '100', label: '100' },
            { value: '1000', label: '1,000' },
            { value: '10000', label: '10,000' },
          ]}
          selected={mcRollCount !== null ? String(mcRollCount) : null}
          onSelect={(v) => runMonteCarlo(Number(v))}
          accent={ACCENT_VIOLET}
          ariaLabel="Monte Carlo sample size"
        />
      </div>
      {mcResults ? (
        <div className="space-y-3" aria-live="polite">
          {/* Stats table */}
          <div className="overflow-x-auto">
            <table className="w-full text-2xs font-mono">
              <thead>
                <tr className="text-text-muted">
                  <th className="text-left py-1 pr-2">Rarity</th>
                  <th className="text-right py-1 px-1">Mean</th>
                  <th className="text-right py-1 px-1">Median</th>
                  <th className="text-right py-1 px-1">StdDev</th>
                  <th className="text-right py-1 px-1">Min</th>
                  <th className="text-right py-1 px-1">Max</th>
                </tr>
              </thead>
              <tbody>
                {RARITY_TIERS.map((tier) => {
                  const s = mcStats(mcResults.tally[tier.name]);
                  return (
                    <tr key={tier.name} className="border-t border-border/20">
                      <td className="py-1 pr-2 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tier.color }} />
                        <span style={{ color: tier.color }}>{tier.name}</span>
                      </td>
                      <td className="text-right py-1 px-1 text-text">{s.mean.toFixed(1)}</td>
                      <td className="text-right py-1 px-1 text-text">{s.median.toFixed(1)}</td>
                      <td className="text-right py-1 px-1 text-text-muted">{s.stddev.toFixed(1)}</td>
                      <td className="text-right py-1 px-1 text-text-muted">{s.min}</td>
                      <td className="text-right py-1 px-1 text-text-muted">{s.max}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Distribution bars */}
          <div className="space-y-1">
            <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">Distribution (avg of {MC_RUNS} runs)</div>
            {RARITY_TIERS.map((tier) => {
              const avg = mcResults.tally[tier.name].reduce((s, v) => s + v, 0) / mcResults.tally[tier.name].length;
              const pct = (avg / mcResults.total) * 100;
              return (
                <div key={tier.name} className="flex items-center gap-2">
                  <span className="text-2xs font-mono w-20 text-text-muted truncate">{tier.name}</span>
                  <div className="flex-1 h-3 bg-surface-deep rounded overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.5 }}
                      className="h-full rounded"
                      style={{ backgroundColor: tier.color }}
                    />
                  </div>
                  <span className="text-2xs font-mono w-12 text-right" style={{ color: tier.color }}>{pct.toFixed(1)}%</span>
                </div>
              );
            })}
          </div>

          {/* Histogram with curve overlay + stat lines */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">Histogram</span>
              <div className="flex gap-1">
                {RARITY_TIERS.map(t => (
                  <button
                    key={t.name}
                    onClick={() => setHistoRarity(t.name)}
                    className="text-2xs font-mono px-1.5 py-0.5 rounded border transition-all cursor-pointer"
                    style={{
                      borderColor: histoRarity === t.name ? t.color : withOpacity(t.color, OPACITY_20),
                      backgroundColor: histoRarity === t.name ? withOpacity(t.color, OPACITY_8) : 'transparent',
                      color: histoRarity === t.name ? t.color : 'var(--text-muted)',
                    }}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
            <Histogram vals={mcResults.tally[histoRarity]} color={histoColor} />
            <div className="flex gap-3 mt-1 text-2xs font-mono text-text-muted">
              <span className="flex items-center gap-1">
                <span className="w-3 h-px inline-block" style={{ borderTop: `1.5px dashed ${histoColor}` }} /> Mean
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-px inline-block border-t border-dashed border-white/50" /> Median
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-1.5 inline-block rounded-sm" style={{ backgroundColor: withOpacity(histoColor, OPACITY_8) }} /> ±1 StdDev
              </span>
            </div>
          </div>

          {/* Expected value per kill */}
          <div className="flex items-center gap-2 p-2 rounded border border-border/30 bg-surface/30">
            <span className="text-2xs text-text-muted">Expected value per kill:</span>
            <span className="text-xs font-mono font-semibold" style={{ color: STATUS_WARNING }}>
              {(RARITY_TIERS.reduce((s, t) => s + (t.weight / TOTAL_WEIGHT) * ({ Common: 5, Uncommon: 15, Rare: 50, Epic: 200, Legendary: 1000 }[t.name] ?? 0), 0)).toFixed(1)} gold
            </span>
          </div>
        </div>
      ) : (
        <p className="text-2xs text-text-muted italic">Select a sample size to run {MC_RUNS} Monte Carlo simulations.</p>
      )}
    </BlueprintPanel>
  );
}
