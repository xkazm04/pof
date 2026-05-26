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
