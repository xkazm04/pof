import { describe, it, expect } from 'vitest';
import { buildLogicChangePrompt, LOGIC_ASPECTS, type LogicAspect } from '@/lib/ability/logic-prompts';

const ability = { name: 'Fireball', element: 'Fire', tag: 'Ability.Fire.Fireball', category: 'Offensive', tier: 'advanced' };

describe('buildLogicChangePrompt', () => {
  it('names the ability, the tag, and the aspect intent + trimmed instruction', () => {
    const p = buildLogicChangePrompt('damage', ability, '  hit harder  ');
    expect(p).toContain('Fireball');
    expect(p).toContain('Ability.Fire.Fireball');
    expect(p).toMatch(/damage/i);
    expect(p).toContain('hit harder');
    expect(p).not.toContain('  hit harder');
  });
  it('instructs editing the GAS source, not inventing one', () => {
    const p = buildLogicChangePrompt('requirements', ability, '');
    expect(p).toMatch(/UARPGGameplayAbility|DT_AbilityCatalog/);
  });
  it('exposes the six aspects', () => {
    expect(LOGIC_ASPECTS).toEqual(['type', 'damage', 'cooldown', 'cost', 'effects', 'requirements'] satisfies LogicAspect[]);
  });
});
