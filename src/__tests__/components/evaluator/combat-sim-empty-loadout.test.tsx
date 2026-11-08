import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import type { CombatAbility, TuningOverrides, CombatSimConfig } from '@/types/combat-simulator';

// An empty ability loadout means the player never acts; the report would read that
// misconfiguration as a balance verdict. The Run gate must refuse it and say why.

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

describe('Run gate with an empty ability loadout', () => {
  it('disables Run after Clear and states the reason', () => {
    render(<CombatSimulatorView />);
    const runBtn = screen.getByRole('button', { name: /Run \d+ Fights/ }) as HTMLButtonElement;
    expect(runBtn.disabled).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    const refused = screen.getByRole('button', { name: /Select an ability to run/ }) as HTMLButtonElement;
    expect(refused.disabled).toBe(true);
    fireEvent.click(refused);
    expect(run).not.toHaveBeenCalled();
  });
});
