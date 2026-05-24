'use client';

import { useState, useCallback } from 'react';
import { runSensitivity, runLevelSweep, detectBreakpoints } from './simulation';
import type { SimScenario, SensitivityResult, LevelSweepPoint, LevelSweepConfig, CombatantStats } from './data';
import { DEFAULT_SWEEP_CONFIG } from './data';
import { SensitivityPanel } from './SensitivityPanel';
import { LevelSweepPanel } from './LevelSweepPanel';

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
