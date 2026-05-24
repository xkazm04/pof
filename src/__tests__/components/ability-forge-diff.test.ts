import { describe, it, expect } from 'vitest';
import {
  diffAbilityStats,
  diffAbilityTags,
  diffLines,
  summarizeLines,
  collapseDiff,
  abilityHasChanges,
} from '@/components/modules/core-engine/sub_ability/forge/ability-diff';
import type { ForgedAbility } from '@/lib/prompts/ability-forge';

function makeAbility(over: Partial<ForgedAbility> = {}): ForgedAbility {
  return {
    className: 'GA_FlameDash',
    displayName: 'Flame Dash',
    description: 'A dashing slash wreathed in fire.',
    headerCode: 'line a\nline b\nline c',
    cppCode: 'AbilityManaCost = 25.f;',
    tags: {
      abilityTag: 'Ability_FlameDash',
      cooldownTag: 'Cooldown_FlameDash',
      ownedTags: ['State_Dashing'],
      blockedTags: ['State_Dead', 'State_Stunned'],
    },
    stats: { baseDamage: 40, manaCost: 25, cooldownSec: 8, damageType: 'Fire' },
    comboEntry: { animDuration: 0.8, damageWindow: [0.3, 0.5], recovery: 0.2, comboMultiplier: 1.2 },
    radarValues: [0.6, 0.5, 0.2, 0.7, 0.5],
    ...over,
  };
}

describe('diffAbilityStats', () => {
  it('returns nothing when stats are identical', () => {
    expect(diffAbilityStats(makeAbility(), makeAbility())).toEqual([]);
  });

  it('reports a damage increase with a signed delta and up direction', () => {
    const next = makeAbility({ stats: { baseDamage: 55, manaCost: 25, cooldownSec: 8, damageType: 'Fire' } });
    const deltas = diffAbilityStats(makeAbility(), next);
    const dmg = deltas.find((d) => d.label === 'Damage');
    expect(dmg).toMatchObject({ from: '40', to: '55', delta: '+15', direction: 'up' });
  });

  it('reports a mana cut as a down direction', () => {
    const next = makeAbility({ stats: { baseDamage: 40, manaCost: 17.5, cooldownSec: 8, damageType: 'Fire' } });
    const mana = diffAbilityStats(makeAbility(), next).find((d) => d.label === 'Mana');
    expect(mana?.direction).toBe('down');
  });

  it('reports a damage-type change as a neutral text delta', () => {
    const next = makeAbility({ stats: { baseDamage: 40, manaCost: 25, cooldownSec: 8, damageType: 'Ice' } });
    const type = diffAbilityStats(makeAbility(), next).find((d) => d.label === 'Damage Type');
    expect(type).toMatchObject({ from: 'Fire', to: 'Ice', delta: null, direction: 'neutral' });
  });

  it('reports radar profile shifts as percentages', () => {
    const next = makeAbility({ radarValues: [0.6, 0.5, 0.8, 0.7, 0.5] });
    const aoe = diffAbilityStats(makeAbility(), next).find((d) => d.label === 'AOE');
    expect(aoe).toMatchObject({ from: '20%', to: '80%', direction: 'up' });
  });
});

describe('diffAbilityTags', () => {
  it('returns nothing when tags are identical', () => {
    expect(diffAbilityTags(makeAbility(), makeAbility())).toEqual([]);
  });

  it('detects added and removed owned tags', () => {
    const next = makeAbility({
      tags: { ...makeAbility().tags, ownedTags: ['State_Attacking'] },
    });
    const change = diffAbilityTags(makeAbility(), next).find((c) => c.group === 'Owned Tags');
    expect(change).toMatchObject({ added: ['State_Attacking'], removed: ['State_Dashing'] });
  });

  it('treats a single tag rename as removed-old + added-new', () => {
    const next = makeAbility({
      tags: { ...makeAbility().tags, abilityTag: 'Ability_FlameNova' },
    });
    const change = diffAbilityTags(makeAbility(), next).find((c) => c.group === 'Ability Tag');
    expect(change).toMatchObject({ added: ['Ability_FlameNova'], removed: ['Ability_FlameDash'] });
  });
});

describe('diffLines', () => {
  it('marks unchanged lines as equal', () => {
    const lines = diffLines('a\nb', 'a\nb');
    expect(lines.every((l) => l.type === 'eq')).toBe(true);
  });

  it('marks an inserted line as add and a dropped line as del', () => {
    const lines = diffLines('a\nc', 'a\nb\nc');
    expect(lines).toContainEqual({ type: 'add', text: 'b' });
    expect(lines.filter((l) => l.type === 'eq').map((l) => l.text)).toEqual(['a', 'c']);
  });

  it('handles an empty before string (all additions)', () => {
    const lines = diffLines('', 'x\ny');
    expect(lines).toEqual([
      { type: 'add', text: 'x' },
      { type: 'add', text: 'y' },
    ]);
  });

  it('summarizes added/removed counts', () => {
    const lines = diffLines('a\nb\nc', 'a\nX\nc\nd');
    expect(summarizeLines(lines)).toEqual({ added: 2, removed: 1 });
  });
});

describe('collapseDiff', () => {
  it('keeps changed lines plus context and elides distant unchanged runs', () => {
    const before = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].join('\n');
    const after = ['a', 'b', 'c', 'D', 'e', 'f', 'g', 'h'].join('\n'); // change at index 3
    const rows = collapseDiff(diffLines(before, after), 1);
    // First run a..b is elided down to a gap (only 'c' is within context of the change)
    const gap = rows.find((r) => r.type === 'gap');
    expect(gap).toBeTruthy();
    // The changed pair is present
    expect(rows).toContainEqual({ type: 'del', text: 'd' });
    expect(rows).toContainEqual({ type: 'add', text: 'D' });
  });

  it('returns no gaps when every line is near a change', () => {
    const rows = collapseDiff(diffLines('a\nb', 'a\nX'), 2);
    expect(rows.some((r) => r.type === 'gap')).toBe(false);
  });
});

describe('abilityHasChanges', () => {
  it('is false for identical abilities', () => {
    expect(abilityHasChanges(makeAbility(), makeAbility())).toBe(false);
  });
  it('is true when any code/stat/tag changes', () => {
    expect(abilityHasChanges(makeAbility(), makeAbility({ cppCode: 'AbilityManaCost = 18.f;' }))).toBe(true);
  });
});
