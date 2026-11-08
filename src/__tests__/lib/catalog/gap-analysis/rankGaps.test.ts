// @vitest-environment node
/**
 * catalog-gap-analysis/B — gaps are computed objects with a deficit, ranked in a deterministic
 * total order ending in stable identity; a catalog with no basis is listed as unmeasured, never
 * ranked and never called balanced; the top gap is phrased as the next action.
 */
import { describe, it, expect } from 'vitest';
import { rankCatalogGaps, gapTargetAction, asGapTarget } from '@/lib/catalog/gap-analysis/rankGaps';
import { planClosure } from '@/lib/catalog/gap-analysis/closurePlan';
import type { CatalogDistribution } from '@/lib/catalog/gap-analysis';

const itemsDist: CatalogDistribution = {
  catalogId: 'items', total: 100,
  byAttribute: { rarity: { Common: 34, Rare: 66 }, type: { Weapon: 75, Armor: 25 } },
  underrepresented: [
    { attribute: 'rarity', value: 'Common', count: 34, expected: 57 },
    { attribute: 'type', value: 'Armor', count: 25, expected: 43 },
  ],
  sample: [], gapBasis: 'expected-share',
};

const bestiaryDist: CatalogDistribution = {
  catalogId: 'bestiary', total: 40,
  byAttribute: { tier: { standard: 30, elite: 10 }, role: { melee: 36, healer: 4 } },
  underrepresented: [{ attribute: 'role', value: 'healer', count: 4, expected: 8 }],
  sample: [], gapBasis: 'expected-share',
};

describe('rankCatalogGaps', () => {
  it('ranks gaps across catalogs by deficit, in a deterministic order independent of input order', () => {
    const r = rankCatalogGaps([itemsDist, bestiaryDist]);
    expect(r.targets.map((t) => [t.catalogId, `${t.attribute}=${t.value}`, t.deficit])).toEqual([
      ['items', 'rarity=Common', 23],
      ['items', 'type=Armor', 18],
      ['bestiary', 'role=healer', 4],
    ]);
    expect(r.targets[0]).toEqual({ catalogId: 'items', attribute: 'rarity', value: 'Common', count: 34, expected: 57, deficit: 23 });
    const reversed = rankCatalogGaps([bestiaryDist, itemsDist]);
    expect(JSON.stringify(reversed)).toBe(JSON.stringify(r));
  });

  it('breaks deficit ties by catalogId, attribute, value', () => {
    const a: CatalogDistribution = { ...bestiaryDist, catalogId: 'zeta', underrepresented: [
      { attribute: 'role', value: 'tank', count: 1, expected: 5 },
      { attribute: 'role', value: 'healer', count: 1, expected: 5 },
    ] };
    const b: CatalogDistribution = { ...bestiaryDist, catalogId: 'alpha', underrepresented: [
      { attribute: 'tier', value: 'boss', count: 0, expected: 4 },
    ] };
    const r = rankCatalogGaps([a, b]);
    expect(r.targets.map((t) => `${t.catalogId}:${t.attribute}=${t.value}`)).toEqual([
      'alpha:tier=boss', 'zeta:role=healer', 'zeta:role=tank',
    ]);
  });

  it("near-tied gaps (raw 1.6 vs 2.4, both rounding to 2) rank in the closure plan's order", () => {
    const shares = { role: { aaa: 0.08, zzz: 0.12, other: 0.8 } };
    const near: CatalogDistribution = {
      catalogId: 'near', total: 20, byAttribute: { role: { other: 20 } },
      underrepresented: [
        { attribute: 'role', value: 'aaa', count: 0, expected: 2 },
        { attribute: 'role', value: 'zzz', count: 0, expected: 2 },
      ],
      sample: [], gapBasis: 'expected-share',
    };
    const r = rankCatalogGaps([near], () => shares);
    const planned = planClosure(near, shares).entities[0].assignments.find((a) => a.kind === 'gap')!;
    expect(r.targets[0].value).toBe(planned.value);
    expect(r.targets.map((t) => t.value)).toEqual(['zzz', 'aaa']);
    expect(r.targets.map((t) => t.deficit)).toEqual([2, 2]);
  });

  it('a catalog with no basis is listed as unmeasured — never ranked, never balanced', () => {
    const questsDist: CatalogDistribution = {
      catalogId: 'quests', total: 12, byAttribute: {}, underrepresented: [], sample: [],
    };
    const r = rankCatalogGaps([questsDist]);
    expect(r.targets).toEqual([]);
    expect(r.unmeasured).toEqual(['quests']);
    expect(r.balanced).toEqual([]);
  });

  it('an expected-share catalog with no rows is balanced, not unmeasured', () => {
    const r = rankCatalogGaps([{ ...itemsDist, underrepresented: [] }]);
    expect(r.balanced).toEqual(['items']);
    expect(r.unmeasured).toEqual([]);
  });
});

describe('gapTargetAction', () => {
  it('phrases the gap as the next action', () => {
    expect(gapTargetAction({ catalogId: 'items', attribute: 'rarity', value: 'Common', count: 34, expected: 57 }))
      .toBe('Add a items entity with rarity=Common (have 34, expected ~57)');
  });
});

describe('rankCatalogGaps plans (closure plan per catalog)', () => {
  it('adds plans keyed by catalogId for catalogs with targets; targets/unmeasured/balanced unchanged', () => {
    const r = rankCatalogGaps([itemsDist, bestiaryDist]);
    expect(r.plans.items.entities.length).toBeGreaterThan(0);
    expect(r.plans.items.entities.length).toBeLessThanOrEqual(r.targets.filter((t) => t.catalogId === 'items').length * 50);
    expect(r.plans.items.converged).toBe(true);
    expect(r.targets.map((t) => t.deficit)).toEqual([23, 18, 4]);
    expect(r.unmeasured).toEqual([]);
    expect(r.balanced).toEqual([]);
  });

  it('a catalog without targets has no plan', () => {
    const r = rankCatalogGaps([{ catalogId: 'quests', total: 1, byAttribute: {}, underrepresented: [], sample: [] }]);
    expect(r.plans).toEqual({});
  });
});

describe('asGapTarget — a request-body target must be a real gap', () => {
  const ok = { catalogId: 'items', attribute: 'rarity', value: 'Common', count: 34, expected: 57 };

  it('accepts a measured gap and recomputes its deficit', () => {
    expect(asGapTarget({ ...ok, deficit: 999 })).toEqual({ ...ok, deficit: 23 });
    expect(asGapTarget({ ...ok, count: 0, expected: 1 })).toEqual({ ...ok, count: 0, expected: 1, deficit: 1 });
  });

  it.each([
    ['a negative count', { ...ok, count: -3 }],
    ['a fractional count', { ...ok, count: 1.5 }],
    ['a fractional expected', { ...ok, expected: 57.2 }],
    ['no deficit (expected == count)', { ...ok, count: 57 }],
    ['a surplus (expected < count)', { ...ok, count: 80 }],
  ])('refuses %s', (_label, v) => {
    expect(asGapTarget(v)).toBeNull();
  });
});
