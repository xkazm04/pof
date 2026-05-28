import { describe, it, expect } from 'vitest';
import { matchCondition, evaluateItem, evaluateRuleset } from '@/lib/loot-filter/engine';
import type { ItemData } from '@/components/modules/core-engine/sub_inventory/_shared/data';
import type { LootFilterRule, LootFilterRuleset } from '@/lib/loot-filter/types';

const item = (over: Partial<ItemData> = {}): ItemData => ({
  id: over.id ?? 'x',
  name: over.name ?? 'X',
  type: over.type ?? 'Weapon',
  subtype: over.subtype ?? 'Sword',
  rarity: over.rarity ?? 'Common',
  stats: over.stats ?? [],
  description: over.description ?? '',
  ...(over.affixes ? { affixes: over.affixes } : {}),
});

const rule = (over: Partial<LootFilterRule>): LootFilterRule => ({
  id: over.id ?? 'r1',
  name: over.name ?? 'Rule',
  enabled: over.enabled ?? true,
  action: over.action ?? 'show',
  condition: over.condition ?? {},
  style: over.style ?? {},
});

const ruleset = (rules: LootFilterRule[]): LootFilterRuleset => ({
  id: 'rs', name: 'RS', rules, updatedAt: '2026-01-01T00:00:00.000Z',
});

describe('matchCondition', () => {
  it('an empty condition matches any item (wildcard)', () => {
    expect(matchCondition(item(), {})).toBe(true);
  });

  it('matches on rarity membership', () => {
    expect(matchCondition(item({ rarity: 'Legendary' }), { rarities: ['Legendary', 'Epic'] })).toBe(true);
    expect(matchCondition(item({ rarity: 'Common' }), { rarities: ['Legendary', 'Epic'] })).toBe(false);
  });

  it('matches on item type and subtype', () => {
    expect(matchCondition(item({ type: 'Armor' }), { types: ['Armor'] })).toBe(true);
    expect(matchCondition(item({ subtype: 'Bow' }), { subtypes: ['Bow'] })).toBe(true);
    expect(matchCondition(item({ subtype: 'Bow' }), { subtypes: ['Sword'] })).toBe(false);
  });

  it('matches affixAxes when the item carries an affix of that category', () => {
    const offensive = item({ affixes: [{ name: 'Blazing', stat: '+Fire', category: 'offensive' }] });
    expect(matchCondition(offensive, { affixAxes: ['offensive'] })).toBe(true);
    expect(matchCondition(offensive, { affixAxes: ['defensive'] })).toBe(false);
    expect(matchCondition(item(), { affixAxes: ['offensive'] })).toBe(false); // no affixes
  });

  it('requires ALL populated axes to match (AND across axes)', () => {
    const c = { rarities: ['Rare'], types: ['Weapon'] };
    expect(matchCondition(item({ rarity: 'Rare', type: 'Weapon' }), c)).toBe(true);
    expect(matchCondition(item({ rarity: 'Rare', type: 'Armor' }), c)).toBe(false);
  });
});

describe('evaluateItem', () => {
  it('returns the first ENABLED matching rule (order wins)', () => {
    const rs = ruleset([
      rule({ id: 'a', action: 'hide', condition: { rarities: ['Common'] } }),
      rule({ id: 'b', action: 'show', condition: { types: ['Weapon'] } }),
    ]);
    const out = evaluateItem(item({ rarity: 'Common', type: 'Weapon' }), rs);
    expect(out.matchedRuleId).toBe('a');
    expect(out.action).toBe('hide');
    expect(out.visible).toBe(false);
  });

  it('skips disabled rules', () => {
    const rs = ruleset([
      rule({ id: 'a', enabled: false, action: 'hide', condition: { rarities: ['Common'] } }),
      rule({ id: 'b', action: 'highlight', condition: {}, style: { color: '#fff', beam: true } }),
    ]);
    const out = evaluateItem(item({ rarity: 'Common' }), rs);
    expect(out.matchedRuleId).toBe('b');
    expect(out.action).toBe('highlight');
    expect(out.style.beam).toBe(true);
  });

  it('defaults to visible Show with no match when nothing matches', () => {
    const rs = ruleset([rule({ id: 'a', action: 'hide', condition: { rarities: ['Legendary'] } })]);
    const out = evaluateItem(item({ rarity: 'Common' }), rs);
    expect(out.matchedRuleId).toBeNull();
    expect(out.action).toBe('show');
    expect(out.visible).toBe(true);
  });
});

describe('evaluateRuleset', () => {
  it('tallies shown / highlighted / hidden across items', () => {
    const rs = ruleset([
      rule({ id: 'hi', action: 'highlight', condition: { rarities: ['Legendary'] } }),
      rule({ id: 'hide', action: 'hide', condition: { rarities: ['Common'] } }),
    ]);
    const items = [
      item({ id: '1', rarity: 'Legendary' }), // highlighted
      item({ id: '2', rarity: 'Common' }),    // hidden
      item({ id: '3', rarity: 'Rare' }),      // default show
    ];
    const ev = evaluateRuleset(items, rs);
    expect(ev.outcomes).toHaveLength(3);
    expect(ev.highlighted).toBe(1);
    expect(ev.hidden).toBe(1);
    expect(ev.shown).toBe(1);
  });
});
