import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  buildSpellbookView, spellbookMetrics,
} from '@/components/modules/core-engine/sub_ability/_shared/spellbookView';
import { buildSpellbookSearchIndex } from '@/components/modules/core-engine/sub_ability/spellbook-search-index';
import { useSpellbookData } from '@/components/modules/core-engine/sub_ability/_shared/context';
import {
  EXPANDED_EFFECTS, buildLiveTagAudit, buildLiveTagAuditCategories,
} from '@/components/modules/core-engine/sub_ability/_shared/data';
import { seedSpellbookEntries, abilityToEntry } from '@/lib/catalog/seed-spellbook';
import type { ParsedAbility, ParsedTag, ParsedUE5Data } from '@/lib/ue5-source-parser';

/**
 * Acceptance for scan-sweep --challenge card ability-spellbook-core/A: one pure
 * spellbook projection. The catalog owns the numbers (cooldown, radar), parsed C++
 * owns the vocabulary (tags, deps, attributes, audit), and there is one fallback.
 */

function ability(over: Partial<ParsedAbility>): ParsedAbility {
  return {
    className: 'UGA_Test', displayName: 'Test', description: '', sourceFile: 'GA_Test.cpp',
    baseDamage: null, aoERadius: null, explosionRadius: null, dashDistance: null,
    sweepRadius: null, staminaCost: null, hitRadius: null,
    manaCost: 0, cooldownTag: null, abilityTag: null,
    activationOwnedTags: [], activationBlockedTags: [],
    isPlayerAbility: true,
    ...over,
  };
}

function tag(tagString: string): ParsedTag {
  return {
    cppName: tagString.replace(/\./g, '_'), tagString, comment: tagString,
    category: tagString.split('.')[0],
  };
}

/** One live ability that matches the catalog (Ability.Dodge) and one that does not. */
function liveFixture(): ParsedUE5Data {
  return {
    sourceDir: 'C:/UE/Source', parsedAt: '2026-09-28T00:00:00Z',
    tags: [
      tag('Ability.Dodge'), tag('Cooldown.Dodge'), tag('Ability.Mystery'), tag('Cooldown.Mystery'),
      tag('State.Dead'), tag('State.Unused'), tag('Data.Init.Health'), tag('Data.Init.Armor'),
    ],
    abilities: [
      ability({
        className: 'UGA_Dodge', displayName: 'Dodge', abilityTag: 'Ability.Dodge',
        cooldownTag: 'Cooldown.Dodge', manaCost: 10, activationBlockedTags: ['State.Dead'],
      }),
      ability({
        className: 'UGA_Mystery', displayName: 'Mystery Bolt', abilityTag: 'Ability.Mystery',
        cooldownTag: 'Cooldown.Mystery', activationBlockedTags: ['State.Missing'],
      }),
    ],
  };
}

const seed = () => seedSpellbookEntries();
const staticView = () => buildSpellbookView({ live: null, appTags: [], entries: seed() });

describe('buildSpellbookView — catalog owns the numbers', { timeout: 30_000 }, () => {
  it('case 1: static cooldowns are every seed entry with cooldown > 0; Dodge is 1, no `remaining`', () => {
    const entries = seed();
    const view = buildSpellbookView({ live: null, appTags: [], entries });
    const expected = entries.filter((e) => e.data.cooldown > 0);
    expect(view.COOLDOWN_ABILITIES).toHaveLength(58);
    expect(view.COOLDOWN_ABILITIES.map((r) => r.id)).toEqual(expected.map((e) => e.id));
    const dodge = view.COOLDOWN_ABILITIES.find((r) => r.name === 'Dodge');
    expect(dodge?.cd).toBe(1);
    for (const row of view.COOLDOWN_ABILITIES) expect('remaining' in row).toBe(false);
    // The tag popover reads the same catalog number, not the hand-written 1.5 s / mana 10.
    expect(view.TAG_DETAIL_MAP['Ability.Dodge'].cooldown).toMatch(/\(1s\)/);
    expect(view.TAG_DETAIL_MAP['Ability.Dodge'].manaCost).toBe(0);
  });

  it('case 2: live rows join the catalog on abilityTag; an unmatched live ability has cd null', () => {
    const view = buildSpellbookView({ live: liveFixture(), appTags: [], entries: seed() });
    expect(view.COOLDOWN_ABILITIES).toHaveLength(2);
    const dodge = view.COOLDOWN_ABILITIES.find((r) => r.name === 'Dodge');
    const mystery = view.COOLDOWN_ABILITIES.find((r) => r.name === 'Mystery Bolt');
    expect(dodge?.cd).toBe(1);
    expect(mystery?.cd).toBeNull();
    expect(mystery?.cd).not.toBe(0);

    const m = spellbookMetrics(view);
    expect(m.avgCd).toBe(1);
    expect(m.minCd).toBe(1);
    expect(m.maxCd).toBe(1);
    expect(m.cooldownAbilityCount).toBe(2);
  });

  it('case 3: metrics count the catalog and the effect list, not the combo/4-effect fictions', () => {
    const entries = seed();
    const m = spellbookMetrics(buildSpellbookView({ live: null, appTags: [], entries }));
    expect(m.gaCount).toBe(70);
    expect(m.geCount).toBe(30);
    expect(m.activeEffects).toBe(23);
    expect(m.passiveEffects).toBe(7);

    const extra = abilityToEntry({ ...entries[0].data, id: 'test-extra-01', name: 'Extra Bolt' });
    const grown = spellbookMetrics(buildSpellbookView({ live: null, appTags: [], entries: [...entries, extra] }));
    expect(grown.gaCount).toBe(71);
  });

  it('case 4: the search index finds every catalog ability and every effect, de-duplicated', () => {
    const entries = seed();
    const results = buildSpellbookSearchIndex(buildSpellbookView({ live: null, appTags: [], entries }));
    const abilities = results.filter((r) => r.category === 'ability');
    const effects = results.filter((r) => r.category === 'effect');
    expect(abilities).toHaveLength(70);
    const abilityLabels = new Set(abilities.map((r) => r.label));
    expect(entries.filter((e) => abilityLabels.has(e.name))).toHaveLength(70);
    expect(effects).toHaveLength(30);
    const effectLabels = new Set(effects.map((r) => r.label));
    expect(EXPANDED_EFFECTS.filter((e) => effectLabels.has(e.name))).toHaveLength(30);
    expect(new Set(results.map((r) => r.id)).size).toBe(results.length);
  });

  it('case 5: every dataset says where it came from', () => {
    const vocab = ['TAG_TREE', 'TAG_DEP_NODES', 'TAG_DEP_EDGES', 'TAG_AUDIT', 'CORE_ATTRIBUTES', 'DERIVED_ATTRIBUTES'] as const;
    const live = buildSpellbookView({ live: liveFixture(), appTags: [], entries: seed() });
    const fallback = staticView();
    for (const key of vocab) {
      expect(live.provenance[key], key).toBe('ue-source');
      expect(fallback.provenance[key], key).toBe('illustrative');
    }
    for (const view of [live, fallback]) {
      expect(view.provenance.COOLDOWN_ABILITIES).toBe('catalog');
      expect(view.provenance.ABILITY_RADAR_DATA).toBe('catalog');
    }
  });

  it('case 6 [guard]: the live audit is exactly the data.ts builders; null when not live', () => {
    const live = liveFixture();
    const appTags = ['Ability.Mystery', 'Ability.AppOnly'];
    const view = buildSpellbookView({ live, appTags, entries: seed() });
    const audit = buildLiveTagAudit(live.abilities, live.tags, appTags);
    expect(view.TAG_AUDIT).toEqual(audit);
    expect(view.TAG_AUDIT_CATEGORIES).toEqual(buildLiveTagAuditCategories(audit));
    expect(staticView().TAG_AUDIT).toBeNull();
  });

  it('case 7: useSpellbookData outside a provider is ONE fallback, built by buildSpellbookView', () => {
    const a = renderHook(() => useSpellbookData()).result.current;
    const b = renderHook(() => useSpellbookData()).result.current;
    expect(b).toBe(a);
    const { isSyncing, refresh, ...fields } = a;
    expect(isSyncing).toBe(false);
    expect(typeof refresh).toBe('function');
    expect(fields).toEqual(staticView());
  });
});
