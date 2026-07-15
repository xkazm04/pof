import { describe, it, expect } from 'vitest';
import { computeTagAudit } from '@/lib/ability/tag-audit';

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
});
