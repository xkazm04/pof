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

  it('an explicit override WINS over the blind derivation', () => {
    // A dotted tag is used verbatim (the entityId PascalCase would have been wrong).
    expect(abilityTagFor('frbal', 'Ability.Fireball')).toBe('Ability.Fireball');
    expect(abilityTagFor('x', 'Combat.Cleave')).toBe('Combat.Cleave');
    // A bare override name is PascalCased under Ability.
    expect(abilityTagFor('x', 'ground-slam')).toBe('Ability.GroundSlam');
    // Empty/whitespace override falls back to the entityId derivation.
    expect(abilityTagFor('fireball', '   ')).toBe('Ability.Fireball');
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
    expect(scn!.assert).toEqual([{ kind: 'ability-activated', tag: 'Ability.Fireball' }]);
    expect(scn!.map).toContain('/Game/Maps/');
  });

  it('returns undefined for an unregistered catalog', () => {
    expect(resolveScenario({ catalogId: 'audio', entityId: 'theme', step: 'TestGate' })).toBeUndefined();
  });

  it('resolves the abilities scenario with an explicit abilityTag override on the job', () => {
    const scn = resolveScenario({ catalogId: 'abilities', entityId: 'frbal', step: 'TestGate', abilityTag: 'Ability.Fireball' });
    expect(scn!.inputs[0]).toMatchObject({ event: 'activate_ability', eventArg: 'Ability.Fireball' });
    // The requested tag is stamped onto the assertion so a mismatch reports loudly.
    expect(scn!.assert).toEqual([{ kind: 'ability-activated', tag: 'Ability.Fireball' }]);
  });

  it('resolves the movement archetype for character-pipeline (drive W, gate on displacement + speed)', () => {
    const scn = resolveScenario({ catalogId: 'character-pipeline', entityId: 'vael', step: 'TestGate' });
    expect(scn).toBeDefined();
    expect(scn!.disableAI).toBe(true);
    expect(scn!.inputs[0]).toMatchObject({ key: 'W' });
    expect(scn!.assert).toEqual([
      { kind: 'moved', minDist: 100 },
      { kind: 'min-speed', minSpeed: 50 },
    ]);
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
