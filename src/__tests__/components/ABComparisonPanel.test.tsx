import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { ABComparisonPanel } from '@/components/modules/evaluator/ABComparisonPanel';
import { compareRuns } from '@/lib/combat/simulation-engine';
import { DEFAULT_TUNING, DEFAULT_CONFIG, GEAR_LOADOUTS } from '@/lib/combat/definitions';
import type {
  CombatScenario, CombatSummary, BalanceAlert, SimulationResult,
} from '@/types/combat-simulator';

afterEach(cleanup);

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

function makeResult(name: string, summary: CombatSummary, alerts: BalanceAlert[]): SimulationResult {
  const scenario: CombatScenario = {
    name, playerLevel: 5, playerGear: GEAR_LOADOUTS[0], playerAbilities: [],
    enemies: [{ archetypeId: 'melee-grunt', count: 1, level: 5 }],
  };
  return {
    config: { ...DEFAULT_CONFIG }, scenario, tuning: { ...DEFAULT_TUNING },
    fights: [], summary, alerts, durationMs: 1, completedAt: '2026-05-27T00:00:00.000Z',
  };
}

const oneShot: BalanceAlert = {
  severity: 'critical', type: 'one-shot',
  message: '20.0% of fights result in one-shot death — player has no chance to react',
  metric: 'oneShotRate', value: 0.2, threshold: 0.05,
};
const survivalLow: BalanceAlert = {
  severity: 'warning', type: 'survival-low',
  message: '25.0% survival rate — encounter is too punishing',
  metric: 'survivalRate', value: 0.25, threshold: 0.3,
};

describe('ABComparisonPanel', () => {
  it('renders the four headline metrics with both runs and a delta', () => {
    const baseline = makeResult('Old Build', makeSummary({ survivalRate: 0.4, avgDPS: 50 }), []);
    const candidate = makeResult('New Build', makeSummary({ survivalRate: 0.7, avgDPS: 65 }), []);
    const cmp = compareRuns(baseline, candidate, { baseline: 'Baseline', candidate: 'Candidate' });

    render(<ABComparisonPanel comparison={cmp} />);

    expect(screen.getByText('Survival')).toBeTruthy();
    expect(screen.getByText('Player DPS')).toBeTruthy();
    expect(screen.getByText('Avg Duration')).toBeTruthy();
    expect(screen.getByText('One-Shot Rate')).toBeTruthy();

    // Scenario names appear as column sublabels
    expect(screen.getByText('Old Build')).toBeTruthy();
    expect(screen.getByText('New Build')).toBeTruthy();

    // Survival delta of +0.3 renders as +30.0%
    const survivalDelta = screen.getByLabelText('Survival delta');
    expect(survivalDelta.textContent).toContain('30.0%');
    expect(survivalDelta.textContent).toContain('+');
  });

  it('shows appeared / disappeared / persisted alerts in the diff', () => {
    // Baseline had survival-low (now fixed) + one-shot (still present).
    // Candidate adds nothing new beyond keeping one-shot.
    const baseline = makeResult('A', makeSummary(), [survivalLow, oneShot]);
    const candidate = makeResult('B', makeSummary(), [oneShot]);
    const cmp = compareRuns(baseline, candidate);

    render(<ABComparisonPanel comparison={cmp} />);

    expect(screen.getByText('FIXED')).toBeTruthy();   // survival-low disappeared
    expect(screen.getByText('STILL')).toBeTruthy();   // one-shot persisted
    expect(screen.getByText(survivalLow.message)).toBeTruthy();
  });

  it('flags a newly appeared alert as NEW', () => {
    const baseline = makeResult('A', makeSummary(), []);
    const candidate = makeResult('B', makeSummary(), [oneShot]);
    const cmp = compareRuns(baseline, candidate);

    render(<ABComparisonPanel comparison={cmp} />);
    expect(screen.getByText('NEW')).toBeTruthy();
  });

  it('renders an empty-state message when neither run has alerts', () => {
    const cmp = compareRuns(makeResult('A', makeSummary(), []), makeResult('B', makeSummary(), []));
    render(<ABComparisonPanel comparison={cmp} />);
    expect(screen.getByText(/no balance alerts in either run/i)).toBeTruthy();
  });
});
