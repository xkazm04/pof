import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import type { CombatAbility, CombatSummary, TuningOverrides, CombatSimConfig } from '@/types/combat-simulator';

const { storeState, baseline } = vi.hoisted(() => {
  const tuning: TuningOverrides = {
    playerHealthMul: 1, playerDamageMul: 1, playerArmorMul: 1,
    enemyHealthMul: 1, enemyDamageMul: 1, critMultiplierMul: 1,
    armorEffectivenessWeight: 1, healingMul: 1,
  };
  const config: CombatSimConfig = { iterations: 1000, seed: 7, maxFightDurationSec: 30 };
  const summary = {
    survivalRate: 0.7, avgFightDurationSec: 12, medianFightDurationSec: 11, avgDamageDealt: 500,
    avgDamageTaken: 300, avgPlayerHealthRemaining: 40, avgDPS: 42, avgEnemyDPS: 18, avgCritRate: 0.2,
    abilityHeatmap: {}, damageDealtBuckets: [], damageTakenBuckets: [], durationBuckets: [], oneShotRate: 0,
    threatBreakdown: { bySource: [], byEnemy: [], totalDeaths: 0, totalDamageTaken: 0 },
  } as unknown as CombatSummary;
  const abilities: CombatAbility[] = [
    { id: 'ga-melee-attack', name: 'Melee Attack', type: 'melee' } as CombatAbility,
    { id: 'ga-fireball', name: 'Fireball', type: 'ranged' } as CombatAbility,
  ];
  const state: Record<string, unknown> = {
    enemies: [{ id: 'melee-grunt', name: 'Grunt' }],
    abilities,
    gearLoadouts: [{ id: 'starter', name: 'Starter', bonuses: {} }],
    defaultTuning: tuning, defaultConfig: config, tuning,
    result: null, summary: null, alerts: [], baselineResult: null, comparison: null,
    isLoading: false, isSimulating: false, simProgress: 0, error: null,
    fetchDefaults: vi.fn(), runSimulationStreaming: vi.fn().mockResolvedValue(undefined),
    setTuning: vi.fn(), pinBaseline: vi.fn(), clearBaseline: vi.fn(),
  };
  const baseline = {
    config: { iterations: 1000, seed: 4242, maxFightDurationSec: 30 },
    scenario: { name: 'baseline', playerLevel: 5, playerAbilities: [], enemies: [] },
    summary,
  };
  return { storeState: state, baseline: { ...baseline, summary } };
});

vi.mock('@/stores/combatSimulatorStore', () => {
  const hook = (selector: (s: typeof storeState) => unknown) => selector(storeState);
  hook.getState = () => storeState;
  return { useCombatSimulatorStore: hook };
});

import { CombatSimulatorView } from '@/components/modules/evaluator/CombatSimulatorView';

const original = { ...storeState };
beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(storeState, original);
});
afterEach(() => cleanup());

function runButton(): HTMLButtonElement {
  return screen.getByRole('button', { name: /Run \d+ Fights|Run Candidate/ }) as HTMLButtonElement;
}

describe('CombatSimulatorView - run gate matches the run guard', () => {
  it('the Run button is disabled while the default config has not loaded (handleRun would silently no-op)', () => {
    storeState.defaultConfig = null;
    render(<CombatSimulatorView />);
    expect(runButton().disabled).toBe(true);
  });

  it('the Run button is disabled with no gear loadout loaded', () => {
    storeState.gearLoadouts = [];
    render(<CombatSimulatorView />);
    expect(runButton().disabled).toBe(true);
  });

  it('the Run button is enabled when everything the run needs is present', () => {
    render(<CombatSimulatorView />);
    expect(runButton().disabled).toBe(false);
  });
});

describe('CombatSimulatorView - A/B candidate run is paired with the baseline', () => {
  it('reuses the pinned baseline seed so an unchanged candidate diffs to zero, not to RNG noise', () => {
    storeState.baselineResult = baseline;
    render(<CombatSimulatorView />);
    fireEvent.click(runButton());
    const run = storeState.runSimulationStreaming as ReturnType<typeof vi.fn>;
    expect(run).toHaveBeenCalledTimes(1);
    expect((run.mock.calls[0][2] as CombatSimConfig).seed).toBe(4242);
  });

  it('draws a fresh seed when no baseline is pinned', () => {
    render(<CombatSimulatorView />);
    fireEvent.click(runButton());
    const run = storeState.runSimulationStreaming as ReturnType<typeof vi.fn>;
    expect(typeof (run.mock.calls[0][2] as CombatSimConfig).seed).toBe('number');
  });
});

describe('CombatSimulatorView - live-region status', () => {
  it('does not announce "Simulation complete" for a run that failed', () => {
    storeState.summary = baseline.summary;
    storeState.error = 'Simulation request failed (500)';
    const { container } = render(<CombatSimulatorView />);
    const status = container.querySelector('.sr-only[role="status"]')!;
    expect(status.textContent).not.toContain('Simulation complete');
    expect(status.textContent).toContain('failed');
  });

  it('announces completion for a clean finished run', () => {
    storeState.summary = baseline.summary;
    storeState.result = baseline;
    const { container } = render(<CombatSimulatorView />);
    expect(container.querySelector('.sr-only[role="status"]')!.textContent).toContain('Simulation complete');
  });
});

describe('CombatSimulatorView - scenario controls expose their state to assistive tech', () => {
  it('ability chips report pressed/unpressed (the Story/Advanced toggle already does)', () => {
    render(<CombatSimulatorView />);
    // Defaults select ga-melee-attack and ga-fireball among others; both exist in this fixture.
    expect(screen.getByRole('button', { name: 'Melee Attack' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Melee Attack' }));
    expect(screen.getByRole('button', { name: 'Melee Attack' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('the gear select and the enemy-group remove button have accessible names', () => {
    render(<CombatSimulatorView />);
    expect(screen.getByLabelText('Gear')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '+ Add enemy group' }));
    expect(screen.getByRole('button', { name: 'Remove enemy group 2' })).toBeTruthy();
  });
});

describe('FightReportCardPanel - copy failure is visible', () => {
  it('says the copy failed instead of leaving an inert-looking button', async () => {
    storeState.summary = baseline.summary;
    storeState.result = baseline;
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) }, configurable: true,
    });
    render(<CombatSimulatorView />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    await waitFor(() => expect(screen.getByRole('button', { name: /Copy failed/ })).toBeTruthy());
  });
});
