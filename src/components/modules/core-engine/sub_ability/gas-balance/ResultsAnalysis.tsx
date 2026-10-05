'use client';

import { useState, useCallback } from 'react';
import { runSensitivity, runLevelSweep, detectBreakpoints } from './simulation';
import type { SimScenario, SensitivityResult, LevelSweepPoint, LevelSweepConfig, CombatantStats } from './data';
import { DEFAULT_SWEEP_CONFIG } from './data';
import { SensitivityPanel } from './SensitivityPanel';
import { LevelSweepPanel } from './LevelSweepPanel';

export const SENSITIVITY_ATTRS: (keyof CombatantStats)[] = ['strength', 'armor', 'criticalChance', 'attackPower', 'baseDamage'];
export const SENSITIVITY_SWEEP_RANGE = 0.5;

/**
 * Baseline-relative sweep range for one attribute — not an arbitrary absolute
 * range (ai-registry game-production/tornado-sensitivity-sweeps): sweeps at
 * the scenario's own value ±50%, like lib/economy/sensitivity-sweep.ts's
 * baseValue * (1 ± range). A fixed-range sweep moves each attribute by a
 * different fraction of its baseline, so the resulting curves cannot be
 * compared — the method's most common failure. Pure (exported for unit test).
 */
export function sensitivityRangeFor(key: keyof CombatantStats, baseValue: number): { min: number; max: number } {
  const span = baseValue > 0 ? baseValue * SENSITIVITY_SWEEP_RANGE : (key === 'criticalChance' ? 0.15 : 10);
  const min = Math.max(0, baseValue - span);
  const max = key === 'criticalChance' ? Math.min(1, baseValue + span) : baseValue + span;
  return { min, max };
}

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
      const newResults = SENSITIVITY_ATTRS.map((key) => {
        const baseValue = scenario.player[key] as number;
        const { min, max } = sensitivityRangeFor(key, baseValue);
        return runSensitivity(scenario, key, { min, max, steps: 12 });
      });
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

  return (
    <div className="space-y-4">
      <SensitivityPanel
        show={showSensitivity}
        results={sensitivityResults}
        running={runningSensitivity}
        onRun={runSensitivityAnalysis}
      />
      <LevelSweepPanel
        show={showSweep}
        points={sweepPoints}
        breakpoints={sweepBreakpoints}
        running={runningSweep}
        config={sweepConfig}
        setConfig={setSweepConfig}
        onRun={runLevelSweepAnalysis}
      />
    </div>
  );
}
