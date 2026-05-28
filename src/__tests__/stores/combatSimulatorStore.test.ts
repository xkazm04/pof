import { describe, it, expect, beforeEach } from 'vitest';
import { mockFetch } from '@/__tests__/setup';
import { useCombatSimulatorStore } from '@/stores/combatSimulatorStore';
import { DEFAULT_TUNING, DEFAULT_CONFIG, GEAR_LOADOUTS, PLAYER_ABILITIES } from '@/lib/combat/definitions';
import type { CombatScenario, SimulationResult, CombatSummary } from '@/types/combat-simulator';

function makeScenario(name = 'store-test'): CombatScenario {
  return {
    name,
    playerLevel: 5,
    playerGear: GEAR_LOADOUTS[0],
    playerAbilities: PLAYER_ABILITIES.filter((a) => a.id === 'ga-melee-attack'),
    enemies: [{ archetypeId: 'melee-grunt', count: 1, level: 5 }],
  };
}

function makeSummary(over: Partial<CombatSummary> = {}): CombatSummary {
  return {
    survivalRate: 0.5, avgFightDurationSec: 10, medianFightDurationSec: 9,
    avgDamageDealt: 500, avgDamageTaken: 400, avgPlayerHealthRemaining: 100,
    avgDPS: 50, avgEnemyDPS: 40, avgCritRate: 0.2, abilityHeatmap: {},
    damageDealtBuckets: [], damageTakenBuckets: [], durationBuckets: [],
    oneShotRate: 0.1,
    threatBreakdown: { bySource: [], byEnemy: [], totalDeaths: 0, totalDamageTaken: 0 },
    ...over,
  };
}

function makeResult(summary: CombatSummary): SimulationResult {
  return {
    config: { ...DEFAULT_CONFIG }, scenario: makeScenario(), tuning: { ...DEFAULT_TUNING },
    fights: [], summary, alerts: [], durationMs: 1, completedAt: '2026-05-27T00:00:00.000Z',
  };
}

beforeEach(() => {
  useCombatSimulatorStore.setState({
    result: null, summary: null, alerts: [],
    baselineResult: null, comparison: null, isSimulating: false, error: null,
  });
});

describe('combatSimulatorStore — A/B baseline', () => {
  it('pinBaseline captures the current result as the baseline', () => {
    const res = makeResult(makeSummary({ survivalRate: 0.4 }));
    useCombatSimulatorStore.setState({ result: res, summary: res.summary, alerts: res.alerts });

    useCombatSimulatorStore.getState().pinBaseline();

    const s = useCombatSimulatorStore.getState();
    expect(s.baselineResult).toEqual(res);
    // No candidate run yet → no comparison.
    expect(s.comparison).toBeNull();
  });

  it('pinBaseline is a no-op when there is no result', () => {
    useCombatSimulatorStore.getState().pinBaseline();
    expect(useCombatSimulatorStore.getState().baselineResult).toBeNull();
  });

  it('clearBaseline drops the baseline and any comparison', () => {
    useCombatSimulatorStore.setState({
      baselineResult: makeResult(makeSummary()),
      comparison: {
        baseline: { label: 'Baseline' } as never,
        candidate: { label: 'Candidate' } as never,
        deltas: { survivalRateDelta: 0, avgDPSDelta: 0, avgDurationDelta: 0, oneShotRateDelta: 0 },
        alertDiff: [],
      },
    });

    useCombatSimulatorStore.getState().clearBaseline();

    const s = useCombatSimulatorStore.getState();
    expect(s.baselineResult).toBeNull();
    expect(s.comparison).toBeNull();
  });

  it('computes a comparison when a candidate run completes with a baseline pinned', async () => {
    // Pin a baseline result directly.
    const baseline = makeResult(makeSummary({ survivalRate: 0.4, avgDPS: 50 }));
    useCombatSimulatorStore.setState({ baselineResult: baseline });

    // The next run returns a stronger candidate.
    const candidate = makeResult(makeSummary({ survivalRate: 0.7, avgDPS: 65 }));
    mockFetch({ body: { success: true, data: { result: candidate } } });

    await useCombatSimulatorStore.getState().runSimulation(
      makeScenario(), { ...DEFAULT_TUNING }, { ...DEFAULT_CONFIG },
    );

    const cmp = useCombatSimulatorStore.getState().comparison;
    expect(cmp).not.toBeNull();
    expect(cmp!.deltas.survivalRateDelta).toBeCloseTo(0.3, 5);
    expect(cmp!.deltas.avgDPSDelta).toBeCloseTo(15, 5);
    expect(cmp!.baseline.label).toBe('Baseline');
    expect(cmp!.candidate.label).toBe('Candidate');
  });

  it('leaves comparison null when no baseline is pinned', async () => {
    const candidate = makeResult(makeSummary());
    mockFetch({ body: { success: true, data: { result: candidate } } });

    await useCombatSimulatorStore.getState().runSimulation(
      makeScenario(), { ...DEFAULT_TUNING }, { ...DEFAULT_CONFIG },
    );

    expect(useCombatSimulatorStore.getState().comparison).toBeNull();
  });
});
