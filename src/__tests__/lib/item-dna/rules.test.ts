import { describe, it, expect } from 'vitest';
import {
  EVOLUTION_TIERS, affixCountRange, describeAffixCount, scaleByLevel, tierBonus,
} from '@/lib/item-dna/rules';
import { evolveGenome, predictDistribution } from '@/lib/item-dna/rolling-engine';
import { PRESET_GENOMES, DEMO_AFFIX_POOL } from '@/components/modules/core-engine/sub_inventory/dna-genome/data';
import type { ItemGenome, TraitAxis } from '@/types/item-genome';

/**
 * Acceptance for scan-sweep --challenge card inventory-genome-economy/A (cases 1-5):
 * one item-DNA rules table (src/lib/item-dna/rules.ts) read by the engine, and an
 * evolution that is path-independent, reaches every genome and feeds the roll bonus.
 */

function preset(name: string): ItemGenome {
  const g = PRESET_GENOMES.find((p) => p.name === name);
  if (!g) throw new Error(`missing preset ${name}`);
  return g;
}

function weight(g: ItemGenome, axis: TraitAxis): number {
  return g.traits.find((t) => t.axis === axis)!.weight;
}

describe('item-DNA rules: evolution', () => {
  it('case 1: the tier-up bonus does not depend on how the XP arrived', () => {
    const staff = preset('Mage Staff');
    const jump = evolveGenome(staff, 500).evolved;
    const steps = evolveGenome(evolveGenome(staff, 100).evolved, 400).evolved;
    expect(jump.evolution?.tier).toBe(2);
    expect(steps.evolution?.tier).toBe(2);
    expect(jump.traits).toEqual(steps.traits);
    expect(weight(jump, 'utility')).toBe(0.95);
    expect(weight(steps, 'utility')).toBe(0.95);
    expect(weight(jump, 'utility')).toBe(Math.round((0.8 + tierBonus(2)) * 100) / 100);
  });

  it('case 2: a genome with no gene above 0.5 still evolves its argmax axis', () => {
    const rogue = preset('Rogue Leather');
    const { evolved, tierChanged } = evolveGenome(rogue, 100);
    expect(tierChanged).toBe(true);
    expect(evolved.evolution?.tier).toBe(1);
    expect(weight(evolved, 'offensive')).toBe(0.5);
    expect(weight(evolved, 'utility')).toBe(0.4);
  });

  it('case 3: a tier-up records the dominant gene affinity tags as dominantTraits', () => {
    const { evolved } = evolveGenome(preset('Warrior Blade'), 100);
    expect(evolved.evolution?.dominantTraits).toEqual(['Stat.Strength', 'Stat.CritChance', 'Stat.AttackPower']);
  });

  it('case 4: an evolved genome rolls more of its dominant axis than the same traits unevolved', () => {
    const { evolved } = evolveGenome(preset('Warrior Blade'), 2000);
    expect(evolved.evolution?.tier).toBe(3);
    const withEvo = predictDistribution(evolved, DEMO_AFFIX_POOL, 'Rare');
    const withoutEvo = predictDistribution({ ...evolved, evolution: undefined }, DEMO_AFFIX_POOL, 'Rare');
    expect(withEvo.offensive).toBeGreaterThan(withoutEvo.offensive);
  });
});

describe('item-DNA rules: the table', () => {
  it('case 5: thresholds, affix counts and level scaling come from one table', () => {
    expect(EVOLUTION_TIERS.map((t) => t.xp)).toEqual([100, 500, 2000]);
    expect(affixCountRange('Rare')).toEqual([3, 4]);
    expect(describeAffixCount('Common')).toBe('0');
    expect(describeAffixCount('Rare')).toBe('3-4');
    expect(scaleByLevel(10, 10)).toBe(20);
  });
});
