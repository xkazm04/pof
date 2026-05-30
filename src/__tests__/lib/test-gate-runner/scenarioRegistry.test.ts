import { describe, it, expect, beforeEach } from 'vitest';
import {
  abilityTagFor,
  resolveScenario,
  registerScenario,
  clearScenarioRegistry,
  registerBuiltinScenarios,
} from '@/lib/test-gate-runner/scenarioRegistry';

describe('abilityTagFor', () => {
  it('derives a PascalCase ability tag from an entity id', () => {
    expect(abilityTagFor('fireball')).toBe('Ability.Fireball');
    expect(abilityTagFor('ground-slam')).toBe('Ability.GroundSlam');
    expect(abilityTagFor('war_cry')).toBe('Ability.WarCry');
  });
});

describe('resolveScenario', () => {
  beforeEach(() => {
    clearScenarioRegistry();
    registerBuiltinScenarios();
  });

  it('resolves the abilities archetype to an activate_ability scenario for the entity', () => {
    const scn = resolveScenario({ catalogId: 'abilities', entityId: 'fireball', step: 'TestGate' });
    expect(scn).toBeDefined();
    expect(scn!.inputs[0]).toMatchObject({ event: 'activate_ability', eventArg: 'Ability.Fireball' });
    expect(scn!.assert).toEqual([{ kind: 'ability-activated' }]);
    expect(scn!.map).toContain('/Game/Maps/');
  });

  it('returns undefined for an unregistered catalog', () => {
    expect(resolveScenario({ catalogId: 'audio', entityId: 'theme', step: 'TestGate' })).toBeUndefined();
  });

  it('prefers a more specific `${catalogId}:${step}` registration over the catalog one', () => {
    registerScenario('abilities:TestGate', () => ({
      map: '/Game/Maps/Special',
      totalSeconds: 1,
      numSamples: 1,
      inputs: [],
      assert: [{ kind: 'montage-playing' }],
    }));
    const scn = resolveScenario({ catalogId: 'abilities', entityId: 'fireball', step: 'TestGate' });
    expect(scn!.map).toBe('/Game/Maps/Special');
  });
});
