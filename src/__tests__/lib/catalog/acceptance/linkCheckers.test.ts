import { describe, it, expect } from 'vitest';
import { linkTargetsExist } from '@/lib/catalog/acceptance/linkCheckers';

const has = (c: string, e: string) => c === 'spellbook' && e === 'force_push';

describe('linkTargetsExist', () => {
  it('pending when no links', () => {
    expect(linkTargetsExist([], has).status).toBe('pending');
  });
  it('pass when all links resolve', () => {
    const r = linkTargetsExist([{ catalogId: 'spellbook', entityId: 'force_push' }], has);
    expect(r).toMatchObject({ tier: 'L2', status: 'pass' });
  });
  it('deferred (not fail) listing unresolved targets with an actionable reason', () => {
    const r = linkTargetsExist([{ catalogId: 'spellbook', entityId: 'force_push' }, { catalogId: 'spellbook', entityId: 'ghost' }], has);
    expect(r.status).toBe('deferred');
    expect(r.reason).toContain('spellbook::ghost');
    expect(r.reason).toContain('seed the target entity, or drop the link and model it as descriptive data');
    expect(r.detail).toContain('1/2');
  });
});
