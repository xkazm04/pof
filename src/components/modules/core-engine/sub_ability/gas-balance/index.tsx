'use client';

import { useState, useCallback, useRef } from 'react';
import { Play, BarChart3, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { OPACITY_20, OPACITY_30,
  withOpacity, OPACITY_25,
} from '@/lib/chart-colors';
import { BlueprintPanel } from '../../unique-tabs/_design';
import { ScenarioEditor } from './ScenarioEditor';
import { ResultsSummary } from './ResultsSummary';
import { ResultsAnalysis } from './ResultsAnalysis';
import { ImportScenarioModal } from './ImportScenarioModal';
import { GASBalanceHeader } from './GASBalanceHeader';
import { runIteration, finalizeSimulation } from './simulation';
import { armorMitigation } from '@/lib/ability/damage-formula';
import type { SimScenario, SimResults, SimIterationResult } from './data';
import { ACCENT, SCENARIO_PRESETS } from './data';
import { TEXT_SCALE } from '@/lib/typography-scale';

export function GASBalanceSimulator() {
  const [scenario, setScenario] = useState<SimScenario>(() => ({
    ...SCENARIO_PRESETS[0], id: `custom-${Date.now()}`,
  }));
  const [results, setResults] = useState<SimResults | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [simProgress, setSimProgress] = useState<{ current: number; total: number } | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<string>('trash-pack');
  const [showImportModal, setShowImportModal] = useState(false);
  const runIdRef = useRef(0);

  const handleImport = useCallback((imported: SimScenario) => {
    setScenario(imported);
    setSelectedPreset('');
    setResults(null);
    setShowImportModal(false);
  }, []);

  const loadPreset = useCallback((presetId: string) => {
    const preset = SCENARIO_PRESETS.find(p => p.id === presetId);
    if (!preset) return;
    setScenario({
      ...preset, id: `custom-${Date.now()}`,
      player: { ...preset.player },
      enemies: preset.enemies.map(e => ({ ...e, stats: { ...e.stats } })),
    });
    setSelectedPreset(presetId);
    setResults(null);
  }, []);

  const runSim = useCallback(() => {
    setIsRunning(true);
    const runId = ++runIdRef.current;
    const total = scenario.iterations;
    const chunkSize = 200;
    const allIterations: SimIterationResult[] = [];
    let completed = 0;
    setSimProgress({ current: 0, total });

    const processChunk = () => {
      if (runIdRef.current !== runId) return;
      const end = Math.min(completed + chunkSize, total);
      for (let i = completed; i < end; i++) {
        allIterations.push(runIteration(scenario.player, scenario.enemies));
      }
      completed = end;
      setSimProgress({ current: completed, total });

      if (completed < total) {
        requestAnimationFrame(processChunk);
      } else {
        const simResults = finalizeSimulation(scenario, allIterations);
        if (runIdRef.current === runId) {
          setResults(simResults);
          setIsRunning(false);
          setSimProgress(null);
        }
      }
    };

    requestAnimationFrame(processChunk);
  }, [scenario]);

  const totalEnemies = scenario.enemies.reduce((s, e) => s + e.count, 0);
  const totalEnemyHp = scenario.enemies.reduce((s, e) => s + e.stats.maxHealth * e.count, 0);

  return (
    <div className="space-y-4">
      <GASBalanceHeader
        scenario={scenario}
        selectedPreset={selectedPreset}
        onLoadPreset={loadPreset}
        onOpenImport={() => setShowImportModal(true)}
      />

      <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-4">
        {/* Left: Scenario Editor */}
        <div className="space-y-4">
          <ScenarioEditor scenario={scenario} onChange={setScenario} />

          {/* Run Button + Progress */}
          <div className="relative">
            <button onClick={runSim} disabled={isRunning || scenario.enemies.length === 0}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
              style={{ backgroundColor: `${ACCENT}${OPACITY_20}`, color: ACCENT, border: `1px solid ${withOpacity(ACCENT, OPACITY_25)}` }}>
              {isRunning ? (
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                  <RotateCcw className="w-4 h-4" />
                </motion.div>
              ) : (
                <Play className="w-4 h-4" />
              )}
              {isRunning && simProgress
                ? `${simProgress.current.toLocaleString()}/${simProgress.total.toLocaleString()}`
                : `Run ${scenario.iterations.toLocaleString()} Iterations`}
            </button>
            <AnimatePresence>
              {simProgress && (
                <motion.div className="mt-1 h-1 rounded-full overflow-hidden"
                  style={{ backgroundColor: `${ACCENT}${OPACITY_30}` }}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <motion.div className="h-full rounded-full" style={{ backgroundColor: ACCENT }}
                    initial={{ width: '0%' }}
                    animate={{ width: `${(simProgress.current / simProgress.total) * 100}%` }}
                    transition={{ duration: 0.1, ease: 'linear' }} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Quick summary */}
          <BlueprintPanel color={ACCENT} className="p-2 text-2xs text-text-muted space-y-0.5" noBrackets>
            <div>Player: Lv.{scenario.player.level} — {scenario.player.maxHealth} HP, {scenario.player.attackPower} AtkPow</div>
            <div>Enemies: {totalEnemies} targets, {totalEnemyHp} total HP</div>
            <div>Scaling: AtkPow +Str{'×'}2 = {scenario.player.attackPower + scenario.player.strength * 2}</div>
            <div>Armor Mit: {(armorMitigation(scenario.player.armor) * 100).toFixed(1)}%</div>
          </BlueprintPanel>
        </div>

        {/* Right: Results */}
        <div className="space-y-4">
          {results ? (
            <>
              <ResultsSummary results={results} scenario={scenario} />
              <ResultsAnalysis scenario={scenario} />
            </>
          ) : (
            <BlueprintPanel color={ACCENT} className="p-8 text-center">
              <div className="flex flex-col items-center gap-2 text-text-muted">
                <BarChart3 className="w-8 h-8 opacity-30" />
                <p className="text-sm">Configure a scenario and run the simulation</p>
                <p className={TEXT_SCALE.body}>Results will show TTK distributions, DPS curves, armor breakpoints, and sensitivity analysis</p>
              </div>
            </BlueprintPanel>
          )}
        </div>
      </div>

      {showImportModal && (
        <ImportScenarioModal onImport={handleImport} onClose={() => setShowImportModal(false)} />
      )}
    </div>
  );
}
