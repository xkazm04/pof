// @vitest-environment node
/**
 * catalog-gap-analysis/B — a closure plan says how many NEW entities balance a catalog, because
 * one entity fills a bucket in every dimension at once. Replayed through the analyzer's own
 * isUnderrepresented rule, the plan must leave nothing under-represented.
 */
import { describe, it, expect } from 'vitest';
import { planClosure, MAX_ENTITIES, type ClosurePlan } from '@/lib/catalog/gap-analysis/closurePlan';
import { isUnderrepresented, type CatalogDistribution } from '@/lib/catalog/gap-analysis';

const shares = {
  rarity: { Epic: 0.2, Common: 0.8 },
  type: { Armor: 0.2, Weapon: 0.8 },
};

function dist(over: Partial<CatalogDistribution> = {}): CatalogDistribution {
  return {
    catalogId: 'items', total: 10,
    byAttribute: { rarity: { Epic: 0, Common: 10 }, type: { Armor: 0, Weapon: 10 } },
    underrepresented: [
      { attribute: 'rarity', value: 'Epic', count: 0, expected: 2 },
      { attribute: 'type', value: 'Armor', count: 0, expected: 2 },
    ],
    sample: [], gapBasis: 'expected-share',
    ...over,
  };
}

/** Apply the plan to the histograms and count rows the analyzer would still flag. */
function remaining(d: CatalogDistribution, plan: ClosurePlan): number {
  const h: Record<string, Record<string, number>> = JSON.parse(JSON.stringify(d.byAttribute));
  for (const e of plan.entities) for (const a of e.assignments) h[a.attribute][a.value] = (h[a.attribute][a.value] ?? 0) + 1;
  let n = 0;
  for (const [attr, sh] of Object.entries(shares)) {
    const total = Object.values(h[attr]).reduce((a, b) => a + b, 0);
    for (const [v, s] of Object.entries(sh)) if (isUnderrepresented(h[attr][v] ?? 0, s, total)) n++;
  }
  return n;
}

describe('planClosure', () => {
  it('gaps in different dimensions share an entity: 2 entities, not 4', () => {
    const plan = planClosure(dist(), shares);
    expect(plan.entities).toHaveLength(2);
    for (const e of plan.entities) {
      expect(e.assignments.map((a) => a.attribute).sort()).toEqual(['rarity', 'type']);
      expect(e.assignments.filter((a) => a.kind === 'gap')).toHaveLength(2);
    }
    expect(plan.converged).toBe(true);
    expect(plan.basis).toBe('expected-share');
  });

  it('replayed through isUnderrepresented leaves zero under-represented rows', () => {
    const d = dist();
    const plan = planClosure(d, shares);
    expect(remaining(d, plan)).toBe(0);
    expect(plan.converged).toBe(true);
  });

  it('no gaps -> empty converged plan', () => {
    const d = dist({ byAttribute: { rarity: { Epic: 2, Common: 8 }, type: { Armor: 2, Weapon: 8 } }, underrepresented: [] });
    expect(planClosure(d, shares)).toEqual({ entities: [], converged: true, basis: 'expected-share' });
  });

  it("gapBasis 'none' -> no plan is invented", () => {
    const d = dist({ gapBasis: 'none', underrepresented: [] });
    expect(planClosure(d, shares)).toEqual({ entities: [], converged: true, basis: 'none' });
  });

  it('an unreachable share stops at MAX_ENTITIES with converged:false', () => {
    // Shares sum to 1.6: both buckets can never be satisfied together.
    const impossible = { rarity: { Epic: 0.8, Common: 0.8 } };
    const d = dist({
      byAttribute: { rarity: { Epic: 0, Common: 0 } }, total: 0,
      underrepresented: [{ attribute: 'rarity', value: 'Epic', count: 0, expected: 8 }],
    });
    const plan = planClosure(d, impossible);
    // Starting from nothing every entity can fill only one bucket; the cap bounds the loop.
    expect(plan.entities.length).toBeLessThanOrEqual(MAX_ENTITIES);
    const big = planClosure(dist({
      byAttribute: { rarity: { Epic: 0, Common: 1000 } }, total: 1000,
      underrepresented: [{ attribute: 'rarity', value: 'Epic', count: 0, expected: 200 }],
    }), { rarity: { Epic: 0.2, Common: 0.8 } });
    expect(big.entities).toHaveLength(MAX_ENTITIES);
    expect(big.converged).toBe(false);
  });

  it('is deterministic: dimension and gap order shuffled -> identical plan', () => {
    const a = planClosure(dist(), shares);
    const d = dist();
    const shuffled = dist({
      byAttribute: { type: d.byAttribute.type, rarity: d.byAttribute.rarity },
      underrepresented: [...d.underrepresented].reverse(),
    });
    const sh = { type: { Weapon: 0.8, Armor: 0.2 }, rarity: { Common: 0.8, Epic: 0.2 } };
    expect(JSON.stringify(planClosure(shuffled, sh))).toBe(JSON.stringify(a));
  });

  it('addresses the largest deficit first within a dimension', () => {
    const s = { rarity: { A: 0.4, B: 0.2, C: 0.4 } };
    const d = dist({
      byAttribute: { rarity: { A: 0, B: 0, C: 10 } }, total: 10,
      underrepresented: [{ attribute: 'rarity', value: 'A', count: 0, expected: 4 }, { attribute: 'rarity', value: 'B', count: 0, expected: 2 }],
    });
    const plan = planClosure(d, s);
    expect(plan.entities[0].assignments[0]).toMatchObject({ attribute: 'rarity', value: 'A', kind: 'gap' });
  });
});
