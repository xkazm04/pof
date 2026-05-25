import { describe, it, expect } from 'vitest';
import { deriveDefaultSpec } from '@/lib/ability/spec';

describe('deriveDefaultSpec', () => {
  const fireball = { id: 'off-fire-01', element: 'Fire', color: '#f87171', damage: 35, cooldown: 3, tag: 'Ability.Fire.Fireball' };

  it('seeds one element-named effect with -damage Health modifier + cooldown', () => {
    const s = deriveDefaultSpec('spellbook', fireball);
    expect(s.catalogId).toBe('spellbook');
    expect(s.entityId).toBe('off-fire-01');
    expect(s.effects).toHaveLength(1);
    const e = s.effects[0];
    expect(e.id).toBe('off-fire-01-primary');
    expect(e.name).toBe('Fire Strike');
    expect(e.duration).toBe('instant');
    expect(e.cooldownSec).toBe(3);
    expect(e.color).toBe('#f87171');
    expect(e.modifiers).toEqual([{ attribute: 'Health', operation: 'add', magnitude: -35 }]);
  });

  it('seeds two block rules vs Dead/Stunned using the ability tag as source', () => {
    const s = deriveDefaultSpec('spellbook', fireball);
    expect(s.tagRules.map((r) => r.targetTag)).toEqual(['State.Dead', 'State.Stunned']);
    expect(s.tagRules.every((r) => r.type === 'blocks' && r.sourceTag === 'Ability.Fire.Fireball')).toBe(true);
  });

  it('is safe when fields are missing', () => {
    const s = deriveDefaultSpec('spellbook', { id: 'x' });
    expect(s.effects[0].name).toBe('Effect');
    expect(s.effects[0].modifiers[0].magnitude).toBe(0);
    expect(s.tagRules[0].sourceTag).toBe('Ability');
  });
});
