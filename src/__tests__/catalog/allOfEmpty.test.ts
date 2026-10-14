import { describe, it, expect } from 'vitest';
import { allOf } from '@/lib/catalog/acceptance/combinators';

/**
 * allOf() with no members has nothing to report. It used to return `undefined` typed as an
 * AcceptanceResult, so a step composed from an empty (e.g. filtered) member list crashed its
 * reader. An empty conjunction measured nothing, so it is deferred, never a pass.
 */
describe('allOf — empty composition', () => {
  it('returns a deferred result, not undefined', () => {
    const r = allOf()({});
    expect(r).toBeDefined();
    expect(r.status).toBe('deferred');
    expect(r.reason).toMatch(/no checks/i);
  });
});
