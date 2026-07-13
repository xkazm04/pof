import { describe, it, expect } from 'vitest';
import { solveFor } from '@/lib/balance/goal-seek';
import { solveEconomyFlowForTarget } from '@/lib/economy/goal-seek';
import { runWithFlowOverride } from '@/lib/economy/sensitivity-sweep';
import { solveCombatTuningForTarget } from '@/lib/combat/goal-seek';
import { runCombatSimulation } from '@/lib/combat/simulation-engine';
import { DEFAULT_TUNING, GEAR_LOADOUTS, PLAYER_ABILITIES } from '@/lib/combat/definitions';
import type { SimulationConfig } from '@/types/economy-simulator';
import type { CombatScenario, CombatSimConfig } from '@/types/combat-simulator';

// ── Generic bisection solver ─────────────────────────────────────────────────

describe('solveFor — generic bisection', () => {
  it('converges on an increasing metric (f(x)=2x, target 10 → x=5)', () => {
    const r = solveFor(10, { min: 0, max: 20 }, (x) => 2 * x, { tolerance: 1e-6 });
    expect(r.converged).toBe(true);
    expect(r.solvedValue).toBeCloseTo(5, 4);
    expect(r.achievedMetric).toBeCloseTo(10, 4);
    expect(r.iterations).toBeGreaterThan(2);
  });

  it('converges on a decreasing metric (f(x)=100−4x, target 20 → x=20)', () => {
    const r = solveFor(20, { min: 0, max: 30 }, (x) => 100 - 4 * x, { tolerance: 1e-6 });
    expect(r.converged).toBe(true);
    expect(r.solvedValue).toBeCloseTo(20, 4);
  });

  it('handles a target above the achievable range gracefully (nearest endpoint, not a throw)', () => {
    const r = solveFor(999, { min: 0, max: 20 }, (x) => 2 * x);
    expect(r.converged).toBe(false);
    expect(r.solvedValue).toBe(20);        // clamped to the max (closest reachable)
    expect(r.achievedMetric).toBe(40);
    expect(r.reason).toMatch(/outside the achievable range/);
  });

  it('handles a target below the achievable range gracefully', () => {
    const r = solveFor(-5, { min: 0, max: 20 }, (x) => 2 * x);
    expect(r.converged).toBe(false);
    expect(r.solvedValue).toBe(0);
  });

  it('treats a flat metric that already meets the target as converged', () => {
    const r = solveFor(7, { min: 0, max: 20 }, () => 7, { tolerance: 0.01 });
    expect(r.converged).toBe(true);
  });

  it('flags a flat metric that misses the target as out of range', () => {
    const r = solveFor(3, { min: 0, max: 20 }, () => 7, { tolerance: 0.01 });
    expect(r.converged).toBe(false);
  });
});

// ── Economy lever (faucet/sink amount → net-flow) ────────────────────────────

describe('solveEconomyFlowForTarget — economy lever', () => {
  const config: SimulationConfig = {
    agentCount: 20, maxLevel: 8, maxPlayHours: 10, philosophy: 'balanced', seed: 5,
  };
  const flowId = 'enemy-kill-gold';

  it('converges on a reachable net-flow target derived from the seeded engine', () => {
    // A target that the lever can actually hit: the net-flow at an interior amount.
    const reachable = runWithFlowOverride(config, flowId, 15, 'netFlow');
    const r = solveEconomyFlowForTarget(config, flowId, reachable, 'netFlow', { tolerance: 3 });
    expect(r.converged).toBe(true);
    expect(Math.abs(r.achievedMetric - reachable)).toBeLessThanOrEqual(3);
    expect(r.flowId).toBe(flowId);
    expect(r.iterations).toBeGreaterThan(2);
  });

  it('reports out-of-range gracefully for an unreachable target', () => {
    const r = solveEconomyFlowForTarget(config, flowId, 1e9, 'netFlow');
    expect(r.converged).toBe(false);
    expect(r.reason).toMatch(/outside the achievable range/);
  });

  it('reports an unknown flow without throwing', () => {
    const r = solveEconomyFlowForTarget(config, 'nope', 100);
    expect(r.converged).toBe(false);
    expect(r.reason).toMatch(/Unknown flow/);
  });
});

// ── Combat lever (tuning multiplier → survival) ──────────────────────────────

describe('solveCombatTuningForTarget — combat lever', () => {
  const scenario: CombatScenario = {
    name: 'goal-seek',
    playerLevel: 4,
    playerGear: GEAR_LOADOUTS[0],
    playerAbilities: PLAYER_ABILITIES.filter((a) => a.id === 'ga-melee-attack'),
    enemies: [{ archetypeId: 'brute', count: 2, level: 6 }, { archetypeId: 'melee-grunt', count: 3, level: 6 }],
  };
  const config: CombatSimConfig = { iterations: 30, seed: 7, maxFightDurationSec: 30 };

  it('converges on a survival target reachable within the tuning band (seeded metric)', () => {
    // Derive the target from an actual lever value so it is guaranteed reachable.
    const reachable = runCombatSimulation(
      scenario, { ...DEFAULT_TUNING, enemyDamageMul: 0.7 }, config,
    ).summary.survivalRate;
    const r = solveCombatTuningForTarget(
      scenario, DEFAULT_TUNING, config, 'enemyDamageMul', reachable, 'survival',
      { tolerance: 0.06, maxIterations: 18 },
    );
    expect(Math.abs(r.achievedMetric - reachable)).toBeLessThanOrEqual(0.06);
    expect(r.lever).toBe('enemyDamageMul');
    expect(typeof r.solvedValue).toBe('number');
  });

  it('reports out-of-range for an impossible survival target', () => {
    const r = solveCombatTuningForTarget(
      scenario, DEFAULT_TUNING, config, 'enemyDamageMul', 5, 'survival',
      { maxIterations: 12 },
    );
    expect(r.converged).toBe(false);
  });
});
