import { describe, it, expect } from 'vitest';
import { sanitizeItemGenome } from '@/lib/item-dna/defaults';

function expectGenome(result: ReturnType<typeof sanitizeItemGenome>) {
  if ('error' in result) throw new Error(`expected genome, got error: ${result.error}`);
  return result;
}

describe('sanitizeItemGenome', () => {
  it('accepts a complete, valid item genome', () => {
    const { genome, warnings } = expectGenome(sanitizeItemGenome({
      name: 'Warrior Blade',
      itemType: 'Weapon',
      minRarity: 'Rare',
      traits: [
        { axis: 'offensive', weight: 0.8, affinityTags: ['Stat.Strength'] },
        { axis: 'defensive', weight: 0.2, affinityTags: [] },
        { axis: 'utility', weight: 0.1, affinityTags: [] },
        { axis: 'economic', weight: 0.05, affinityTags: [] },
      ],
      mutation: { mutationRate: 0.1, maxMutations: 2, wildMutation: true },
    }));
    expect(warnings).toHaveLength(0);
    expect(genome.name).toBe('Warrior Blade');
    expect(genome.itemType).toBe('Weapon');
    expect(genome.traits).toHaveLength(4);
    expect(genome.id).toBeTruthy();
    expect(genome.updatedAt).toBeTruthy();
  });

  it('rejects a missing or empty name', () => {
    expect('error' in sanitizeItemGenome({ traits: [] })).toBe(true);
    expect('error' in sanitizeItemGenome({ name: '   ' })).toBe(true);
  });

  it('rejects non-objects', () => {
    expect('error' in sanitizeItemGenome(null)).toBe(true);
    expect('error' in sanitizeItemGenome('a string')).toBe(true);
    expect('error' in sanitizeItemGenome(42)).toBe(true);
  });

  it('fills all four trait axes when some are missing', () => {
    const { genome, warnings } = expectGenome(sanitizeItemGenome({
      name: 'Partial',
      traits: [{ axis: 'offensive', weight: 0.9, affinityTags: [] }],
      mutation: { mutationRate: 0.08, maxMutations: 1, wildMutation: false },
    }));
    expect(genome.traits.map((t) => t.axis)).toEqual(['offensive', 'defensive', 'utility', 'economic']);
    expect(genome.traits.find((t) => t.axis === 'defensive')?.weight).toBe(0.25);
    expect(warnings).toHaveLength(0); // traits + mutation present (array), just incomplete traits
  });

  it('warns and defaults when traits/mutation are absent', () => {
    const { genome, warnings } = expectGenome(sanitizeItemGenome({ name: 'Bare' }));
    expect(genome.traits).toHaveLength(4);
    expect(genome.mutation).toEqual({ mutationRate: 0.08, maxMutations: 1, wildMutation: false });
    expect(warnings.some((w) => /traits/i.test(w))).toBe(true);
    expect(warnings.some((w) => /mutation/i.test(w))).toBe(true);
  });

  it('clamps trait weights into the 0..1 range', () => {
    const { genome } = expectGenome(sanitizeItemGenome({
      name: 'Clamp',
      traits: [
        { axis: 'offensive', weight: 5, affinityTags: [] },
        { axis: 'defensive', weight: -2, affinityTags: [] },
      ],
    }));
    expect(genome.traits.find((t) => t.axis === 'offensive')?.weight).toBe(1);
    expect(genome.traits.find((t) => t.axis === 'defensive')?.weight).toBe(0);
  });

  it('defaults unknown enums with a warning', () => {
    const { genome, warnings } = expectGenome(sanitizeItemGenome({
      name: 'Weird',
      itemType: 'Spaceship',
      minRarity: 'Mythic',
    }));
    expect(genome.itemType).toBe('Weapon');
    expect(genome.minRarity).toBe('Common');
    expect(warnings.some((w) => /itemType/i.test(w))).toBe(true);
    expect(warnings.some((w) => /minRarity/i.test(w))).toBe(true);
  });

  it('coerces invalid mutation numbers to defaults', () => {
    const { genome } = expectGenome(sanitizeItemGenome({
      name: 'BadMutation',
      mutation: { mutationRate: 'high', maxMutations: NaN, wildMutation: 'yes' },
    }));
    expect(genome.mutation.mutationRate).toBe(0.08);
    expect(genome.mutation.maxMutations).toBe(1);
    expect(genome.mutation.wildMutation).toBe(false);
  });
});
