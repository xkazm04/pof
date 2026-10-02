/**
 * Tested fixes — every "Try" in the Balance Health Report as a solved, seeded lever.
 *
 * Registry: game-production/encounter-balance-simulation
 * #goal-seek-on-a-seeded-monotonic-lever ("Sweeping and solving are different
 * questions"). The GAS sim is seeded (`runSimulation(scenario, seed)`), so
 * `metric(multiplier)` is a pure function and the shared bisection `solveFor`
 * applies. A 5-point pre-sweep runs first; a non-monotonic curve or a target the
 * sweep never reaches is refused with the sweep's own numbers. A refused or
 * unconverged solve carries `spec: null`, so no caller can offer Apply for it.
 *
 * Pure: no React, no DOM.
 */

import { solveFor } from '@/lib/balance/goal-seek';
import { SURVIVAL_TARGET, TTK_TARGET_SEC, difficultyBand, fightLengthBand } from '@/lib/balance/encounter-bands';
import { runSimulation, referenceIncomingHit, GAS_SIM_DEFAULT_SEED } from './simulation';
import { buildBalanceHealthReport, targetArmorFor, type HealthGrade } from './balanceHealth';
import { STAT_BOUNDS, type CombatantStats, type NumericStatKey, type SimResults, type SimScenario } from './data';

export type GasLeverId = 'playerHealth' | 'playerDamage' | 'enemyHealth' | 'enemyDamage';
export type FixMetric = 'survival' | 'ttk';
export type SolvableFindingId = 'survival' | 'duration';
export type FixSpec = { lever: GasLeverId; multiplier: number } | { lever: 'playerArmor'; value: number };

interface GasLever { label: string; side: 'player' | 'enemy'; stats: NumericStatKey[]; effect: Record<FixMetric, 1 | -1> }

/** A damage lever scales base damage AND attack power (raw hit = base·(1 + power/100)). */
export const GAS_LEVERS: Record<GasLeverId, GasLever> = {
  playerHealth: { label: 'Player HP', side: 'player', stats: ['maxHealth'], effect: { survival: 1, ttk: 1 } },
  playerDamage: { label: 'Player damage', side: 'player', stats: ['baseDamage', 'attackPower'], effect: { survival: 1, ttk: -1 } },
  enemyHealth: { label: 'Enemy HP', side: 'enemy', stats: ['maxHealth'], effect: { survival: -1, ttk: 1 } },
  enemyDamage: { label: 'Enemy damage', side: 'enemy', stats: ['baseDamage', 'attackPower'], effect: { survival: -1, ttk: -1 } },
};

/**
 * Finding → the metric its fix moves, the report's own target, the candidate levers,
 * and `lands`: the value the finding reads healthy at (the fair / healthy band). A
 * seeded sim is a step function of a stat (a whole extra hit flips many fights at
 * once), so the bisection aims at the target and the fix takes the evaluated value
 * nearest it — accepted only when it lands in that band.
 */
export const FIX_TARGETS: Record<SolvableFindingId, { metric: FixMetric; target: number; tolerance: number; lands: (v: number) => boolean; levers: GasLeverId[] }> = {
  survival: { metric: 'survival', target: SURVIVAL_TARGET, tolerance: 0.01, lands: v => difficultyBand(v) === 'fair', levers: ['playerHealth', 'enemyDamage', 'playerDamage', 'enemyHealth'] },
  duration: { metric: 'ttk', target: TTK_TARGET_SEC, tolerance: 0.1, lands: v => fightLengthBand(v) === 'healthy', levers: ['enemyHealth', 'playerDamage'] },
};

/** How far a lever may move from the current value: ×0.1 to ×10, never outside STAT_BOUNDS. */
const MULT_SPAN = { min: 0.1, max: 10 } as const;
export const SOLVE_ITERATIONS = 500;

export function isSolvableFinding(id: string): id is SolvableFindingId { return id in FIX_TARGETS; }

/* ── Apply ────────────────────────────────────────────────────────────────── */

function scaleStat(stats: CombatantStats, key: NumericStatKey, m: number): number {
  const { min, max } = STAT_BOUNDS[key];
  const raw = stats[key] * m;
  const rounded = key === 'maxHealth' ? Math.round(raw) : Math.round(raw * 100) / 100;
  return Math.min(max, Math.max(min, rounded));
}

/** The scenario with one lever applied, clamped to STAT_BOUNDS. The input is never mutated. */
export function applyFix(scenario: SimScenario, spec: FixSpec): SimScenario {
  const id = `${scenario.id.split('~')[0]}~${spec.lever}`;
  if (spec.lever === 'playerArmor') {
    const { min, max } = STAT_BOUNDS.armor;
    return { ...scenario, id, player: { ...scenario.player, armor: Math.min(max, Math.max(min, spec.value)) } };
  }
  const lever = GAS_LEVERS[spec.lever];
  const scale = (s: CombatantStats): CombatantStats =>
    lever.stats.reduce((acc, k) => ({ ...acc, [k]: scaleStat(s, k, spec.multiplier) }), { ...s });
  return lever.side === 'player'
    ? { ...scenario, id, player: scale(scenario.player), enemies: scenario.enemies.map(e => ({ ...e, stats: { ...e.stats } })) }
    : { ...scenario, id, player: { ...scenario.player }, enemies: scenario.enemies.map(e => ({ ...e, stats: scale(e.stats) })) };
}

/** Multiplier span a lever can move over this scenario without leaving STAT_BOUNDS. */
function leverSpan(scenario: SimScenario, lever: GasLeverId): { min: number; max: number } {
  const g = GAS_LEVERS[lever];
  const holders = g.side === 'player' ? [scenario.player] : scenario.enemies.map(e => e.stats);
  let min: number = MULT_SPAN.min, max: number = MULT_SPAN.max;
  for (const s of holders) for (const k of g.stats) {
    if (s[k] <= 0) continue;
    max = Math.min(max, STAT_BOUNDS[k].max / s[k]);
    min = Math.max(min, STAT_BOUNDS[k].min / s[k]);
  }
  return { min, max };
}

/* ── Solve ────────────────────────────────────────────────────────────────── */

export interface LeverSolve {
  applicable: boolean;
  converged: boolean;
  value: number | null;
  achieved: number | null;
  sweep: { value: number; metric: number }[];
  evals: number;
  reason: string;
}

const num = (v: number) => (Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2));

/** Sweep before solve: 5 points, refuse a fold or an out-of-reach target, then `solveFor`. */
export function solveLever(
  metric: (v: number) => number, target: number, range: [number, number],
  opts: { tolerance?: number; lands?: (m: number) => boolean; format?: (m: number) => string; name?: string } = {},
): LeverSolve {
  const [min, max] = range[0] <= range[1] ? range : [range[1], range[0]];
  const tol = opts.tolerance ?? Math.max(1e-6, Math.abs(target) * 0.005);
  const fmt = opts.format ?? num;
  const name = opts.name ?? 'metric';
  const memo = new Map<number, number>();
  const at = (v: number) => { const hit = memo.get(v); if (hit !== undefined) return hit; const y = metric(v); memo.set(v, y); return y; };
  // Spelled the way solveFor computes its endpoints and midpoint, so those are memo hits.
  const sweep = [min, min + (max - min) / 4, (min + max) / 2, min + (3 * (max - min)) / 4, max].map(value => ({ value, metric: at(value) }));
  const f = sweep.map(p => p.metric);
  const steps = f.slice(1).map((y, i) => y - f[i]);
  const shown = sweep.map(p => `×${num(p.value)}→${fmt(p.metric)}`).join(', ');
  const refuse = (reason: string): LeverSolve => ({ applicable: false, converged: false, value: null, achieved: null, sweep, evals: memo.size, reason });
  if (steps.some(d => d > tol) && steps.some(d => d < -tol)) {
    return refuse(`${name} is non-monotonic over ×${num(min)}–×${num(max)} (${shown}); a bisection would chase the fold, so nothing was solved.`);
  }
  const lo = Math.min(...f), hi = Math.max(...f);
  if (target < lo - tol || target > hi + tol) {
    return refuse(`The ${fmt(target)} target is out of reach: the achievable ${name} over ×${num(min)}–×${num(max)} is ${fmt(lo)}–${fmt(hi)} (${shown}).`);
  }
  const res = solveFor(target, { min, max }, at, { tolerance: tol, maxIterations: 24 });
  if (res.converged) {
    return { applicable: true, converged: true, value: res.solvedValue, achieved: res.achievedMetric, sweep, evals: memo.size, reason: `Converged in ${memo.size} seeded evaluations.` };
  }
  // The metric steps across the target: take the evaluated value nearest it.
  let best = { value: res.solvedValue, metric: res.achievedMetric };
  for (const [value, y] of memo) if (Math.abs(y - target) < Math.abs(best.metric - target)) best = { value, metric: y };
  const ok = opts.lands?.(best.metric) ?? false;
  const step = `${name} steps across the ${fmt(target)} target; the nearest value is ×${num(best.value)} → ${fmt(best.metric)}`;
  return {
    applicable: ok, converged: ok, value: ok ? best.value : null, achieved: best.metric, sweep, evals: memo.size,
    reason: ok ? `${step} (${memo.size} seeded evaluations).` : `${step}, which does not fix the finding, so nothing was solved.`,
  };
}

export interface FixMeasure { metric: number; score: number; grade: HealthGrade }

export interface FixSolution {
  findingId: string;
  lever: GasLeverId | 'playerArmor';
  label: string;
  /** What Apply hands to `applyFix`; null = refused or unconverged, so no Apply. */
  spec: FixSpec | null;
  multiplier: number | null;
  metric: FixMetric | null;
  target: number | null;
  before: FixMeasure;
  after: FixMeasure | null;
  scoreDelta?: number;
  converged: boolean;
  applicable: boolean;
  reason: string;
}

export const formatMetric = (metric: FixMetric, v: number) => (metric === 'survival' ? `${Math.round(v * 100)}%` : `${v.toFixed(1)}s`);
const readMetric = (metric: FixMetric, r: SimResults) => (metric === 'survival' ? r.survivalRate : r.ttkStats.mean);

interface SolveOpts { range?: [number, number]; iterations?: number; seed?: number }

function measure(scenario: SimScenario, o: SolveOpts): { results: SimResults; m: Omit<FixMeasure, 'metric'> } {
  const results = runSimulation({ ...scenario, iterations: o.iterations ?? SOLVE_ITERATIONS }, o.seed ?? GAS_SIM_DEFAULT_SEED);
  const rep = buildBalanceHealthReport(results, scenario);
  return { results, m: { score: rep.score, grade: rep.grade } };
}

/** Solve one lever so the finding's metric lands on the report's own target. */
export function solveFix(scenario: SimScenario, findingId: SolvableFindingId, lever: GasLeverId, o: SolveOpts = {}): FixSolution {
  const { metric, target, tolerance, lands } = FIX_TARGETS[findingId];
  const b = measure(scenario, o);
  const before = { metric: readMetric(metric, b.results), ...b.m };
  const base = { findingId, lever, label: GAS_LEVERS[lever].label, metric, target, before, spec: null, multiplier: null, after: null, converged: false, applicable: false };
  const need = Math.sign(target - before.metric) * GAS_LEVERS[lever].effect[metric];
  if (Math.abs(target - before.metric) <= tolerance) return { ...base, converged: true, reason: `Already on the ${formatMetric(metric, target)} target.` };
  const span = leverSpan(scenario, lever);
  const range = o.range ?? (need > 0 ? [1, span.max] : [span.min, 1]) as [number, number];
  const at = (m: number) => readMetric(metric, runSimulation({ ...applyFix(scenario, { lever, multiplier: m }), iterations: o.iterations ?? SOLVE_ITERATIONS }, o.seed ?? GAS_SIM_DEFAULT_SEED));
  const s = solveLever(at, target, range, { tolerance, lands, format: v => formatMetric(metric, v), name: metric });
  const capped = !o.range && (need > 0 ? span.max < MULT_SPAN.max : span.min > MULT_SPAN.min) ? ' (range capped by STAT_BOUNDS)' : '';
  if (!s.applicable || s.value === null) return { ...base, reason: s.reason + capped };
  const spec: FixSpec = { lever, multiplier: s.value };
  const a = measure(applyFix(scenario, spec), o);
  const after = { metric: readMetric(metric, a.results), ...a.m };
  return { ...base, spec, multiplier: s.value, after, scoreDelta: after.score - before.score, converged: true, applicable: true, reason: s.reason };
}

/** The defence finding needs no search: armor goes to the report's own target (2.5× the reference hit). */
export function solveDefenceFix(scenario: SimScenario, o: SolveOpts = {}): FixSolution {
  const b = measure(scenario, o);
  const refHit = referenceIncomingHit(scenario.enemies);
  const base = { findingId: 'defense', lever: 'playerArmor' as const, label: 'Armor', metric: null, target: null, multiplier: null, before: { metric: scenario.player.armor, ...b.m } };
  if (!(refHit > 0)) return { ...base, spec: null, after: null, converged: false, applicable: false, reason: 'No enemy hit to measure armor against.' };
  const spec: FixSpec = { lever: 'playerArmor', value: targetArmorFor(refHit) };
  const applied = applyFix(scenario, spec);
  const a = measure(applied, o);
  const after = { metric: applied.player.armor, ...a.m };
  return { ...base, target: applied.player.armor, spec, after, scoreDelta: after.score - base.before.score, converged: true, applicable: true, reason: 'Set, not searched.' };
}

/** Findings a Solve button serves: the two searched metrics plus the set-not-searched defence fix. */
export function hasFixFor(findingId: string): boolean { return findingId === 'defense' || isSolvableFinding(findingId); }

/**
 * One job per candidate lever for a finding, so a UI caller can yield between them.
 * Run them all and `rankFixes` the results for the best measured trade first.
 */
export function fixJobs(scenario: SimScenario, findingId: string, o: SolveOpts = {}): (() => FixSolution)[] {
  if (findingId === 'defense') return [() => solveDefenceFix(scenario, o)];
  if (!isSolvableFinding(findingId)) return [];
  return FIX_TARGETS[findingId].levers.map(l => () => solveFix(scenario, findingId, l, o));
}

/* ── Rank ─────────────────────────────────────────────────────────────────── */

/** Measured grade delta first (largest gain first), unmeasured next in input order, refused last. */
export function rankFixes<T extends { scoreDelta?: number; applicable?: boolean }>(fixes: readonly T[]): T[] {
  const group = (f: T) => (f.applicable === false ? 2 : f.scoreDelta === undefined ? 1 : 0);
  return fixes
    .map((f, i) => ({ f, i }))
    .sort((x, y) => group(x.f) - group(y.f) || (group(x.f) === 0 ? y.f.scoreDelta! - x.f.scoreDelta! : 0) || x.i - y.i)
    .map(({ f }) => f);
}
