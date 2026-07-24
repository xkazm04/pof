'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Swords, Play, RefreshCw, Clock, Flame, Pin, X,
} from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { DashboardHeader } from '@/components/ui/DashboardHeader';
import { MetricLabel } from '@/components/ui/MetricLabel';
import { ABComparisonPanel } from '@/components/modules/evaluator/ABComparisonPanel';
import { useCombatSimulatorStore } from '@/stores/combatSimulatorStore';
import {
  MODULE_COLORS, ACCENT_EMERALD_DARK, STATUS_NEUTRAL, STATUS_ERROR,
} from '@/lib/chart-colors';
import { LoadingRow } from '@/components/ui/LoadingRow';
import { narrateSummary } from '@/lib/combat/fight-report';
import type {
  CombatScenario,
  TuningOverrides,
  CombatSimConfig,
} from '@/types/combat-simulator';
import { EMPTY_ALERTS, type ViewMode } from './constants';
import { ModeToggle } from './ModeToggle';
import { ScenarioBuilder } from './ScenarioBuilder';
import { TuningSlidersPanel } from './TuningSlidersPanel';
import { FightReportCardPanel } from './FightReportCardPanel';
import { AdvancedResults } from './AdvancedResults';
import { StatCard } from './StatCards';

// Structural fingerprint of a scenario's tuning-relevant inputs. Used to detect
// when a pinned baseline and the latest candidate describe different encounters,
// so an A/B diff can't silently compare apples to oranges.
function scenarioSignature(s: CombatScenario): string {
  return JSON.stringify({
    lvl: s.playerLevel,
    gear: s.playerGear?.id,
    abils: [...s.playerAbilities.map((a) => a.id)].sort(),
    enemies: s.enemies.map((e) => `${e.archetypeId}:${e.count}:${e.level}`),
  });
}

// ── Main Component ──────────────────────────────────────────────────────────

export function CombatSimulatorView() {
  const enemies = useCombatSimulatorStore((s) => s.enemies);
  const abilities = useCombatSimulatorStore((s) => s.abilities);
  const gearLoadouts = useCombatSimulatorStore((s) => s.gearLoadouts);
  const defaultTuning = useCombatSimulatorStore((s) => s.defaultTuning);
  const defaultConfig = useCombatSimulatorStore((s) => s.defaultConfig);
  const result = useCombatSimulatorStore((s) => s.result);
  const summary = useCombatSimulatorStore((s) => s.summary);
  const alerts = useCombatSimulatorStore((s) => s.alerts) ?? EMPTY_ALERTS;
  const baselineResult = useCombatSimulatorStore((s) => s.baselineResult);
  const comparison = useCombatSimulatorStore((s) => s.comparison);
  const tuning = useCombatSimulatorStore((s) => s.tuning);
  const isLoading = useCombatSimulatorStore((s) => s.isLoading);
  const isSimulating = useCombatSimulatorStore((s) => s.isSimulating);
  const simProgress = useCombatSimulatorStore((s) => s.simProgress);
  const error = useCombatSimulatorStore((s) => s.error);

  const fetchDefaults = useCombatSimulatorStore((s) => s.fetchDefaults);
  const runSimulation = useCombatSimulatorStore((s) => s.runSimulationStreaming);
  const setTuning = useCombatSimulatorStore((s) => s.setTuning);
  const pinBaseline = useCombatSimulatorStore((s) => s.pinBaseline);
  const clearBaseline = useCombatSimulatorStore((s) => s.clearBaseline);

  // Scenario state
  const [playerLevel, setPlayerLevel] = useState(5);
  const [gearId, setGearId] = useState('starter');
  const [selectedAbilities, setSelectedAbilities] = useState<string[]>([
    'ga-melee-attack', 'ga-combo-finisher', 'ga-fireball', 'ga-ground-slam', 'ga-dodge',
  ]);
  const [enemySetup, setEnemySetup] = useState<{ archetypeId: string; count: number; level: number }[]>([
    { archetypeId: 'melee-grunt', count: 3, level: 5 },
  ]);
  const [iterations, setIterations] = useState(1000);
  // Iteration count actually submitted with the in-flight run. The live
  // `iterations` state can change mid-run (input isn't the source of truth for a
  // running job), so the progress label must read the captured value, not it.
  const [activeIterations, setActiveIterations] = useState(1000);

  // Story Mode renders the narrated Fight Report Card and hides the jargon-heavy
  // panels; Advanced reveals the full numeric breakdown. Default ON so the most
  // numerically intimidating screen reads approachably for non-technical stakeholders.
  const [mode, setMode] = useState<ViewMode>('simple');

  useEffect(() => {
    fetchDefaults();
  }, [fetchDefaults]);

  const gear = useMemo(() =>
    gearLoadouts.find((g) => g.id === gearId) ?? gearLoadouts[0],
    [gearLoadouts, gearId],
  );

  const playerAbils = useMemo(() =>
    abilities.filter((a) => selectedAbilities.includes(a.id)),
    [abilities, selectedAbilities],
  );

  // Narrated plain-language report card, derived purely from the finished run.
  const report = useMemo(
    () => (summary ? narrateSummary(summary, summary.threatBreakdown, alerts) : null),
    [summary, alerts],
  );

  const handleRun = useCallback(async () => {
    if (!tuning || !defaultConfig || !gear) return;
    const scenario: CombatScenario = {
      name: `Lvl ${playerLevel} vs ${enemySetup.map((e) => `${e.count}x ${e.archetypeId}`).join(', ')}`,
      playerLevel,
      playerGear: gear,
      playerAbilities: playerAbils,
      enemies: enemySetup,
    };
    const config: CombatSimConfig = { ...defaultConfig, iterations, seed: Math.floor(Math.random() * 999999) };
    setActiveIterations(iterations);
    await runSimulation(scenario, tuning, config);
  }, [tuning, defaultConfig, gear, playerLevel, playerAbils, enemySetup, iterations, runSimulation]);

  const handleTuningChange = useCallback((key: keyof TuningOverrides, value: number) => {
    if (!tuning) return;
    setTuning({ ...tuning, [key]: value });
  }, [tuning, setTuning]);

  // A/B diff is only apples-to-apples when the candidate ran the same encounter
  // as the pinned baseline; flag a divergence so the delta isn't read as a
  // controlled tuning comparison when it actually mixes scenarios.
  const scenarioMismatch = useMemo(() => {
    if (!baselineResult || !comparison || !result) return false;
    return scenarioSignature(baselineResult.scenario) !== scenarioSignature(result.scenario);
  }, [baselineResult, comparison, result]);

  const survivalColor = summary
    ? summary.survivalRate > 0.7 ? ACCENT_EMERALD_DARK : summary.survivalRate > 0.4 ? MODULE_COLORS.content : MODULE_COLORS.evaluator
    : STATUS_NEUTRAL;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 pt-6 pb-4">
        <DashboardHeader
          icon={Swords}
          title="Combat Balance Simulator"
          subtitle={
            <>
              <MetricLabel metricId="gas" label="GAS" placement="bottom" />-based{' '}
              <MetricLabel metricId="monteCarlo" label="Monte Carlo" placement="bottom" /> combat
              simulation with balance tuning
            </>
          }
          accent="red"
          accentTo="orange"
          className="mb-4"
          action={
            <div className="flex items-center gap-2">
              <ModeToggle mode={mode} onChange={setMode} />
              {result && (
                <button
                  onClick={pinBaseline}
                  title="Pin this run as the A/B baseline; the next run is diffed against it"
                  className="flex items-center gap-1.5 px-3 py-2 bg-violet-400/10 border border-violet-400/30 rounded-lg text-violet-400 text-xs font-medium hover:bg-violet-400/20 transition-colors"
                >
                  <Pin className="w-3.5 h-3.5" />
                  {baselineResult ? 'Re-pin Baseline' : 'Pin as Baseline'}
                </button>
              )}
              <button
                onClick={handleRun}
                disabled={isSimulating || !tuning}
                className="flex items-center gap-1.5 px-4 py-2 bg-status-red-subtle border border-status-red-strong rounded-lg text-red-400 text-xs font-medium hover:bg-status-red-medium transition-colors disabled:opacity-50"
              >
                {isSimulating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                {isSimulating
                  ? `Simulating ${activeIterations}… ${Math.round(simProgress * 100)}%`
                  : baselineResult ? `Run Candidate (${iterations})` : `Run ${iterations} Fights`}
              </button>
            </div>
          }
        />

        {/* Baseline-pinned banner */}
        {baselineResult && (
          <div className="flex items-center gap-2 mb-3 px-3 py-1.5 rounded-lg bg-violet-400/10 border border-violet-400/20">
            <Pin className="w-3 h-3 text-violet-400 flex-shrink-0" />
            <span className="text-2xs text-text-muted">
              Baseline pinned: <span className="text-text font-medium">{baselineResult.scenario.name}</span>
              {' '}· {(baselineResult.summary.survivalRate * 100).toFixed(0)}% survival, {baselineResult.summary.avgDPS.toFixed(0)} DPS
              {comparison ? ' — comparing against latest run below' : ' — run a candidate to compare'}
            </span>
            <button
              onClick={clearBaseline}
              title="Clear baseline"
              className="ml-auto flex items-center gap-1 text-2xs text-text-muted hover:text-red-400 transition-colors"
            >
              <X className="w-3 h-3" /> Clear
            </button>
          </div>
        )}

        {/* Summary stats */}
        {summary && (
          <div className="flex flex-wrap gap-3 mb-4">
            <SurfaceCard className="flex items-center gap-2.5 px-3 py-2 flex-1" level={2}>
              <ProgressRing value={Math.round(summary.survivalRate * 100)} size={36} strokeWidth={3} color={survivalColor} />
              <div>
                <div className="text-sm font-semibold" style={{ color: survivalColor }}>{(summary.survivalRate * 100).toFixed(1)}%</div>
                <div className="text-2xs text-text-muted">
                  <MetricLabel metricId="survivalRate" label="Survival" />
                </div>
              </div>
            </SurfaceCard>
            <StatCard icon={<Clock className="w-4 h-4 text-blue-400" />} value={`${summary.avgFightDurationSec.toFixed(1)}s`} label="Avg Duration" metricId="avgFightDurationSec" color="text-blue-400" />
            <StatCard icon={<Swords className="w-4 h-4 text-emerald-400" />} value={`${summary.avgDPS.toFixed(1)}`} label="Player DPS" metricId="avgDPS" color="text-emerald-400" />
            <StatCard icon={<Flame className="w-4 h-4 text-red-400" />} value={`${summary.avgEnemyDPS.toFixed(1)}`} label="Enemy DPS" metricId="avgEnemyDPS" color="text-red-400" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {isLoading && <LoadingRow label="Loading combat data…" color={STATUS_ERROR} />}

        {error && (
          <SurfaceCard className="p-4 mb-4 border-status-red-strong">
            <p className="text-sm text-red-400">{error}</p>
          </SurfaceCard>
        )}

        {!isLoading && (
          <div className="space-y-5">
            {/* Scenario + Tuning side by side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Scenario Builder */}
              <ScenarioBuilder
                playerLevel={playerLevel}
                setPlayerLevel={setPlayerLevel}
                gearId={gearId}
                setGearId={setGearId}
                gearLoadouts={gearLoadouts}
                selectedAbilities={selectedAbilities}
                setSelectedAbilities={setSelectedAbilities}
                abilities={abilities}
                enemySetup={enemySetup}
                setEnemySetup={setEnemySetup}
                enemyArchetypes={enemies}
                iterations={iterations}
                setIterations={setIterations}
                simulating={isSimulating}
              />

              {/* Tuning Sliders */}
              {tuning && (
                <TuningSlidersPanel
                  tuning={tuning}
                  defaultTuning={defaultTuning}
                  setTuning={setTuning}
                  handleTuningChange={handleTuningChange}
                />
              )}
            </div>

            {/* A/B Comparison — front-and-center when a baseline is pinned */}
            {comparison && (
              <div className="space-y-2">
                {scenarioMismatch && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-400/10 border border-amber-400/20">
                    <span className="text-2xs text-amber-400">
                      Scenario changed since the baseline was pinned — this comparison diffs different
                      encounters, so the deltas below are not a controlled tuning comparison. Re-pin the
                      baseline on the current scenario for an apples-to-apples result.
                    </span>
                  </div>
                )}
                <ABComparisonPanel comparison={comparison} />
              </div>
            )}

            {/* Results */}
            {summary && (
              <>
                {/* Narrated Fight Report Card — the plain-language headline answer,
                    shown in both modes (Story Mode hides the numeric panels below). */}
                {report && (
                  <FightReportCardPanel
                    report={report}
                    scenarioName={result?.scenario.name}
                    iterations={result?.config.iterations}
                  />
                )}

                {/* Advanced view: the full numeric breakdown. */}
                {mode === 'advanced' && (
                  <AdvancedResults summary={summary} alerts={alerts} result={result} />
                )}
              </>
            )}

            {!summary && !isSimulating && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Swords className="w-12 h-12 text-text-muted/30 mb-3" />
                <p className="text-sm text-text-muted">Configure encounter and click &quot;Run&quot; to simulate</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
