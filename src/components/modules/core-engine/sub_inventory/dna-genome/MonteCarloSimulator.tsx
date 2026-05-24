'use client';

import { useState, useTransition } from 'react';
import { Activity, Dice5, Sigma } from 'lucide-react';
import {
  withOpacity,
  OPACITY_10, OPACITY_12, OPACITY_25, OPACITY_37,
} from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '@/components/modules/core-engine/unique-tabs/_design';
import type { ItemGenome } from '@/types/item-genome';
import { simulateRolls, type SimulationStats } from '@/lib/item-dna/rolling-engine';
import { ACCENT, DEMO_AFFIX_POOL } from './data';
import { SimulatorResults } from './SimulatorResults';

/* ── Monte Carlo Loot Simulator ────────────────────────────────────────── */

const ITERATION_PRESETS = [1000, 2500, 5000, 10000] as const;
const GOD_ROLL_THRESHOLD = 0.85;

interface Props {
  genome: ItemGenome;
  rarity: string;
  level: number;
}

export function MonteCarloSimulator({ genome, rarity, level }: Props) {
  const [iterations, setIterations] = useState<number>(1000);
  const [stats, setStats] = useState<SimulationStats | null>(null);
  const [isPending, startTransition] = useTransition();

  const runSimulation = () => {
    startTransition(() => {
      const result = simulateRolls(genome, rarity, level, DEMO_AFFIX_POOL, iterations, GOD_ROLL_THRESHOLD);
      setStats(result);
    });
  };

  return (
    <BlueprintPanel color={ACCENT} className="p-3 space-y-3">
      <SectionHeader icon={Activity} label="Monte Carlo Simulator" color={ACCENT} />

      {/* Controls */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted block mb-0.5">Iterations</span>
          <div className="flex gap-1">
            {ITERATION_PRESETS.map((n) => (
              <button
                key={n}
                onClick={() => setIterations(n)}
                className="text-xs font-mono font-bold px-2 py-1 rounded transition-all"
                style={{
                  backgroundColor: iterations === n ? withOpacity(ACCENT, OPACITY_25) : withOpacity(ACCENT, OPACITY_10),
                  color: iterations === n ? ACCENT : 'rgb(148 163 184)',
                  border: `1px solid ${withOpacity(ACCENT, iterations === n ? OPACITY_37 : OPACITY_12)}`,
                }}
              >
                {n >= 1000 ? `${n / 1000}k` : n}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1" />
        <button
          onClick={runSimulation}
          disabled={isPending}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-wait disabled:hover:scale-100"
          style={{
            backgroundColor: withOpacity(ACCENT, OPACITY_12),
            color: ACCENT,
            border: `1px solid ${withOpacity(ACCENT, OPACITY_25)}`,
          }}
        >
          <Dice5 className="w-3.5 h-3.5" />
          {isPending ? 'Simulating…' : `Run ${iterations >= 1000 ? `${iterations / 1000}k` : iterations} Rolls`}
        </button>
      </div>

      {!stats ? (
        <div className="flex items-center justify-center py-8">
          <div className="text-center space-y-2">
            <Sigma className="w-7 h-7 text-text-muted/30 mx-auto" />
            <p className="text-xs text-text-muted">Run a batch to see the real distribution across thousands of attempts</p>
          </div>
        </div>
      ) : (
        <SimulatorResults stats={stats} />
      )}
    </BlueprintPanel>
  );
}
