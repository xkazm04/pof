import { describe, it, expect } from 'vitest';
import { suggestEncounterMix, buildEncounterPrompt, type EncounterUnit } from '@/lib/bestiary/encounter-mix';

const roster: EncounterUnit[] = [
  { id: 'brute', name: 'Brute', role: 'tank', tier: 'elite' },
  { id: 'archer', name: 'Archer', role: 'ranged', tier: 'standard' },
  { id: 'grunt', name: 'Grunt', role: 'melee', tier: 'minion' },
  { id: 'mage', name: 'Mage', role: 'caster', tier: 'standard' },
  { id: 'raid', name: 'World Eater', role: 'tank', tier: 'raid-boss' },
];

function focus(id: string): EncounterUnit {
  return roster.find((u) => u.id === id)!;
}

describe('suggestEncounterMix', () => {
  it('always leads with the focus archetype flagged isFocus', () => {
    const mix = suggestEncounterMix(focus('brute'), roster, 4);
    expect(mix[0].isFocus).toBe(true);
    expect(mix[0].entityId).toBe('brute');
  });

  it('fills distinct roles around the focus before repeating', () => {
    const mix = suggestEncounterMix(focus('brute'), roster, 4);
    const roles = mix.map((s) => s.role);
    // focus tank + three other distinct roles (ranged/melee/caster)
    expect(new Set(roles).size).toBe(4);
  });

  it('never recruits a unit tougher than the focus', () => {
    // grunt is a minion focus; the raid-boss + elite must be excluded
    const mix = suggestEncounterMix(focus('grunt'), roster, 5);
    expect(mix.find((s) => s.entityId === 'raid')).toBeUndefined();
    expect(mix.find((s) => s.entityId === 'brute')).toBeUndefined();
  });

  it('respects the requested size', () => {
    const mix = suggestEncounterMix(focus('brute'), roster, 2);
    expect(mix).toHaveLength(2);
  });

  it('returns just the focus when no eligible support exists', () => {
    const lonely: EncounterUnit = { id: 'solo', name: 'Solo', role: 'tank', tier: 'minion' };
    const mix = suggestEncounterMix(lonely, [lonely], 4);
    expect(mix).toHaveLength(1);
    expect(mix[0].isFocus).toBe(true);
  });
});

describe('buildEncounterPrompt', () => {
  it('names the focus, every mix member, and the instruction', () => {
    const mix = suggestEncounterMix(focus('brute'), roster, 4);
    const prompt = buildEncounterPrompt('Brute', mix, '  a tense rooftop ambush  ');
    expect(prompt).toContain('Brute');
    expect(prompt).toContain('a tense rooftop ambush');
    expect(prompt).toContain('Archer');
    // trims the instruction
    expect(prompt).not.toContain('  a tense');
  });

  it('works with an empty instruction (uses the suggested mix alone)', () => {
    const mix = suggestEncounterMix(focus('brute'), roster, 3);
    const prompt = buildEncounterPrompt('Brute', mix, '');
    expect(prompt).toContain('Brute');
    expect(prompt.length).toBeGreaterThan(0);
  });
});
