import { describe, it, expect } from 'vitest';
import { linksResolve } from '@/lib/catalog/acceptance/linkCheckers';
import { allOf } from '@/lib/catalog/acceptance/combinators';
import { fieldsPopulated } from '@/lib/catalog/acceptance/dataCheckers';
import type { Checker, CheckerContext } from '@/lib/catalog/acceptance/types';

/** A ctx where only combat-map::arena-a and bestiary::brute exist. */
const ctx = (siblings: Record<string, Record<string, unknown>> = {}): CheckerContext => ({
  catalog: 'zone-map',
  siblings,
  has: (c, e) => (c === 'combat-map' && e === 'arena-a') || (c === 'bestiary' && e === 'brute'),
});

describe('CheckerContext threading', () => {
  it('linksResolve passes when all declared links resolve via ctx.has', () => {
    const data = { links: [{ catalogId: 'combat-map', entityId: 'arena-a' }] };
    expect(linksResolve()(data, ctx()).status).toBe('pass');
  });

  it('linksResolve defers with a specific reason naming a broken cross-catalog target', () => {
    const data = {
      links: [
        { catalogId: 'combat-map', entityId: 'arena-a' },
        { catalogId: 'bestiary', entityId: 'ghost' },
      ],
    };
    const r = linksResolve()(data, ctx());
    expect(r.status).toBe('deferred');
    expect(r.reason).toContain('bestiary::ghost');
  });

  it('does NOT regress to pending/fail when ctx is absent (rollup path)', () => {
    const data = { links: [{ catalogId: 'combat-map', entityId: 'nope' }] };
    expect(linksResolve()(data).status).toBe('pass');
  });

  it('a checker can read a SIBLING step value via ctx.siblings', () => {
    // A bespoke checker that cross-validates this step's areaLevel against the sibling
    // "Area Level & Density" step — proving siblings flow through the ctx.
    const matchesSiblingAreaLevel: Checker = (data, c) => {
      const mine = Number((data as { areaLevel?: unknown }).areaLevel);
      const sib = c?.siblings['Area Level & Density'] as { density?: { areaLevel?: number } } | undefined;
      const theirs = sib?.density?.areaLevel;
      const ok = theirs != null && mine === theirs;
      return ok
        ? { label: 'areaLevel matches sibling', tier: 'L2', status: 'pass', detail: `${mine} === ${theirs}` }
        : { label: 'areaLevel matches sibling', tier: 'L2', status: 'fail', detail: `${mine} vs ${theirs}`, reason: `areaLevel ${mine} disagrees with Area Level & Density step (${theirs})` };
    };
    const siblings = { 'Area Level & Density': { density: { areaLevel: 5 } } };
    expect(matchesSiblingAreaLevel({ areaLevel: 5 }, ctx(siblings)).status).toBe('pass');
    const bad = matchesSiblingAreaLevel({ areaLevel: 9 }, ctx(siblings));
    expect(bad.status).toBe('fail');
    expect(bad.reason).toContain('disagrees');
  });

  it('allOf reports the first non-pass with its specific reason', () => {
    const combined = allOf(
      fieldsPopulated('encounters', 'fields', ['hostedArena']),
      linksResolve('links'),
    );
    // fields populated + links resolve → pass
    const good = { encounters: { hostedArena: {} }, links: [{ catalogId: 'combat-map', entityId: 'arena-a' }] };
    expect(combined(good, ctx()).status).toBe('pass');
    // broken link surfaces as deferred with reason, even though fields are populated
    const brokenLink = { encounters: { hostedArena: {} }, links: [{ catalogId: 'combat-map', entityId: 'nope' }] };
    const r = combined(brokenLink, ctx());
    expect(r.status).toBe('deferred');
    expect(r.reason).toContain('combat-map::nope');
  });
});
