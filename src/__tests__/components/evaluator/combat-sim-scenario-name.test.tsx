import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import type { CombatAbility, TuningOverrides, CombatSimConfig } from '@/types/combat-simulator';

// The scenario name is shown on the baseline banner, both A/B panel headers and the
// copied Fight Report — it must name enemies as designers see them, not by catalog id.

const { storeState, run } = vi.hoisted(() => {
  const tuning: TuningOverrides = {
    playerHealthMul: 1, playerDamageMul: 1, playerArmorMul: 1,
    enemyHealthMul: 1, enemyDamageMul: 1, critMultiplierMul: 1,
    armorEffectivenessWeight: 1, healingMul: 1,
  };
  const config: CombatSimConfig = { iterations: 1000, seed: 7, maxFightDurationSec: 30 };
  const run = vi.fn().mockResolvedValue(undefined);
  const state: Record<string, unknown> = {
    enemies: [{ id: 'melee-grunt', name: 'Grunt' }],
    abilities: [{ id: 'ga-melee-attack', name: 'Melee Attack', type: 'melee' } as CombatAbility],
    gearLoadouts: [{ id: 'starter', name: 'Starter', bonuses: {} }],
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

afterEach(() => cleanup());

describe('submitted scenario name', () => {
  it('names enemy groups by archetype display name', async () => {
    render(<CombatSimulatorView />);
    fireEvent.click(screen.getByRole('button', { name: /Run \d+ Fights/ }));
    await waitFor(() => expect(run).toHaveBeenCalledTimes(1));
    const scenario = run.mock.calls[0][0] as { name: string; enemies: { archetypeId: string }[] };
    expect(scenario.name).toBe('Lvl 5 vs 3x Grunt');
    // The engine still receives ids — only the human-facing label changes.
    expect(scenario.enemies[0].archetypeId).toBe('melee-grunt');
  });
});
