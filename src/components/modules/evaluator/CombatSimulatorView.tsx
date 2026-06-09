'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Swords, Play, RefreshCw, Heart, Shield, Zap,
  ChevronDown, ChevronRight, AlertTriangle, Target,
  Activity, BarChart3, Users, Flame, ShieldAlert,
  TrendingUp, Crosshair, Clock, Skull, Pin, X,
  Lightbulb, SlidersHorizontal, Sparkles, Copy, Check,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { KPICard } from '@/components/ui/KPICard';
import { Badge } from '@/components/ui/Badge';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { DashboardHeader } from '@/components/ui/DashboardHeader';
import { CenterSlider } from '@/components/ui/CenterSlider';
import { NumberField } from '@/components/ui/NumberField';
import { ABComparisonPanel } from './ABComparisonPanel';
import { ChartLegend } from '@/components/ui/ChartLegend';
import { MetricLabel } from '@/components/ui/MetricLabel';
import { useCombatSimulatorStore } from '@/stores/combatSimulatorStore';
import {
  MODULE_COLORS, ACCENT_EMERALD_DARK, STATUS_NEUTRAL,
  STATUS_ERROR, STATUS_WARNING, ACCENT_CYAN_LIGHT,
} from '@/lib/chart-colors';
import { percentileFromBuckets } from '@/lib/combat/histogram';
import { UI_TIMEOUTS } from '@/lib/constants';
import { narrateSummary, formatReportCardText, type FightReportCard, type ReportBand } from '@/lib/combat/fight-report';
import type {
  CombatScenario,
  TuningOverrides,
  CombatSimConfig,
  CombatSummary,
  BalanceAlert,
  BalanceAlertSeverity,
  GearLoadout,
  CombatAbility,
  EnemyArchetype,
  ThreatBreakdown,
} from '@/types/combat-simulator';

// ── Constants ───────────────────────────────────────────────────────────────

const EMPTY_ALERTS: BalanceAlert[] = [];

/** Plain-language Story Mode vs. full numeric Advanced view. */
type ViewMode = 'simple' | 'advanced';

const SEVERITY_STYLE: Record<BalanceAlertSeverity, { bg: string; border: string; text: string }> = {
  info: { bg: 'bg-blue-400/10', border: 'border-blue-400/20', text: 'text-blue-400' },
  warning: { bg: 'bg-amber-400/10', border: 'border-amber-400/20', text: 'text-amber-400' },
  critical: { bg: 'bg-red-400/10', border: 'border-red-400/20', text: 'text-red-400' },
};

/** Difficulty-band styling for the narrated Fight Report Card. */
const BAND_STYLE: Record<ReportBand, { text: string; bg: string; border: string; label: string }> = {
  easy: { text: 'text-blue-400', bg: 'bg-blue-400/10', border: 'border-blue-400/25', label: 'Too Easy' },
  fair: { text: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/25', label: 'Well Balanced' },
  tough: { text: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400/25', label: 'Tough' },
  brutal: { text: 'text-red-400', bg: 'bg-red-400/10', border: 'border-red-400/25', label: 'Brutal' },
};

const TUNING_SLIDERS: { key: keyof TuningOverrides; label: string; icon: typeof Heart }[] = [
  { key: 'playerHealthMul', label: 'Player HP', icon: Heart },
  { key: 'playerDamageMul', label: 'Player Dmg', icon: Swords },
  { key: 'playerArmorMul', label: 'Player Armor', icon: Shield },
  { key: 'enemyHealthMul', label: 'Enemy HP', icon: Heart },
  { key: 'enemyDamageMul', label: 'Enemy Dmg', icon: Flame },
  { key: 'critMultiplierMul', label: 'Crit Multi', icon: Crosshair },
  { key: 'armorEffectivenessWeight', label: 'Armor Weight', icon: Shield },
];

// ── Mode toggle (Story ⇄ Advanced) ──────────────────────────────────────────

/** Mirrors the Prompt Evolution view's Simple/Advanced toggle. */
function ModeToggle({ mode, onChange }: { mode: ViewMode; onChange: (m: ViewMode) => void }) {
  const options: { id: ViewMode; label: string; icon: typeof Lightbulb; hint: string }[] = [
    { id: 'simple', label: 'Story', icon: Lightbulb, hint: 'Plain-language fight report' },
    { id: 'advanced', label: 'Advanced', icon: SlidersHorizontal, hint: 'Full numeric breakdown' },
  ];
  return (
    <div
      className="inline-flex items-center rounded-md border border-border bg-surface p-0.5"
      role="group"
      aria-label="Result detail level"
    >
      {options.map((opt) => {
        const active = mode === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            aria-pressed={active}
            title={opt.hint}
            className={`focus-ring flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors ${
              active ? 'text-white' : 'text-text-muted hover:text-text'
            }`}
            style={active ? { backgroundColor: ACCENT_EMERALD_DARK } : undefined}
          >
            <opt.icon className="w-3 h-3" />
            {opt.label}
          </button>
        );
      })}
    </div>
  );
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
    await runSimulation(scenario, tuning, config);
  }, [tuning, defaultConfig, gear, playerLevel, playerAbils, enemySetup, iterations, runSimulation]);

  const handleTuningChange = useCallback((key: keyof TuningOverrides, value: number) => {
    if (!tuning) return;
    setTuning({ ...tuning, [key]: value });
  }, [tuning, setTuning]);

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
                  ? `Simulating ${iterations}… ${Math.round(simProgress * 100)}%`
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
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-status-red-strong border-t-red-500 rounded-full animate-spin" />
            <span className="ml-3 text-sm text-text-muted">Loading combat data...</span>
          </div>
        )}

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
              />

              {/* Tuning Sliders */}
              {tuning && (
                <SurfaceCard className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Activity className="w-4 h-4 text-amber-400" />
                    <h2 className="text-sm font-medium text-text">Tuning Sliders</h2>
                    <button
                      onClick={() => defaultTuning && setTuning({ ...defaultTuning })}
                      className="ml-auto text-2xs text-text-muted hover:text-text transition-colors"
                    >
                      Reset
                    </button>
                  </div>
                  <div className="space-y-2.5">
                    {TUNING_SLIDERS.map(({ key, label, icon: Icon }) => (
                      <div key={key} className="flex items-center gap-2">
                        <Icon className="w-3 h-3 text-text-muted flex-shrink-0" />
                        <MetricLabel
                          metricId={key}
                          label={label}
                          className="text-2xs text-text-muted w-20 flex-shrink-0"
                        />
                        <CenterSlider
                          className="flex-1"
                          value={Math.round(tuning[key] * 100)}
                          min={50}
                          max={200}
                          neutral={100}
                          onChange={(v) => handleTuningChange(key, v / 100)}
                          ariaLabel={`${label} multiplier`}
                        />
                      </div>
                    ))}
                  </div>
                </SurfaceCard>
              )}
            </div>

            {/* A/B Comparison — front-and-center when a baseline is pinned */}
            {comparison && <ABComparisonPanel comparison={comparison} />}

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
                  <>
                    {/* Ability Heatmap */}
                    <AbilityHeatmap heatmap={summary.abilityHeatmap} />

                    {/* Death Recap: Threat Breakdown */}
                    <ThreatBreakdownPanel breakdown={summary.threatBreakdown} />

                    {/* Distributions */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      <DistributionChart title="Damage Dealt" buckets={summary.damageDealtBuckets} color="emerald" />
                      <DistributionChart title="Damage Taken" buckets={summary.damageTakenBuckets} color="red" />
                      <DistributionChart title="Fight Duration" buckets={summary.durationBuckets} color="blue" unit="s" />
                    </div>

                    {/* Extra stats */}
                    <SurfaceCard className="p-4">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                        <MiniStat label="Avg Crit Rate" metricId="avgCritRate" value={`${(summary.avgCritRate * 100).toFixed(1)}%`} />
                        <MiniStat label="One-Shot Rate" metricId="oneShotRate" value={`${(summary.oneShotRate * 100).toFixed(1)}%`} alert={summary.oneShotRate > 0.05} />
                        <MiniStat label="Avg HP Left" metricId="avgPlayerHealthRemaining" value={`${summary.avgPlayerHealthRemaining.toFixed(0)}`} />
                        <MiniStat label="Median Duration" metricId="medianFightDurationSec" value={`${summary.medianFightDurationSec.toFixed(1)}s`} />
                      </div>
                    </SurfaceCard>

                    {/* Balance Alerts */}
                    <AlertsSection alerts={alerts} />

                    {/* Sim meta */}
                    {result && (
                      <div className="flex items-center gap-2 text-2xs text-text-muted">
                        <Zap className="w-3 h-3" />
                        {result.config.iterations} iterations in {result.durationMs}ms · Seed: {result.config.seed}
                      </div>
                    )}
                  </>
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

// ── Scenario Builder ────────────────────────────────────────────────────────

/** Display order + labels for grouping the ability picker by CombatAbility.type. */
const ABILITY_GROUPS: { type: CombatAbility['type']; label: string }[] = [
  { type: 'melee', label: 'Melee' },
  { type: 'ranged', label: 'Ranged' },
  { type: 'aoe', label: 'AoE' },
  { type: 'buff', label: 'Buff' },
  { type: 'dodge', label: 'Dodge' },
];

function ScenarioBuilder({
  playerLevel, setPlayerLevel, gearId, setGearId, gearLoadouts,
  selectedAbilities, setSelectedAbilities, abilities,
  enemySetup, setEnemySetup, enemyArchetypes,
  iterations, setIterations,
}: {
  playerLevel: number;
  setPlayerLevel: (v: number) => void;
  gearId: string;
  setGearId: (v: string) => void;
  gearLoadouts: GearLoadout[];
  selectedAbilities: string[];
  setSelectedAbilities: (v: string[]) => void;
  abilities: CombatAbility[];
  enemySetup: { archetypeId: string; count: number; level: number }[];
  setEnemySetup: (v: typeof enemySetup) => void;
  enemyArchetypes: EnemyArchetype[];
  iterations: number;
  setIterations: (v: number) => void;
}) {
  const toggleAbility = (id: string) =>
    setSelectedAbilities(
      selectedAbilities.includes(id)
        ? selectedAbilities.filter((x) => x !== id)
        : [...selectedAbilities, id],
    );

  return (
    <SurfaceCard className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <Target className="w-4 h-4 text-cyan-400" />
        <h2 className="text-sm font-medium text-text">Scenario</h2>
      </div>

      <div className="space-y-3">
        {/* Player config */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div>
            <label className="text-2xs text-text-muted font-medium block mb-1">Player Level</label>
            <NumberField
              value={playerLevel}
              min={1}
              max={50}
              fallback={1}
              onChange={setPlayerLevel}
              ariaLabel="Player level"
              className="w-full px-2 py-1 bg-surface border border-border rounded-lg text-xs text-text focus:outline-none focus:border-status-red-strong"
            />
          </div>
          <div>
            <label className="text-2xs text-text-muted font-medium block mb-1">Gear</label>
            <select
              value={gearId}
              onChange={(e) => setGearId(e.target.value)}
              className="w-full px-2 py-1 bg-surface border border-border rounded-lg text-xs text-text focus:outline-none focus:border-status-red-strong cursor-pointer"
            >
              {gearLoadouts.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-2xs text-text-muted font-medium block mb-1">Iterations</label>
            <NumberField
              value={iterations}
              min={100}
              max={5000}
              fallback={1000}
              step={100}
              onChange={setIterations}
              ariaLabel="Simulation iterations"
              className="w-full px-2 py-1 bg-surface border border-border rounded-lg text-xs text-text focus:outline-none focus:border-status-red-strong"
            />
          </div>
        </div>

        {/* Abilities */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-2xs text-text-muted font-medium">
              Abilities <span className="text-cyan-400">({selectedAbilities.length}/{abilities.length})</span>
            </label>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setSelectedAbilities(abilities.map((a) => a.id))}
                disabled={selectedAbilities.length === abilities.length}
                className="px-1.5 py-0.5 rounded text-2xs text-text-muted hover:text-text disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Select all
              </button>
              <button
                type="button"
                onClick={() => setSelectedAbilities([])}
                disabled={selectedAbilities.length === 0}
                className="px-1.5 py-0.5 rounded text-2xs text-text-muted hover:text-text disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            {ABILITY_GROUPS.map(({ type, label }) => {
              const group = abilities.filter((a) => a.type === type);
              if (group.length === 0) return null;
              const groupIds = group.map((a) => a.id);
              const selectedInGroup = groupIds.filter((id) => selectedAbilities.includes(id)).length;
              const allSelected = selectedInGroup === group.length;
              return (
                <div key={type}>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedAbilities(
                          allSelected
                            ? selectedAbilities.filter((id) => !groupIds.includes(id))
                            : [...new Set([...selectedAbilities, ...groupIds])],
                        )
                      }
                      className="text-[10px] uppercase tracking-wide font-semibold text-text-muted/70 hover:text-text transition-colors"
                      title={allSelected ? `Clear all ${label}` : `Select all ${label}`}
                    >
                      {label}
                    </button>
                    <span className="text-[10px] text-text-muted/50">{selectedInGroup}/{group.length}</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {group.map((a) => (
                      <button
                        key={a.id}
                        onClick={() => toggleAbility(a.id)}
                        className={`px-2 py-0.5 rounded text-2xs font-medium border transition-colors ${
                          selectedAbilities.includes(a.id)
                            ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-400'
                            : 'bg-surface border-border text-text-muted hover:text-text'
                        }`}
                      >
                        {a.name}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Enemy setup */}
        <div>
          <label className="text-2xs text-text-muted font-medium block mb-1">Enemies</label>
          <div className="space-y-1.5">
            {enemySetup.map((entry, i) => (
              <div key={i} className="flex items-center gap-2">
                <select
                  value={entry.archetypeId}
                  onChange={(e) => {
                    const next = [...enemySetup];
                    next[i] = { ...next[i], archetypeId: e.target.value };
                    setEnemySetup(next);
                  }}
                  aria-label={`Enemy group ${i + 1} archetype`}
                  className="flex-1 px-2 py-1 bg-surface border border-border rounded-lg text-xs text-text cursor-pointer"
                >
                  {enemyArchetypes.map((arch) => (
                    <option key={arch.id} value={arch.id}>{arch.name}</option>
                  ))}
                </select>
                <span className="text-2xs text-text-muted">×</span>
                <NumberField
                  value={entry.count}
                  min={1}
                  max={10}
                  fallback={1}
                  onChange={(count) => {
                    const next = [...enemySetup];
                    next[i] = { ...next[i], count };
                    setEnemySetup(next);
                  }}
                  ariaLabel={`Enemy group ${i + 1} count`}
                  className="w-12 px-2 py-1 bg-surface border border-border rounded-lg text-xs text-text text-center"
                />
                <span className="text-2xs text-text-muted">Lvl</span>
                <NumberField
                  value={entry.level}
                  min={1}
                  max={50}
                  fallback={1}
                  onChange={(level) => {
                    const next = [...enemySetup];
                    next[i] = { ...next[i], level };
                    setEnemySetup(next);
                  }}
                  ariaLabel={`Enemy group ${i + 1} level`}
                  className="w-12 px-2 py-1 bg-surface border border-border rounded-lg text-xs text-text text-center"
                />
                {enemySetup.length > 1 && (
                  <button
                    onClick={() => setEnemySetup(enemySetup.filter((_, j) => j !== i))}
                    className="text-2xs text-text-muted hover:text-red-400 transition-colors"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={() => setEnemySetup([...enemySetup, { archetypeId: 'melee-grunt', count: 1, level: playerLevel }])}
              className="text-2xs text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              + Add enemy group
            </button>
          </div>
        </div>
      </div>
    </SurfaceCard>
  );
}

// ── Ability Heatmap ─────────────────────────────────────────────────────────

function AbilityHeatmap({ heatmap }: { heatmap: Record<string, number> }) {
  const entries = Object.entries(heatmap).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return null;
  const maxUses = Math.max(...entries.map(([, v]) => v), 1);

  return (
    <SurfaceCard className="p-4">
      <div className="flex items-center gap-2 mb-2">
        <BarChart3 className="w-4 h-4 text-cyan-400" />
        <h2 className="text-sm font-medium text-text">
          <MetricLabel metricId="abilityHeatmap" label="Ability Usage Heatmap" />
        </h2>
        <span className="text-2xs text-text-muted">(avg uses per fight)</span>
      </div>
      {/* Decode the two bar colors so usage tier isn't conveyed by hue alone. */}
      <ChartLegend
        className="mb-3"
        dense
        ariaLabel="Ability heatmap legend"
        items={[
          { color: ACCENT_CYAN_LIGHT, label: 'Used', description: 'avg uses/fight' },
          { color: STATUS_WARNING, label: 'Under-used', description: '< 0.1/fight' },
        ]}
      />
      <div className="space-y-1.5">
        {entries.map(([name, avgUses]) => {
          const w = (avgUses / maxUses) * 100;
          const isLow = avgUses < 0.1;
          // The longest bars carry their value directly on the bar; shorter rows
          // keep the value in the trailing column so it's never lost in the fill.
          const annotateInline = w >= 45;
          return (
            <div key={name} className="flex items-center gap-3">
              <span className={`text-2xs w-28 truncate flex-shrink-0 ${isLow ? 'text-amber-400' : 'text-text-muted'}`}>{name}</span>
              <div className="relative flex-1 h-4 bg-surface-deep rounded overflow-hidden">
                <div
                  className={`h-full rounded transition-all ${isLow ? 'bg-amber-400/50' : 'bg-cyan-400/50'}`}
                  style={{ width: `${w}%` }}
                />
                {annotateInline && (
                  <span
                    className="absolute inset-y-0 flex items-center"
                    style={{ right: `calc(${100 - w}% + 4px)` }}
                  >
                    {/* Dark chip guarantees the value's contrast over any fill color. */}
                    <span className="rounded bg-surface-deep/80 px-1 text-[10px] font-mono font-semibold tabular-nums text-text leading-none">
                      {avgUses.toFixed(1)}
                    </span>
                  </span>
                )}
              </div>
              <span className={`text-2xs font-mono w-10 text-right flex-shrink-0 tabular-nums ${isLow ? 'text-amber-400' : 'text-text-muted'}`}>
                {annotateInline ? '' : avgUses.toFixed(1)}
              </span>
            </div>
          );
        })}
      </div>
    </SurfaceCard>
  );
}

// ── Threat Breakdown (Death Recap) ──────────────────────────────────────────

function ThreatBreakdownPanel({ breakdown }: { breakdown: ThreatBreakdown }) {
  const { bySource, byEnemy, totalDeaths, totalDamageTaken } = breakdown;

  if (totalDamageTaken === 0 && bySource.length === 0) return null;

  const topSource = bySource[0];

  const headline = totalDeaths > 0 && topSource && topSource.killShare > 0
    ? `${pct(topSource.killShare)} of deaths came from the ${topSource.enemy} ${topSource.ability.toLowerCase()}`
    : topSource && topSource.damageShare > 0
      ? `${pct(topSource.damageShare)} of damage taken came from the ${topSource.enemy} ${topSource.ability.toLowerCase()}`
      : 'No threats recorded';

  const topSources = bySource.slice(0, 5);
  const topEnemies = byEnemy.slice(0, Math.min(4, byEnemy.length));

  return (
    <SurfaceCard className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <Skull className="w-4 h-4 text-red-400" />
        <h2 className="text-sm font-medium text-text">Death Recap & Threat Breakdown</h2>
        <span className="text-2xs text-text-muted">
          {totalDeaths} death{totalDeaths === 1 ? '' : 's'} · {formatNumber(totalDamageTaken)} dmg taken
        </span>
      </div>

      {/* Headline */}
      <div className="mb-3 px-3 py-2 rounded-lg bg-status-red-subtle border border-status-red-strong">
        <div className="flex items-center gap-2">
          <Flame className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
          <span className="text-xs text-text">{headline}</span>
        </div>
        {topSource && topSource.nerfSuggestion !== 'Within tolerance.' && (
          <div className="mt-1 ml-5 text-2xs text-text-muted/90 italic">
            Nerf hint: {topSource.nerfSuggestion}
          </div>
        )}
      </div>

      {/* Key for the dual-bar encoding — kill share (red) over damage share (amber). */}
      <ChartLegend
        className="mb-3"
        dense
        ariaLabel="Threat bar legend"
        items={[
          {
            color: STATUS_ERROR,
            label: 'Kill share',
            labelNode: <MetricLabel metricId="killShare" label="Kill share" className="text-2xs font-medium text-text" />,
            description: '% of deaths',
          },
          {
            color: STATUS_WARNING,
            label: 'Damage share',
            labelNode: <MetricLabel metricId="damageShare" label="Damage share" className="text-2xs font-medium text-text" />,
            description: '% of damage taken',
          },
        ]}
      />

      {/* Per-enemy ranking */}
      {topEnemies.length > 0 && (
        <div className="mb-4">
          <div className="text-2xs text-text-muted font-medium uppercase tracking-wide mb-1.5">
            By enemy
          </div>
          <div className="space-y-1.5">
            {topEnemies.map((e) => (
              <ThreatRow
                key={e.enemy}
                label={e.enemy}
                killShare={e.killShare}
                damageShare={e.damageShare}
                killCount={e.killCount}
                nerfSuggestion={e.nerfSuggestion}
              />
            ))}
          </div>
        </div>
      )}

      {/* Per-source ranking (enemy → ability) */}
      {topSources.length > 0 && (
        <div>
          <div className="text-2xs text-text-muted font-medium uppercase tracking-wide mb-1.5">
            By ability
          </div>
          <div className="space-y-1.5">
            {topSources.map((s) => (
              <ThreatRow
                key={`${s.enemy}|${s.abilityId}`}
                label={`${s.enemy} → ${s.ability}`}
                killShare={s.killShare}
                damageShare={s.damageShare}
                killCount={s.killCount}
                nerfSuggestion={s.nerfSuggestion}
              />
            ))}
          </div>
        </div>
      )}
    </SurfaceCard>
  );
}

function ThreatRow({
  label, killShare, damageShare, killCount, nerfSuggestion,
}: {
  label: string;
  killShare: number;
  damageShare: number;
  killCount: number;
  nerfSuggestion: string;
}) {
  const isTopThreat = killShare >= 0.4 || damageShare >= 0.3;
  const hasNerf = nerfSuggestion !== 'Within tolerance.';
  return (
    <div className="flex flex-col gap-1 px-2 py-1.5 rounded bg-surface-deep/50">
      <div className="flex items-center gap-2">
        <span className={`text-2xs flex-1 truncate ${isTopThreat ? 'text-red-400 font-medium' : 'text-text'}`}>
          {label}
        </span>
        <span className="text-2xs text-text-muted whitespace-nowrap">
          {killCount > 0 && (
            <>
              <span className={isTopThreat ? 'text-red-400 font-mono' : 'text-text font-mono'}>{pct(killShare)}</span>
              <span className="text-text-muted/60"> kills · </span>
            </>
          )}
          <span className="font-mono">{pct(damageShare)}</span>
          <span className="text-text-muted/60"> dmg</span>
        </span>
      </div>
      {/* Dual-bar: kill share (red) on top of damage share (amber) */}
      <div className="flex items-center gap-3">
        <div className="flex-1 relative h-2 bg-surface-deep rounded overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-amber-400/50"
            style={{ width: `${Math.min(100, damageShare * 100)}%` }}
          />
          {killShare > 0 && (
            <div
              className="absolute inset-y-0 left-0 bg-red-400/70 border-r border-red-400/80"
              style={{ width: `${Math.min(100, killShare * 100)}%` }}
            />
          )}
        </div>
      </div>
      {hasNerf && (
        <div className="text-2xs text-text-muted/80 italic pl-0.5">
          {nerfSuggestion}
        </div>
      )}
    </div>
  );
}

function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(Math.round(n));
}

// ── Fight Report Card (Story Mode) ──────────────────────────────────────────

/**
 * Narrated, shareable plain-language summary of a finished run — the headline
 * answer a non-technical stakeholder grasps in one read. Reads from the pure
 * `narrateSummary` generator; a Copy button exports it as shareable text.
 */
function FightReportCardPanel({
  report, scenarioName, iterations,
}: {
  report: FightReportCard;
  scenarioName?: string;
  iterations?: number;
}) {
  const [copied, setCopied] = useState(false);
  const style = BAND_STYLE[report.band];

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(formatReportCardText(report, scenarioName));
      setCopied(true);
      window.setTimeout(() => setCopied(false), UI_TIMEOUTS.copyFeedback);
    } catch {
      // Clipboard unavailable (e.g. insecure context) — silently ignore.
    }
  }, [report, scenarioName]);

  return (
    <SurfaceCard className={`p-5 border ${style.border}`}>
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className={`w-4 h-4 ${style.text}`} />
        <h2 className="text-sm font-medium text-text">Fight Report Card</h2>
        <span className={`px-2 py-0.5 rounded-full text-2xs font-semibold ${style.bg} ${style.text}`}>
          {style.label}
        </span>
        <button
          onClick={handleCopy}
          title="Copy this report as shareable text"
          className="focus-ring ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border text-2xs text-text-muted hover:text-text transition-colors"
        >
          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      {/* Headline (win rate) */}
      <p className={`text-lg font-semibold leading-snug ${style.text}`}>{report.headline}</p>

      {/* Verdict (pace) */}
      <p className="mt-1 text-sm text-text-muted">{report.verdict}</p>

      {/* Top fix (dominant threat) */}
      {report.topFix && (
        <div className={`mt-3 flex items-start gap-2 px-3 py-2 rounded-lg border ${style.bg} ${style.border}`}>
          <Skull className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${style.text}`} />
          <p className="text-xs text-text leading-relaxed">{report.topFix}</p>
        </div>
      )}

      {/* Secondary call-outs */}
      {report.notes.length > 0 && (
        <ul className="mt-3 space-y-1">
          {report.notes.map((note, i) => (
            <li key={i} className="flex items-start gap-2 text-2xs text-text-muted">
              <AlertTriangle className="w-3 h-3 text-amber-400 flex-shrink-0 mt-0.5" />
              <span>{note}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Sample-size footnote */}
      {iterations != null && (
        <p className="mt-3 text-2xs text-text-muted/60">
          Based on {iterations.toLocaleString()} simulated fights.
        </p>
      )}
    </SurfaceCard>
  );
}

// ── Distribution Chart ──────────────────────────────────────────────────────

function DistributionChart({
  title, buckets, color, unit = '',
}: {
  title: string;
  buckets: { min: number; max: number; count: number }[];
  color: 'emerald' | 'red' | 'blue';
  unit?: string;
}) {
  if (buckets.length === 0) return null;
  const maxCount = Math.max(...buckets.map((b) => b.count), 1);
  const colorMap = {
    emerald: 'bg-emerald-400/70',
    red: 'bg-red-400/70',
    blue: 'bg-blue-400/70',
  };

  // Median (p50) + tail (p95) markers give the spread a non-color, structural
  // read so the shape is legible even where the bar fill is hard to perceive.
  const lo = buckets[0].min;
  const hi = buckets[buckets.length - 1].max;
  const range = hi - lo || 1;
  const frac = (v: number) => Math.max(0, Math.min(1, (v - lo) / range));
  const p50 = percentileFromBuckets(buckets, 0.5);
  const p95 = percentileFromBuckets(buckets, 0.95);

  return (
    <SurfaceCard className="p-3">
      <div className="text-2xs text-text-muted font-medium mb-2">{title}</div>
      <div className="relative flex items-end gap-px h-16">
        {buckets.map((b, i) => {
          const h = (b.count / maxCount) * 100;
          return (
            <div key={i} className="flex-1 group relative">
              <div className={`w-full rounded-t-sm ${colorMap[color]}`} style={{ height: `${h}%` }} />
              <div className="absolute bottom-full mb-1 hidden group-hover:block z-20 left-1/2 -translate-x-1/2">
                <div className="bg-surface-deep border border-border rounded px-1.5 py-0.5 text-2xs text-text-muted whitespace-nowrap">
                  {b.min.toFixed(0)}{unit}-{b.max.toFixed(0)}{unit}: {b.count}
                </div>
              </div>
            </div>
          );
        })}
        {p50 != null && <PercentileMarker fraction={frac(p50)} label="p50" />}
        {p95 != null && <PercentileMarker fraction={frac(p95)} label="p95" dashed />}
      </div>
      <div className="flex justify-between text-2xs text-text-muted/50 mt-1">
        <span>{buckets[0]?.min.toFixed(0)}{unit}</span>
        <span>{buckets[buckets.length - 1]?.max.toFixed(0)}{unit}</span>
      </div>
    </SurfaceCard>
  );
}

/** A labeled vertical percentile line overlaid on a distribution's bars. */
function PercentileMarker({ fraction, label, dashed }: {
  fraction: number; label: string; dashed?: boolean;
}) {
  const flip = fraction > 0.85; // keep the label inside the chart near the right edge
  return (
    <div
      className="pointer-events-none absolute top-0 bottom-0 z-10"
      style={{ left: `${fraction * 100}%` }}
      aria-hidden="true"
    >
      <div
        className="absolute top-0 bottom-0 left-0"
        style={{ borderLeftWidth: 1, borderLeftStyle: dashed ? 'dashed' : 'solid', borderLeftColor: 'var(--text-muted)' }}
      />
      <span className={`absolute -top-1 ${flip ? 'right-0.5' : 'left-0.5'} text-[9px] font-mono leading-none text-text-muted whitespace-nowrap`}>
        {label}
      </span>
    </div>
  );
}

// ── Balance Alerts ──────────────────────────────────────────────────────────

function AlertsSection({ alerts }: { alerts: BalanceAlert[] }) {
  if (alerts.length === 0) {
    return (
      <SurfaceCard className="p-4">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-medium text-text">Balance Check</span>
          <Badge variant="success">Encounter Balanced</Badge>
        </div>
      </SurfaceCard>
    );
  }

  return (
    <SurfaceCard className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="w-4 h-4 text-amber-400" />
        <h2 className="text-sm font-medium text-text">Balance Alerts</h2>
        <Badge variant={alerts.some((a) => a.severity === 'critical') ? 'error' : 'warning'}>
          {alerts.length} issues
        </Badge>
      </div>
      <div className="space-y-1.5">
        {alerts.map((alert, i) => {
          const style = SEVERITY_STYLE[alert.severity];
          return (
            <div key={i} className={`flex items-start gap-2 px-3 py-2 rounded-lg border ${style.bg} ${style.border}`}>
              <AlertTriangle className={`w-3 h-3 ${style.text} flex-shrink-0 mt-0.5`} />
              <span className="text-2xs text-text-muted/80">{alert.message}</span>
            </div>
          );
        })}
      </div>
    </SurfaceCard>
  );
}

// ── Small Components ────────────────────────────────────────────────────────

function StatCard({ icon, value, label, color, metricId }: {
  icon: React.ReactNode; value: string | number; label: string; color: string;
  /** When set, the label decodes its jargon via an inline `MetricLabel` tooltip. */
  metricId?: string;
}) {
  return (
    <KPICard
      icon={icon}
      label={metricId ? <MetricLabel metricId={metricId} label={label} /> : label}
      value={<span className={color}>{value}</span>}
    />
  );
}

function MiniStat({ label, value, alert, metricId }: {
  label: string; value: string; alert?: boolean;
  /** When set, the label decodes its jargon via an inline `MetricLabel` tooltip. */
  metricId?: string;
}) {
  return (
    <div>
      <div className={`text-sm font-semibold ${alert ? 'text-red-400' : 'text-text'}`}>{value}</div>
      <div className="text-2xs text-text-muted">
        {metricId ? <MetricLabel metricId={metricId} label={label} /> : label}
      </div>
    </div>
  );
}
