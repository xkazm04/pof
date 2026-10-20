import { describe, it, expect } from 'vitest';
import type { ItemData } from '@/components/modules/core-engine/sub_inventory/_shared/data';
import type { LootFilterRule } from '@/lib/loot-filter/types';
import { evaluateRuleset } from '@/lib/loot-filter/engine';
import { analyzeRuleset, diffEvaluations } from '@/lib/loot-filter/impact';

const item = (id: string, rarity: string, type: ItemData['type'] = 'Weapon'): ItemData => ({
  id, name: `Item ${id}`, type, subtype: 'Sword', rarity, stats: [], description: '',
});
const rule = (id: string, over: Partial<LootFilterRule> = {}): LootFilterRule => ({
  id, name: `Rule ${id}`, enabled: true, action: 'show', condition: {}, style: {}, ...over,
});
const items = [item('1', 'Common'), item('2', 'Rare'), item('3', 'Rare'), item('4', 'Epic'), item('5', 'Legendary')];
const sum = (r: { wins: number }[]) => r.reduce((n, x) => n + x.wins, 0);

describe('analyzeRuleset', () => {
  it('counts wins per rule; wins + defaulted equals item count', () => {
    const rules = [rule('a', { condition: { rarities: ['Rare'] } }), rule('b', { condition: { types: ['Weapon'] } })];
    const r = analyzeRuleset(items, rules);
    const byId = Object.fromEntries(r.rules.map((x) => [x.ruleId, x]));
    expect(byId.a).toMatchObject({ wins: 2, matches: 2 });
    expect(byId.b).toMatchObject({ wins: 3, matches: 5 });
    expect(r.defaulted).toBe(0);
    expect(sum(r.rules) + r.defaulted).toBe(items.length);
    const r2 = analyzeRuleset(items, [rule('a', { condition: { rarities: ['Rare'] } })]);
    expect(r2.defaulted).toBe(3);
    expect(sum(r2.rules) + r2.defaulted).toBe(items.length);
  });

  it('flags a fully claimed rule as shadowed with the earlier rule id', () => {
    const rules = [rule('a', { condition: { rarities: ['Rare'] } }), rule('b', { condition: { rarities: ['Rare'], types: ['Weapon'] } })];
    const b = analyzeRuleset(items, rules).rules[1];
    expect(b).toMatchObject({ matches: 2, wins: 0, flag: 'shadowed', shadowedBy: 'a' });
  });

  it('flags zero-match rules dead; disabled rules carry no flag and no wins', () => {
    const rules = [
      rule('dead', { condition: { rarities: ['Mythic'] } }),
      rule('off', { enabled: false, condition: { rarities: ['Rare'] } }),
    ];
    const [dead, off] = analyzeRuleset(items, rules).rules;
    expect(dead).toMatchObject({ matches: 0, flag: 'dead' });
    expect(off.flag).toBeNull();
    expect(off.wins).toBe(0);
  });

  it('warns when a Hide rule wins epic+ drops, listing names', () => {
    const rules = [rule('h', { action: 'hide', condition: { rarities: ['Epic', 'Legendary', 'Common'] } })];
    const r = analyzeRuleset(items, rules);
    expect(r.warnings).toEqual([
      expect.objectContaining({ ruleId: 'h', count: 2, itemNames: ['Item 4', 'Item 5'], message: 'hides 2 epic+ drops' }),
    ]);
    expect(analyzeRuleset(items, [rule('h', { action: 'hide', condition: { rarities: ['Common'] } })]).warnings).toEqual([]);
  });

  it('recomputes when a rule is moved above its shadow', () => {
    const a = rule('a', { condition: { rarities: ['Rare'] } });
    const b = rule('b', { condition: { rarities: ['Rare'], types: ['Weapon'] } });
    const before = analyzeRuleset(items, [a, b]).rules;
    const after = analyzeRuleset(items, [b, a]).rules;
    const w = (rs: typeof before, id: string) => rs.find((x) => x.ruleId === id)!.wins;
    expect(w(before, 'b')).toBe(0);
    expect(w(after, 'b')).toBe(2);
    expect(w(after, 'a')).toBe(0);
    expect(w(before, 'a')).toBe(2);
  });
});

describe('diffEvaluations', () => {
  it('lists items whose action changed, empty when identical', () => {
    const hide = rule('h', { action: 'hide', condition: { rarities: ['Common'] } });
    const before = evaluateRuleset(items, { id: 'x', name: 'x', updatedAt: '', rules: [] });
    const after = evaluateRuleset(items, { id: 'x', name: 'x', updatedAt: '', rules: [hide] });
    expect(diffEvaluations(before, after)).toEqual([{ itemId: '1', name: 'Item 1', from: 'show', to: 'hide' }]);
    expect(diffEvaluations(before, before)).toEqual([]);
  });
});
