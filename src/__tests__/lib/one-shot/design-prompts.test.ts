import { describe, it, expect } from 'vitest';
import { buildProposalPrompt, buildRefinePrompt } from '@/lib/one-shot/design-prompts';
import type { CatalogDistribution } from '@/lib/catalog/gap-analysis';

const dist: CatalogDistribution = {
  catalogId: 'items',
  total: 7,
  byAttribute: { rarity: { Common: 5, Rare: 2 }, type: { Weapon: 4, Armor: 3 } },
  underrepresented: [{ attribute: 'type', value: 'Accessory', count: 0, expected: 2 }],
  sample: [
    { id: 'item-1', catalogId: 'items', name: 'Iron Longsword', categoryPath: [], tags: [], lifecycle: 'planned', data: { type: 'Weapon', subtype: 'Sword', rarity: 'Common', level: 1 } } as any,
  ],
};

describe('buildProposalPrompt', () => {
  it('contains the catalog id + total + a histogram', () => {
    const p = buildProposalPrompt('items', dist);
    expect(p).toMatch(/items/i);
    expect(p).toMatch(/Total entities: 7/);
    expect(p).toMatch(/rarity/);
    expect(p).toMatch(/Common: 5/);
  });

  it('cites the under-represented niches', () => {
    const p = buildProposalPrompt('items', dist);
    expect(p).toMatch(/Accessory/);
  });

  it('includes the per-catalog data schema clause', () => {
    const p = buildProposalPrompt('items', dist);
    expect(p).toMatch(/schema/i);
    expect(p).toMatch(/rarity/);
  });

  it('embeds the @@CALLBACK marker', () => {
    const p = buildProposalPrompt('items', dist);
    expect(p).toMatch(/@@CALLBACK:[^\s]+/);
    expect(p).toMatch(/@@END_CALLBACK/);
  });

  it('respects the userHint', () => {
    const p = buildProposalPrompt('items', dist, 'a melee weapon at tier 4');
    expect(p).toMatch(/melee weapon at tier 4/);
  });
});

describe('buildRefinePrompt', () => {
  it('embeds the prior proposal + user input', () => {
    const proposal = { name: 'Iron Axe', data: { type: 'Weapon', subtype: 'Axe' }, rationale: 'fills the gap' };
    const p = buildRefinePrompt('items', dist, proposal, 'make it heavier');
    expect(p).toMatch(/Iron Axe/);
    expect(p).toMatch(/make it heavier/);
  });
});
