'use client';

import { useState, useCallback } from 'react';
import { Dices } from 'lucide-react';
import { motion } from 'framer-motion';
import { TabButtonGroup } from '../_shared';
import { RARITY_TIERS, TOTAL_WEIGHT } from './data';
import { ACCENT_VIOLET, STATUS_WARNING } from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from './design';

export function MonteCarloSim() {
  const [mcRollCount, setMcRollCount] = useState<number | null>(null);
  const [mcResults, setMcResults] = useState<{ tally: Record<string, number[]>; total: number } | null>(null);

  const runMonteCarlo = useCallback((n: number) => {
    setMcRollCount(n);
    const runs = 10;
    const tally: Record<string, number[]> = {};
    for (const t of RARITY_TIERS) tally[t.name] = [];
    for (let run = 0; run < runs; run++) {
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
                  <th className="text-right py-1 px-1">Mode</th>
                  <th className="text-right py-1 px-1">Min</th>
                  <th className="text-right py-1 px-1">Max</th>
                </tr>
              </thead>
              <tbody>
                {RARITY_TIERS.map((tier) => {
                  const vals = mcResults.tally[tier.name].sort((a, b) => a - b);
                  const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
                  const median = vals[Math.floor(vals.length / 2)];
                  const freqMap = new Map<number, number>();
                  for (const v of vals) freqMap.set(v, (freqMap.get(v) ?? 0) + 1);
                  let mode = vals[0];
                  let maxFreq = 0;
                  for (const [v, f] of freqMap) { if (f > maxFreq) { maxFreq = f; mode = v; } }
                  return (
                    <tr key={tier.name} className="border-t border-border/20">
                      <td className="py-1 pr-2 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tier.color }} />
                        <span style={{ color: tier.color }}>{tier.name}</span>
                      </td>
                      <td className="text-right py-1 px-1 text-text">{mean.toFixed(1)}</td>
                      <td className="text-right py-1 px-1 text-text">{median}</td>
                      <td className="text-right py-1 px-1 text-text">{mode}</td>
                      <td className="text-right py-1 px-1 text-text-muted">{vals[0]}</td>
                      <td className="text-right py-1 px-1 text-text-muted">{vals[vals.length - 1]}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Histogram bars */}
          <div className="space-y-1">
            <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">Distribution (avg of 10 runs)</div>
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
          {/* Expected value per kill */}
          <div className="flex items-center gap-2 p-2 rounded border border-border/30 bg-surface/30">
            <span className="text-2xs text-text-muted">Expected value per kill:</span>
            <span className="text-xs font-mono font-semibold" style={{ color: STATUS_WARNING }}>
              {(RARITY_TIERS.reduce((s, t) => s + (t.weight / TOTAL_WEIGHT) * ({ Common: 5, Uncommon: 15, Rare: 50, Epic: 200, Legendary: 1000 }[t.name] ?? 0), 0)).toFixed(1)} gold
            </span>
          </div>
        </div>
      ) : (
        <p className="text-2xs text-text-muted italic">Select a sample size to run 10 Monte Carlo simulations.</p>
      )}
    </BlueprintPanel>
  );
}
