'use client';

import { useState, useCallback } from 'react';
import { Dices } from 'lucide-react';
import { motion } from 'framer-motion';
import { TabButtonGroup } from '../../unique-tabs/_shared';
import { RARITY_TIERS, TOTAL_WEIGHT } from '../_shared/data';
import { ACCENT_VIOLET, STATUS_WARNING, withOpacity, OPACITY_8, OPACITY_20 } from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '../_shared/design';
import { mcStats } from './monte-carlo-utils';
import { Histogram } from './Histogram';

const MC_RUNS = 50;

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
