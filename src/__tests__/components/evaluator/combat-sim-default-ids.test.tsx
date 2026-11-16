import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import type { CombatAbility, TuningOverrides, CombatSimConfig } from '@/types/combat-simulator';

// The literal default ids (melee-grunt, starter, ga-*) must be reconciled against the
// loaded catalog: a catalog without them must not reach the engine as unknown ids.

const { storeState, run } = vi.hoisted(() => {
  const tuning: TuningOverrides = {
    playerHealthMul: 1, playerDamageMul: 1, playerArmorMul: 1,
    enemyHealthMul: 1, enemyDamageMul: 1, critMultiplierMul: 1,
    armorEffectivenessWeight: 1, healingMul: 1,
  };
  const config: CombatSimConfig = { iterations: 1000, seed: 7, maxFightDurationSec: 30 };
  const run = vi.fn().mockResolvedValue(undefined);
  const state: Record<string, unknown> = {
    enemies: [{ id: 'bandit-archer', name: 'Archer' }, { id: 'bandit-brute', name: 'Brute' }],
    abilities: [{ id: 'ga-melee-attack', name: 'Melee Attack', type: 'melee' } as CombatAbility],
    gearLoadouts: [{ id: 'veteran', name: 'Veteran', bonuses: {} }],
    defaultTuning: tuning, defaultConfig: config, tuning,
    result: null, summary: null, alerts: [], baselineResult: null, comparison: null,
    isLoading: false, isSimulating: false, simProgress: 0, error: null,
    fetchDefaults: vi.fn(), runSimulationStreaming: run,
    setTuning: vi.fn(), pinBaseline: vi.fn(), clearBaseline: vi.fn(),
  };
  return { storeState: state, run };
});

vi.mock('@/stores/combatSimulatorStore', () => {
  const hook = (selector: (s: typeof storeState) => unknown) => selector(storeState);
  hook.getState = () => storeState;
  return { useCombatSimulatorStore: hook };
});

import { CombatSimulatorView } from '@/components/modules/evaluator/CombatSimulatorView';

afterEach(() => { cleanup(); run.mockClear(); });

type Submitted = {
  enemies: { archetypeId: string }[]; playerGear: { id: string }; playerAbilities: { id: string }[];
};

describe('default ids vs the loaded catalog', () => {
  it('submits only archetype, gear and ability ids that exist in the catalog', async () => {
    render(<CombatSimulatorView />);
    fireEvent.click(screen.getByRole('button', { name: '+ Add enemy group' }));
    fireEvent.click(screen.getByRole('button', { name: /Run \d+ Fights/ }));
    await waitFor(() => expect(run).toHaveBeenCalledTimes(1));
    const s = run.mock.calls[0][0] as Submitted;
    const enemyIds = ['bandit-archer', 'bandit-brute'];
    expect(s.enemies.length).toBe(2);
    for (const e of s.enemies) expect(enemyIds).toContain(e.archetypeId);
    expect(s.playerGear.id).toBe('veteran');
    expect(s.playerAbilities.map((a) => a.id)).toEqual(['ga-melee-attack']);
  });
});
