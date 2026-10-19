import { describe, it, expect } from 'vitest';
import { validateProposal } from '@/lib/one-shot/validate-proposal';

describe('validate-proposal', () => {
  it('passes a well-formed items proposal', () => {
    const proposal = { name: 'Iron Hatchet', data: { type: 'Weapon', subtype: 'Axe', rarity: 'Common', level: 3, stats: [{ label: 'Damage', value: '8-14' }] } };
    const issues = validateProposal('items', proposal, { seededIds: new Set(['item-1']) });
    expect(issues).toEqual([]);
  });

  it('flags a missing required field', () => {
    const proposal = { name: 'Iron Hatchet', data: { subtype: 'Axe' } };
    const issues = validateProposal('items', proposal, { seededIds: new Set() });
    expect(issues.some((i) => /required.*type/i.test(i.message))).toBe(true);
  });

  it('flags a link to a non-existent seeded id', () => {
    const proposal = {
      name: 'X', data: { type: 'Weapon', rarity: 'Common', links: [{ catalogId: 'spellbook', entityId: 'off-fire-999', role: 'innate' }] },
    };
    const issues = validateProposal('items', proposal, { seededIds: new Set(['off-fire-01']) });
    expect(issues.some((i) => /off-fire-999/.test(i.message))).toBe(true);
  });

  it('flags a numeric out of band', () => {
    const proposal = { name: 'X', data: { type: 'Weapon', rarity: 'Common', level: 9999 } };
    const issues = validateProposal('items', proposal, { seededIds: new Set(), bands: { level: { min: 1, max: 20 } } });
    expect(issues.some((i) => /level.*9999/.test(i.message))).toBe(true);
  });
});

describe('validate-proposal — catalog-aware link resolution', () => {
  const proposal = (entityId: string, catalogId = 'spellbook') => ({
    name: 'Xy', data: { type: 'Weapon', rarity: 'Common', links: [{ catalogId, entityId, role: 'innate' }] },
  });

  it('accepts a cross-catalog link the resolver knows', () => {
    const issues = validateProposal('items', proposal('off-fire-01'), { resolveLink: (c, id) => c === 'spellbook' && id === 'off-fire-01' });
    expect(issues).toEqual([]);
  });

  it('names both catalog and entity when the resolver says no', () => {
    const issues = validateProposal('items', proposal('off-fire-01'), { resolveLink: () => false });
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toMatch(/spellbook/);
    expect(issues[0].message).toMatch(/off-fire-01/);
  });

  it('reports an unknown catalog as its own issue, not a missing id', () => {
    const issues = validateProposal('items', proposal('x-1', 'nope'), { resolveLink: () => false, knownCatalog: () => false });
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toMatch(/unknown catalog 'nope'/);
  });
});
