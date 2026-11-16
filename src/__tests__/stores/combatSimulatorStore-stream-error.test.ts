/**
 * combatSimulatorStore.runSimulationStreaming — a refused run reports the route's reason.
 *
 * The route validates before it streams, so a bad scenario/tuning comes back as a plain JSON
 * `{ success:false, error }` envelope with a 4xx. The streaming client threw
 * `Simulation request failed (400)` and discarded the envelope, so the designer saw a status code
 * instead of "tuning.playerHealthMul must be a finite number" / "Unknown enemy archetype id(s)".
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useCombatSimulatorStore } from '@/stores/combatSimulatorStore';
import { DEFAULT_TUNING, DEFAULT_CONFIG, GEAR_LOADOUTS, PLAYER_ABILITIES } from '@/lib/combat/definitions';
import type { CombatScenario } from '@/types/combat-simulator';

const scenario: CombatScenario = {
  name: 's', playerLevel: 5, playerGear: GEAR_LOADOUTS[0], playerAbilities: PLAYER_ABILITIES,
  enemies: [{ archetypeId: 'gone', count: 1, level: 1 }],
};

beforeEach(() => {
  useCombatSimulatorStore.setState({ result: null, isSimulating: false, simProgress: 0, error: null });
});

describe('combatSimulatorStore — streaming refusal reason', () => {
  it('surfaces the route envelope error on a non-ok response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false, status: 400, body: null,
      json: async () => ({ success: false, error: 'Unknown enemy archetype id(s): gone' }),
    }) as unknown as typeof fetch;

    const out = await useCombatSimulatorStore.getState().runSimulationStreaming(scenario, DEFAULT_TUNING, DEFAULT_CONFIG);

    expect(out).toBeNull();
    const s = useCombatSimulatorStore.getState();
    expect(s.error).toContain('Unknown enemy archetype id(s): gone');
    expect(s.error).toContain('400');
    expect(s.isSimulating).toBe(false);
  });

  it('falls back to the status when the failure body is not an envelope', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false, status: 502, body: null, json: async () => { throw new SyntaxError('html'); },
    }) as unknown as typeof fetch;

    await useCombatSimulatorStore.getState().runSimulationStreaming(scenario, DEFAULT_TUNING, DEFAULT_CONFIG);

    expect(useCombatSimulatorStore.getState().error).toBe('Simulation request failed (502)');
  });
});
