'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Swords, Play, RefreshCw, Heart, Shield, Zap,
  ChevronDown, ChevronRight, AlertTriangle, Target,
  Activity, BarChart3, Users, Flame, ShieldAlert,
  TrendingUp, Crosshair, Clock,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { Badge } from '@/components/ui/Badge';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { useCombatSimulatorStore } from '@/stores/combatSimulatorStore';
import { MODULE_COLORS } from '@/lib/chart-colors';
import type {
  CombatScenario,
  TuningOverrides,
  CombatSimConfig,
  CombatSummary,
  BalanceAlert,
  BalanceAlertSeverity,
  GearLoadout,
  CombatAbility,
} from '@/types/combat-simulator';

// ── Constants ───────────────────────────────────────────────────────────────

const EMPTY_ALERTS: BalanceAlert[] = [];

const SEVERITY_STYLE: Record<BalanceAlertSeverity, { bg: string; border: string; text: string }> = {
  info: { bg: 'bg-blue-400/10', border: 'border-blue-400/20', text: 'text-blue-400' },
  warning: { bg: 'bg-amber-400/10', border: 'border-amber-400/20', text: 'text-amber-400' },
  critical: { bg: 'bg-red-400/10', border: 'border-red-400/20', text: 'text-red-400' },
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
  const tuning = useCombatSimulatorStore((s) => s.tuning);
  const isLoading = useCombatSimulatorStore((s) => s.isLoading);
  const isSimulating = useCombatSimulatorStore((s) => s.isSimulating);
  const error = useCombatSimulatorStore((s) => s.error);

  const fetchDefaults = useCombatSimulatorStore((s) => s.fetchDefaults);
  const runSimulation = useCombatSimulatorStore((s) => s.runSimulation);
  const setTuning = useCombatSimulatorStore((s) => s.setTuning);

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
    ? summary.survivalRate > 0.7 ? '#10b981' : summary.survivalRate > 0.4 ? MODULE_COLORS.content : MODULE_COLORS.evaluator
    : '#666';

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500/20 to-orange-500/20 border border-status-red-strong flex items-center justify-center">
            <Swords className="w-5 h-5 text-red-400" />
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-text">Combat Balance Simulator</h1>
            <p className="text-xs text-text-muted">
              GAS-based Monte Carlo combat simulation with balance tuning
            </p>
          </div>
          <button
            onClick={handleRun}
            disabled={isSimulating || !tuning}
            className="flex items-center gap-1.5 px-4 py-2 bg-status-red-subtle border border-status-red-strong rounded-lg text-red-400 text-xs font-medium hover:bg-status-red-medium transition-colors disabled:opacity-50"
          >
            {isSimulating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            {isSimulating ? `Simulating ${iterations}...` : `Run ${iterations} Fights`}
          </button>
        </div>

        {/* Summary stats */}
        {summary && (
          <div className="flex gap-3 mb-4">
            <SurfaceCard className="flex items-center gap-2.5 px-3 py-2 flex-1" level={2}>
              <ProgressRing value={Math.round(summary.survivalRate * 100)} size={36} strokeWidth={3} color={survivalColor} />
              <div>
                <div className="text-sm font-semibold" style={{ color: survivalColor }}>{(summary.survivalRate * 100).toFixed(1)}%</div>
                <div className="text-2xs text-text-muted">Survival</div>
              </div>
            </SurfaceCard>
            <StatCard icon={<Clock className="w-4 h-4 text-blue-400" />} value={`${summary.avgFightDurationSec.toFixed(1)}s`} label="Avg Duration" color="text-blue-400" />
            <StatCard icon={<Swords className="w-4 h-4 text-emerald-400" />} value={`${summary.avgDPS.toFixed(1)}`} label="Player DPS" color="text-emerald-400" />
            <StatCard icon={<Flame className="w-4 h-4 text-red-400" />} value={`${summary.avgEnemyDPS.toFixed(1)}`} label="Enemy DPS" color="text-red-400" />
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
            <div className="grid grid-cols-2 gap-4">
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
                        <span className="text-2xs text-text-muted w-20 flex-shrink-0">{label}</span>
                        <input
                          type="range"
                          min={50}
                          max={200}
                          value={Math.round(tuning[key] * 100)}
                          onChange={(e) => handleTuningChange(key, Number(e.target.value) / 100)}
                          className="flex-1 h-1 accent-amber-400 cursor-pointer"
                        />
                        <span className={`text-2xs font-mono w-10 text-right flex-shrink-0 ${
                          tuning[key] !== 1 ? 'text-amber-400' : 'text-text-muted'
                        }`}>
                          {(tuning[key] * 100).toFixed(0)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </SurfaceCard>
              )}
            </div>

            {/* Results */}
            {summary && (
              <>
                {/* Ability Heatmap */}
                <AbilityHeatmap heatmap={summary.abilityHeatmap} />

                {/* Distributions */}
                <div className="grid grid-cols-3 gap-4">
                  <DistributionChart title="Damage Dealt" buckets={summary.damageDealtBuckets} color="emerald" />
                  <DistributionChart title="Damage Taken" buckets={summary.damageTakenBuckets} color="red" />
                  <DistributionChart title="Fight Duration" buckets={summary.durationBuckets} color="blue" unit="s" />
                </div>

                {/* Extra stats */}
                <SurfaceCard className="p-4">
                  <div className="grid grid-cols-4 gap-4 text-center">
                    <MiniStat label="Avg Crit Rate" value={`${(summary.avgCritRate * 100).toFixed(1)}%`} />
                    <MiniStat label="One-Shot Rate" value={`${(summary.oneShotRate * 100).toFixed(1)}%`} alert={summary.oneShotRate > 0.05} />
                    <MiniStat label="Avg HP Left" value={`${summary.avgPlayerHealthRemaining.toFixed(0)}`} />
                    <MiniStat label="Median Duration" value={`${summary.medianFightDurationSec.toFixed(1)}s`} />
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

            {!summary && !isSimulating && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Swords className="w-12 h-12 text-text-muted/30 mb-3" />
                <p className="text-sm text-text-muted">Configure encounter and click "Run" to simulate</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Scenario Builder ────────────────────────────────────────────────────────

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
  enemyArchetypes: typeof enemySetup extends { archetypeId: string }[] ? any : any;
  iterations: number;
  setIterations: (v: number) => void;
}) {
  return (
    <SurfaceCard className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <Target className="w-4 h-4 text-cyan-400" />
        <h2 className="text-sm font-medium text-text">Scenario</h2>
      </div>

      <div className="space-y-3">
        {/* Player config */}
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-2xs text-text-muted font-medium block mb-1">Player Level</label>
            <input
              type="number"
              value={playerLevel}
              onChange={(e) => setPlayerLevel(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
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
            <input
              type="number"
              value={iterations}
              onChange={(e) => setIterations(Math.max(100, Math.min(5000, Number(e.target.value) || 1000)))}
              className="w-full px-2 py-1 bg-surface border border-border rounded-lg text-xs text-text focus:outline-none focus:border-status-red-strong"
            />
          </div>
        </div>

        {/* Abilities */}
        <div>
          <label className="text-2xs text-text-muted font-medium block mb-1">Abilities</label>
          <div className="flex flex-wrap gap-1">
            {abilities.map((a) => (
              <button
                key={a.id}
                onClick={() => {
                  if (selectedAbilities.includes(a.id)) {
                    setSelectedAbilities(selectedAbilities.filter((id) => id !== a.id));
                  } else {
                    setSelectedAbilities([...selectedAbilities, a.id]);
                  }
                }}
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
                  className="flex-1 px-2 py-1 bg-surface border border-border rounded-lg text-xs text-text cursor-pointer"
                >
                  {enemyArchetypes.map((e: any) => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
                <span className="text-2xs text-text-muted">×</span>
                <input
                  type="number"
                  value={entry.count}
                  onChange={(e) => {
                    const next = [...enemySetup];
                    next[i] = { ...next[i], count: Math.max(1, Math.min(10, Number(e.target.value) || 1)) };
                    setEnemySetup(next);
                  }}
                  className="w-12 px-2 py-1 bg-surface border border-border rounded-lg text-xs text-text text-center"
                />
                <span className="text-2xs text-text-muted">Lvl</span>
                <input
                  type="number"
                  value={entry.level}
                  onChange={(e) => {
                    const next = [...enemySetup];
                    next[i] = { ...next[i], level: Math.max(1, Math.min(50, Number(e.target.value) || 1)) };
                    setEnemySetup(next);
                  }}
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
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 className="w-4 h-4 text-cyan-400" />
        <h2 className="text-sm font-medium text-text">Ability Usage Heatmap</h2>
        <span className="text-2xs text-text-muted">(avg uses per fight)</span>
      </div>
      <div className="space-y-1.5">
        {entries.map(([name, avgUses]) => {
          const w = (avgUses / maxUses) * 100;
          const isLow = avgUses < 0.1;
          return (
            <div key={name} className="flex items-center gap-3">
              <span className={`text-2xs w-28 truncate flex-shrink-0 ${isLow ? 'text-amber-400' : 'text-text-muted'}`}>{name}</span>
              <div className="flex-1 h-3 bg-surface-deep rounded overflow-hidden">
                <div
                  className={`h-full rounded transition-all ${isLow ? 'bg-amber-400/30' : 'bg-cyan-400/40'}`}
                  style={{ width: `${w}%` }}
                />
              </div>
              <span className={`text-2xs font-mono w-10 text-right flex-shrink-0 ${isLow ? 'text-amber-400' : 'text-text-muted'}`}>
                {avgUses.toFixed(1)}
              </span>
            </div>
          );
        })}
      </div>
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
    emerald: 'bg-emerald-400/40',
    red: 'bg-red-400/40',
    blue: 'bg-blue-400/40',
  };

  return (
    <SurfaceCard className="p-3">
      <div className="text-2xs text-text-muted font-medium mb-2">{title}</div>
      <div className="flex items-end gap-px h-16">
        {buckets.map((b, i) => {
          const h = (b.count / maxCount) * 100;
          return (
            <div key={i} className="flex-1 group relative">
              <div className={`w-full rounded-t-sm ${colorMap[color]}`} style={{ height: `${h}%` }} />
              <div className="absolute bottom-full mb-1 hidden group-hover:block z-10 left-1/2 -translate-x-1/2">
                <div className="bg-surface-deep border border-border rounded px-1.5 py-0.5 text-2xs text-text-muted whitespace-nowrap">
                  {b.min.toFixed(0)}{unit}-{b.max.toFixed(0)}{unit}: {b.count}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-2xs text-text-muted/50 mt-1">
        <span>{buckets[0]?.min.toFixed(0)}{unit}</span>
        <span>{buckets[buckets.length - 1]?.max.toFixed(0)}{unit}</span>
      </div>
    </SurfaceCard>
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

function StatCard({ icon, value, label, color }: {
  icon: React.ReactNode; value: string | number; label: string; color: string;
}) {
  return (
    <SurfaceCard className="flex items-center gap-2.5 px-3 py-2 flex-1" level={2}>
      {icon}
      <div>
        <div className={`text-sm font-semibold ${color}`}>{value}</div>
        <div className="text-2xs text-text-muted">{label}</div>
      </div>
    </SurfaceCard>
  );
}

function MiniStat({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <div>
      <div className={`text-sm font-semibold ${alert ? 'text-red-400' : 'text-text'}`}>{value}</div>
      <div className="text-2xs text-text-muted">{label}</div>
    </div>
  );
}
