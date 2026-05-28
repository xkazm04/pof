import { describe, it, expect } from 'vitest';
import { runCombatSimulation, compareRuns } from '@/lib/combat/simulation-engine';
import {
  DEFAULT_TUNING,
  DEFAULT_CONFIG,
  GEAR_LOADOUTS,
  PLAYER_ABILITIES,
} from '@/lib/combat/definitions';
import type {
  CombatScenario,
  CombatSummary,
  BalanceAlert,
  SimulationResult,
} from '@/types/combat-simulator';

// ── Builders ─────────────────────────────────────────────────────────────────

function makeScenario(name = 'ab-test'): CombatScenario {
  const gear = GEAR_LOADOUTS.find((g) => g.id === 'starter')!;
  return {
    name,
    playerLevel: 5,
    playerGear: gear,
    playerAbilities: PLAYER_ABILITIES.filter((a) =>
      ['ga-melee-attack', 'ga-fireball', 'ga-dodge'].includes(a.id),
    ),
    enemies: [{ archetypeId: 'brute', count: 2, level: 8 }],
  };
}

function makeSummary(over: Partial<CombatSummary> = {}): CombatSummary {
  return {
    survivalRate: 0.5,
    avgFightDurationSec: 10,
    medianFightDurationSec: 9,
    avgDamageDealt: 500,
    avgDamageTaken: 400,
    avgPlayerHealthRemaining: 100,
    avgDPS: 50,
    avgEnemyDPS: 40,
    avgCritRate: 0.2,
    abilityHeatmap: {},
    damageDealtBuckets: [],
    damageTakenBuckets: [],
    durationBuckets: [],
    oneShotRate: 0.1,
    threatBreakdown: { bySource: [], byEnemy: [], totalDeaths: 0, totalDamageTaken: 0 },
    ...over,
  };
}

function makeResult(
  summary: CombatSummary,
  alerts: BalanceAlert[],
  over: Partial<SimulationResult> = {},
): SimulationResult {
  const scenario = makeScenario();
  return {
    config: { ...DEFAULT_CONFIG },
    scenario,
    tuning: { ...DEFAULT_TUNING },
    fights: [],
    summary,
    alerts,
    durationMs: 1,
    completedAt: '2026-05-27T00:00:00.000Z',
    ...over,
  };
}

const oneShotAlert: BalanceAlert = {
  severity: 'critical', type: 'one-shot',
  message: '20.0% of fights result in one-shot death — player has no chance to react',
  metric: 'oneShotRate', value: 0.2, threshold: 0.05,
};
const survivalLowAlert: BalanceAlert = {
  severity: 'warning', type: 'survival-low',
  message: '25.0% survival rate — encounter is too punishing',
  metric: 'survivalRate', value: 0.25, threshold: 0.3,
};
const unusedFireball: BalanceAlert = {
  severity: 'warning', type: 'ability-unused',
  message: '"Fireball" is used <0.1 times per fight — ability may be too expensive, low damage, or on too long a cooldown',
  metric: 'abilityUsage', value: 0.05, threshold: 0.1,
};
const unusedDodge: BalanceAlert = {
  severity: 'warning', type: 'ability-unused',
  message: '"Dodge" is used <0.1 times per fight — ability may be too expensive, low damage, or on too long a cooldown',
  metric: 'abilityUsage', value: 0.02, threshold: 0.1,
};

describe('compareRuns — metric deltas', () => {
  it('computes candidate − baseline for the four headline metrics', () => {
    const baseline = makeResult(
      makeSummary({ survivalRate: 0.4, avgDPS: 50, avgFightDurationSec: 12, oneShotRate: 0.2 }),
      [],
    );
    const candidate = makeResult(
      makeSummary({ survivalRate: 0.7, avgDPS: 65, avgFightDurationSec: 9, oneShotRate: 0.05 }),
      [],
    );

    const cmp = compareRuns(baseline, candidate);

    expect(cmp.deltas.survivalRateDelta).toBeCloseTo(0.3, 5);
    expect(cmp.deltas.avgDPSDelta).toBeCloseTo(15, 5);
    expect(cmp.deltas.avgDurationDelta).toBeCloseTo(-3, 5);
    expect(cmp.deltas.oneShotRateDelta).toBeCloseTo(-0.15, 5);
  });

  it('labels the two snapshots and carries their summaries', () => {
    const baseline = makeResult(makeSummary({ survivalRate: 0.4 }), []);
    const candidate = makeResult(makeSummary({ survivalRate: 0.6 }), []);

    const cmp = compareRuns(baseline, candidate, { baseline: 'Old', candidate: 'New' });

    expect(cmp.baseline.label).toBe('Old');
    expect(cmp.candidate.label).toBe('New');
    expect(cmp.baseline.summary.survivalRate).toBe(0.4);
    expect(cmp.candidate.summary.survivalRate).toBe(0.6);
  });

  it('defaults the snapshot labels to Baseline / Candidate', () => {
    const cmp = compareRuns(makeResult(makeSummary(), []), makeResult(makeSummary(), []));
    expect(cmp.baseline.label).toBe('Baseline');
    expect(cmp.candidate.label).toBe('Candidate');
  });
});

describe('compareRuns — alert diff', () => {
  it('marks an alert present only in the candidate as "appeared"', () => {
    const baseline = makeResult(makeSummary(), []);
    const candidate = makeResult(makeSummary(), [oneShotAlert]);

    const cmp = compareRuns(baseline, candidate);
    const entry = cmp.alertDiff.find((e) => e.type === 'one-shot');
    expect(entry?.status).toBe('appeared');
    expect(entry?.candidateValue).toBe(0.2);
    expect(entry?.baselineValue).toBeUndefined();
  });

  it('marks an alert present only in the baseline as "disappeared"', () => {
    const baseline = makeResult(makeSummary(), [survivalLowAlert]);
    const candidate = makeResult(makeSummary(), []);

    const cmp = compareRuns(baseline, candidate);
    const entry = cmp.alertDiff.find((e) => e.type === 'survival-low');
    expect(entry?.status).toBe('disappeared');
    expect(entry?.baselineValue).toBe(0.25);
    expect(entry?.candidateValue).toBeUndefined();
  });

  it('marks an alert present in both runs as "persisted" and keeps both values', () => {
    const baseline = makeResult(makeSummary(), [{ ...oneShotAlert, value: 0.3 }]);
    const candidate = makeResult(makeSummary(), [{ ...oneShotAlert, value: 0.15 }]);

    const cmp = compareRuns(baseline, candidate);
    const entry = cmp.alertDiff.find((e) => e.type === 'one-shot');
    expect(entry?.status).toBe('persisted');
    expect(entry?.baselineValue).toBe(0.3);
    expect(entry?.candidateValue).toBe(0.15);
  });

  it('distinguishes ability-unused alerts by which ability they reference', () => {
    // Baseline: Fireball + Dodge unused. Candidate: only Dodge unused (Fireball got fixed).
    const baseline = makeResult(makeSummary(), [unusedFireball, unusedDodge]);
    const candidate = makeResult(makeSummary(), [unusedDodge]);

    const cmp = compareRuns(baseline, candidate);
    const unused = cmp.alertDiff.filter((e) => e.type === 'ability-unused');
    expect(unused).toHaveLength(2);

    const fireball = unused.find((e) => e.alert.message.includes('Fireball'));
    const dodge = unused.find((e) => e.alert.message.includes('Dodge'));
    expect(fireball?.status).toBe('disappeared');
    expect(dodge?.status).toBe('persisted');
  });

  it('orders the diff with appeared first, then persisted, then disappeared', () => {
    const baseline = makeResult(makeSummary(), [survivalLowAlert, { ...oneShotAlert }]);
    const candidate = makeResult(makeSummary(), [{ ...oneShotAlert }, unusedFireball]);

    const cmp = compareRuns(baseline, candidate);
    const statuses = cmp.alertDiff.map((e) => e.status);
    const firstAppeared = statuses.indexOf('appeared');
    const firstPersisted = statuses.indexOf('persisted');
    const firstDisappeared = statuses.indexOf('disappeared');
    expect(firstAppeared).toBeLessThan(firstPersisted);
    expect(firstPersisted).toBeLessThan(firstDisappeared);
  });

  it('returns an empty diff when neither run has alerts', () => {
    const cmp = compareRuns(makeResult(makeSummary(), []), makeResult(makeSummary(), []));
    expect(cmp.alertDiff).toEqual([]);
  });
});

describe('compareRuns — integration with real runs', () => {
  it('produces a coherent comparison between a buffed and a nerfed player run', () => {
    const scenario = makeScenario();
    const weak = runCombatSimulation(
      scenario,
      { ...DEFAULT_TUNING, playerDamageMul: 0.5, playerHealthMul: 0.6 },
      { ...DEFAULT_CONFIG, iterations: 200, seed: 3 },
    );
    const strong = runCombatSimulation(
      scenario,
      { ...DEFAULT_TUNING, playerDamageMul: 1.8, playerHealthMul: 1.8 },
      { ...DEFAULT_CONFIG, iterations: 200, seed: 3 },
    );

    const cmp = compareRuns(weak, strong, { baseline: 'Nerfed', candidate: 'Buffed' });

    // Buffing the player should not reduce survival.
    expect(cmp.deltas.survivalRateDelta).toBeGreaterThanOrEqual(0);
    // Every diff entry references an alert that actually exists in the named run.
    for (const e of cmp.alertDiff) {
      if (e.status === 'appeared') {
        expect(strong.alerts.some((a) => a.type === e.type)).toBe(true);
      } else if (e.status === 'disappeared') {
        expect(weak.alerts.some((a) => a.type === e.type)).toBe(true);
      }
    }
  });
});
