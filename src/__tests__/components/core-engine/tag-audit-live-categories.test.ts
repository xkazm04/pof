import { describe, it, expect } from 'vitest';
import { computeTagAudit } from '@/lib/ability/tag-audit';
import {
  buildLiveTagAudit, buildLiveTagAuditCategories,
  TAG_AUDIT_CATEGORIES as STATIC_TAG_AUDIT_CATEGORIES,
} from '@/components/modules/core-engine/sub_ability/_shared/data';
import type { ParsedAbility, ParsedTag } from '@/lib/ue5-source-parser';

function tag(tagString: string): ParsedTag {
  return { cppName: tagString.replace(/\./g, '_'), tagString, comment: '', category: tagString.split('.')[0] };
}

function ability(over: Partial<ParsedAbility>): ParsedAbility {
  return {
    className: 'UGA_X', displayName: 'X', description: '', sourceFile: 'X.cpp',
    baseDamage: null, aoERadius: null, explosionRadius: null, dashDistance: null,
    sweepRadius: null, staminaCost: null, hitRadius: null,
    manaCost: 0, cooldownTag: null, abilityTag: null,
    activationOwnedTags: [], activationBlockedTags: [], isPlayerAbility: true,
    ...over,
  };
}

describe('buildLiveTagAudit — app-authored tags reach the audit', () => {
  it('an app-only tag that IS declared in C++ stops reading as orphaned', () => {
    const tags = [tag('Ability.Fire'), tag('State.Casting')];
    const abilities = [ability({ abilityTag: 'Ability.Fire' })];

    const ueOnly = buildLiveTagAudit(abilities, tags);
    expect(ueOnly.orphaned).toEqual(['State.Casting']);
    expect(ueOnly.appReferenced).toEqual([]);

    const withApp = buildLiveTagAudit(abilities, tags, ['State.Casting']);
    expect(withApp.orphaned).toEqual([]);
    expect(withApp.appReferenced).toEqual(['State.Casting']);
    expect(withApp.score).toBe(100);
  });
});

describe('buildLiveTagAuditCategories — replaces the static fiction', () => {
  it('derives every count from named sets in the breakdown', () => {
    // declared {A.b, A.c}; UE references {A.b}; app references {A.x}
    const audit = computeTagAudit(['A.b', 'A.c'], ['A.b'], ['A.x']);
    const cats = buildLiveTagAuditCategories(audit);

    const byName = Object.fromEntries(cats.map((c) => [c.name, c]));
    expect(byName.Missing.count).toBe(1);
    expect(byName.Missing.status).toBe('error');
    expect(byName.Missing.detail).toContain('A.x');

    expect(byName.Unused.count).toBe(1);
    expect(byName.Unused.status).toBe('warning');
    expect(byName.Unused.detail).toContain('A.c');

    expect(byName['App-authored'].count).toBe(1);
    expect(byName['App-authored'].status).toBe('pass');
    expect(byName['App-authored'].detail).toContain('A.x');
  });

  it('a clean audit derives all-pass categories (no invented warnings)', () => {
    const cats = buildLiveTagAuditCategories(computeTagAudit(['A.b'], ['A.b']));
    expect(cats.every((c) => c.status === 'pass')).toBe(true);
    expect(cats.reduce((s, c) => s + (c.status === 'pass' ? 0 : c.count), 0)).toBe(0);
  });

  it('flags a tag that breaks the Dotted.Segment convention', () => {
    const cats = buildLiveTagAuditCategories(computeTagAudit(['A b'], ['A b']));
    const naming = cats.find((c) => c.name === 'Naming')!;
    expect(naming.status).toBe('warning');
    expect(naming.count).toBe(1);
  });

  it('shares no invented row with the static TAG_AUDIT_CATEGORIES fiction', () => {
    const cats = buildLiveTagAuditCategories(computeTagAudit(['A.b'], ['A.b']));
    // The static array hard-codes a 3-unused / 1-missing story; the derived one
    // must never reproduce those numbers out of thin air.
    const staticMissing = STATIC_TAG_AUDIT_CATEGORIES.find((c) => c.name === 'Missing')!;
    expect(staticMissing.count).toBe(1);
    expect(cats.find((c) => c.name === 'Missing')!.count).toBe(0);
  });
});
