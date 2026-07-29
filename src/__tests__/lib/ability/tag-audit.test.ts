import { describe, it, expect } from 'vitest';
import { computeTagAudit, specTagReferences } from '@/lib/ability/tag-audit';
import { STATUS_NEUTRAL } from '@/lib/chart-colors';

describe('computeTagAudit', () => {
  it('scores 100 when declared and referenced sets are identical (all matched)', () => {
    const r = computeTagAudit(['Ability.Melee', 'State.Dead'], ['Ability.Melee', 'State.Dead']);
    expect(r.score).toBe(100);
    expect(r.matched).toEqual(['Ability.Melee', 'State.Dead']);
    expect(r.undeclared).toEqual([]);
    expect(r.orphaned).toEqual([]);
    expect(r.declaredCount).toBe(2);
    expect(r.referencedCount).toBe(2);
  });

  it('flags undeclared tags — referenced but never declared', () => {
    const r = computeTagAudit(['Ability.Melee'], ['Ability.Melee', 'Ability.RangedAttack']);
    expect(r.undeclared).toEqual(['Ability.RangedAttack']);
    expect(r.matched).toEqual(['Ability.Melee']);
    expect(r.orphaned).toEqual([]);
    // union = 2, matched = 1 -> 50
    expect(r.score).toBe(50);
  });

  it('flags orphaned tags — declared but referenced by no rule', () => {
    const r = computeTagAudit(['Ability.Melee', 'State.Invulnerable'], ['Ability.Melee']);
    expect(r.orphaned).toEqual(['State.Invulnerable']);
    expect(r.matched).toEqual(['Ability.Melee']);
    expect(r.undeclared).toEqual([]);
    expect(r.score).toBe(50);
  });

  it('mixes matched / undeclared / orphaned and derives a Jaccard score', () => {
    // declared {A.b, A.c}, referenced {A.b, A.x}
    // matched [A.b], undeclared [A.x], orphaned [A.c] -> union 3, score round(1/3*100)=33
    const r = computeTagAudit(['A.b', 'A.c'], ['A.b', 'A.x']);
    expect(r.matched).toEqual(['A.b']);
    expect(r.undeclared).toEqual(['A.x']);
    expect(r.orphaned).toEqual(['A.c']);
    expect(r.score).toBe(33);
  });

  it('scores 100 for the empty/empty case (nothing to reconcile)', () => {
    const r = computeTagAudit([], []);
    expect(r.score).toBe(100);
    expect(r.matched).toEqual([]);
    expect(r.undeclared).toEqual([]);
    expect(r.orphaned).toEqual([]);
    expect(r.declaredCount).toBe(0);
    expect(r.referencedCount).toBe(0);
  });

  it('scores 0 when references share nothing with declarations', () => {
    const r = computeTagAudit(['Declared.Only'], ['Referenced.Only']);
    // matched 0, undeclared 1, orphaned 1 -> union 2 -> 0
    expect(r.score).toBe(0);
    expect(r.matched).toEqual([]);
  });

  it('de-dupes, trims, and ignores empty entries', () => {
    const r = computeTagAudit(
      ['Ability.Melee', 'Ability.Melee', '  Ability.Melee  ', ''],
      ['Ability.Melee', '  ', 'Ability.Melee'],
    );
    expect(r.declaredCount).toBe(1);
    expect(r.referencedCount).toBe(1);
    expect(r.score).toBe(100);
    expect(r.matched).toEqual(['Ability.Melee']);
  });

  it('is order-independent and returns sorted output lists', () => {
    const r = computeTagAudit(['Z.tag', 'A.tag'], ['A.tag', 'M.ref']);
    expect(r.matched).toEqual(['A.tag']);
    expect(r.undeclared).toEqual(['M.ref']);
    expect(r.orphaned).toEqual(['Z.tag']);
  });

  it('normalizes the C++ dialect on both sides before comparing', () => {
    const r = computeTagAudit(['Ability.Fire'], ['Ability_Fire']);
    expect(r.matched).toEqual(['Ability.Fire']);
    expect(r.undeclared).toEqual([]);
    expect(r.score).toBe(100);
  });
});

describe('computeTagAudit — app-authored tags as a distinct source', () => {
  it('app tags join the referenced set and are reported separately', () => {
    const r = computeTagAudit(['Ability.Fire', 'State.Dead'], ['Ability.Fire'], ['State.Dead']);
    expect(r.matched).toEqual(['Ability.Fire', 'State.Dead']);
    expect(r.appReferenced).toEqual(['State.Dead']);
    expect(r.orphaned).toEqual([]);
    expect(r.score).toBe(100);
  });

  it('an app tag with no C++ declaration is a real undeclared-tag bug', () => {
    const r = computeTagAudit(['Ability.Fire'], ['Ability.Fire'], ['Ability.Homebrew']);
    expect(r.undeclared).toEqual(['Ability.Homebrew']);
    expect(r.appReferenced).toEqual(['Ability.Homebrew']);
  });

  it('defaults to no app source (UE-vs-UE) — appReferenced is empty, not absent', () => {
    const r = computeTagAudit(['Ability.Fire'], ['Ability.Fire']);
    expect(r.appReferenced).toEqual([]);
  });
});

describe('specTagReferences', () => {
  const spec = {
    catalogId: 'spellbook', entityId: 'off-fire-01',
    effects: [{
      id: 'e', name: 'GE_X', duration: 'instant' as const, durationSec: 0, cooldownSec: 0,
      color: STATUS_NEUTRAL, modifiers: [], grantedTags: ['State_Casting', 'State.Casting'],
    }],
    tagRules: [{ id: 'r', sourceTag: 'Ability_Fire', targetTag: 'State.Dead', type: 'blocks' as const }],
  };

  it('collects rule + granted tags, normalized to dotted, de-duped and sorted', () => {
    expect(specTagReferences([spec])).toEqual(['Ability.Fire', 'State.Casting', 'State.Dead']);
  });

  it('is empty for no specs', () => {
    expect(specTagReferences([])).toEqual([]);
  });
});
