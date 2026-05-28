import { describe, it, expect } from 'vitest';
import {
  lootFilterSlug, dataTableAssetPath, rulesetToDataTableRows, rulesetToDataTableJson,
} from '@/lib/loot-filter/export';
import { STATUS_WARNING } from '@/lib/chart-colors';
import type { LootFilterRule, LootFilterRuleset } from '@/lib/loot-filter/types';

const rule = (over: Partial<LootFilterRule>): LootFilterRule => ({
  id: over.id ?? 'r', name: over.name ?? 'Rule', enabled: over.enabled ?? true,
  action: over.action ?? 'show', condition: over.condition ?? {}, style: over.style ?? {},
});

const rs: LootFilterRuleset = {
  id: 'rs', name: 'My Endgame Filter!', updatedAt: '2026-01-01T00:00:00.000Z',
  rules: [
    rule({ id: 'a', name: 'Highlight Legendaries', action: 'highlight', condition: { rarities: ['Legendary', 'Epic'] }, style: { color: STATUS_WARNING, sound: 'Drumroll', beam: true } }),
    rule({ id: 'b', name: 'Hide Junk', enabled: false, action: 'hide', condition: { rarities: ['Common'] } }),
    rule({ id: 'c', name: 'Show Weapons', action: 'show', condition: { types: ['Weapon'], affixAxes: ['offensive'] } }),
  ],
};

describe('lootFilterSlug', () => {
  it('keeps alphanumerics and collapses other runs into single underscores', () => {
    expect(lootFilterSlug('My Endgame Filter!')).toBe('My_Endgame_Filter');
  });
  it('falls back to Unnamed for an empty / symbol-only name', () => {
    expect(lootFilterSlug('   ')).toBe('Unnamed');
    expect(lootFilterSlug('!!!')).toBe('Unnamed');
  });
});

describe('dataTableAssetPath', () => {
  it('builds the UE content path from the ruleset name', () => {
    expect(dataTableAssetPath(rs)).toBe('/Game/Data/LootFilters/DT_LootFilter_My_Endgame_Filter');
  });
});

describe('rulesetToDataTableRows', () => {
  it('emits only enabled rules, in order, with ascending Priority', () => {
    const rows = rulesetToDataTableRows(rs);
    expect(rows).toHaveLength(2); // 'b' is disabled
    expect(rows.map((r) => r.Priority)).toEqual([0, 1]);
    expect(rows.map((r) => r.Name)).toEqual(['LootRule_0_Highlight_Legendaries', 'LootRule_1_Show_Weapons']);
  });

  it('maps action to PascalCase and joins multi-value axes with commas', () => {
    const [hi] = rulesetToDataTableRows(rs);
    expect(hi.Action).toBe('Highlight');
    expect(hi.Rarities).toBe('Legendary,Epic');
    expect(hi.TextColor).toBe(STATUS_WARNING);
    expect(hi.Sound).toBe('Drumroll');
    expect(hi.Beam).toBe(true);
  });

  it('emits empty strings for unconstrained axes and missing style', () => {
    const [, weapons] = rulesetToDataTableRows(rs);
    expect(weapons.Rarities).toBe('');
    expect(weapons.ItemTypes).toBe('Weapon');
    expect(weapons.AffixAxes).toBe('offensive');
    expect(weapons.TextColor).toBe('');
    expect(weapons.Beam).toBe(false);
  });
});

describe('rulesetToDataTableJson', () => {
  it('serialises rows to a JSON array that round-trips', () => {
    const json = rulesetToDataTableJson(rs);
    const parsed = JSON.parse(json);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].Name).toBe('LootRule_0_Highlight_Legendaries');
  });
});
