/**
 * pipeline-step-components/B — where a one-shot proposal lands before 'Run pipeline'.
 * Per measured dimension: before/after count of the proposal's bucket (the histogram's own key
 * rule), whether it opens a new bucket or closes an under-represented gap (the ANALYZER's rule,
 * re-applied at got+1 / total+1 — not the rounded `expected`), and the target verdict.
 */
import { describe, it, expect } from 'vitest';
import { analyzeCatalog, isUnderrepresented, type CatalogDistribution } from '@/lib/catalog/gap-analysis';
import { proposalLanding, refineToTargetDirection } from '@/lib/catalog/gap-analysis/landing';
import type { StoredCatalogEntity } from '@/lib/catalog/types';

const T = { catalogId: 'items', attribute: 'rarity', value: 'Rare', count: 2, expected: 4, deficit: 2 };
const SHARE = { rarity: { Common: 0.4, Rare: 0.4, Uncommon: 0.2 } };

function dist(patch: Partial<CatalogDistribution> = {}): CatalogDistribution {
  return {
    catalogId: 'items',
    total: 10,
    byAttribute: { rarity: { Common: 6, Rare: 2, Uncommon: 2 }, type: { Weapon: 10 } },
    underrepresented: [{ attribute: 'rarity', value: 'Rare', count: 2, expected: 4 }],
    sample: [],
    ...patch,
  };
}

describe('proposalLanding', () => {
  it('case 1: on target — the proposal fills the gap bucket and closes it; other dimensions land with no gap', () => {
    const l = proposalLanding(dist(), { rarity: 'Rare', type: 'Weapon' }, T, SHARE);
    expect(l.dimensions.rarity).toMatchObject({ state: 'lands', value: 'Rare', before: 2, after: 3, newBucket: false, gap: { expected: 4, closes: true } });
    expect(l.dimensions.type).toMatchObject({ state: 'lands', value: 'Weapon', before: 10, after: 11, gap: null });
    expect(l.target.state).toBe('on');
  });

  it('case 2: off target — want vs got, and a derived refine direction naming both', () => {
    const l = proposalLanding(dist(), { rarity: 'Common', type: 'Weapon' }, T, SHARE);
    expect(l.target).toEqual({ state: 'off', attribute: 'rarity', want: 'Rare', got: 'Common' });
    const dir = refineToTargetDirection(l);
    expect(typeof dir).toBe('string');
    expect(dir).toContain('rarity');
    expect(dir).toContain('Rare');
    expect(dir).toContain('Common');
  });

  it('case 3: a proposal that carries no value for a dimension is missing there — counted in no bucket', () => {
    const l = proposalLanding(dist(), { type: 'Weapon' }, T, SHARE);
    expect(l.dimensions.rarity.state).toBe('missing');
    expect(l.dimensions.rarity.buckets.length).toBeGreaterThan(0);
    for (const b of l.dimensions.rarity.buckets) expect(b.after).toBe(b.before);
    expect(l.target.state).toBe('missing');
    expect(refineToTargetDirection(l)).toContain('Rare');
  });

  it("case 4: numeric values key like aggregateByAttr (String(v)); nested dimensions read through readPath", () => {
    const d = dist({ byAttribute: { tier: { '3': 4 }, 'stats.class': { Mage: 3 } }, underrepresented: [] });
    const l = proposalLanding(d, { tier: 3, stats: { class: 'Mage' } }, null, {});
    expect(l.dimensions.tier).toMatchObject({ state: 'lands', value: '3', before: 4, after: 5 });
    expect(l.dimensions['stats.class']).toMatchObject({ state: 'lands', value: 'Mage', before: 3, after: 4 });
  });

  it('case 5: gap closure is the analyzer rule at total+1, not the rounded expected (share .15 of 10, count 0 -> closes)', () => {
    const d = dist({ underrepresented: [{ attribute: 'rarity', value: 'Legendary', count: 0, expected: 2 }] });
    const l = proposalLanding(d, { rarity: 'Legendary' }, null, { rarity: { Legendary: 0.15 } });
    // rounded-expected rule would say 1 < 2 × 0.6 → not closed; the analyzer's want is 0.15 × 11 = 1.65.
    expect(l.dimensions.rarity).toMatchObject({ before: 0, after: 1, newBucket: true, gap: { expected: 2, closes: true } });
    expect(isUnderrepresented(0, 0.15, 10)).toBe(true);
    expect(isUnderrepresented(1, 0.15, 11)).toBe(false);
  });

  it('case 6: no target — target none, and every measured dimension still reports its landing', () => {
    const l = proposalLanding(dist(), { rarity: 'Common', type: 'Weapon' }, null, SHARE);
    expect(l.target.state).toBe('none');
    expect(Object.keys(l.dimensions).sort()).toEqual(['rarity', 'type']);
    expect(l.dimensions.rarity).toMatchObject({ before: 6, after: 7, gap: null });
    expect(refineToTargetDirection(l)).toBeNull();
  });

  it('case 5b: landing agrees with re-running analyzeCatalog on entities + the proposal (items plugin shares)', () => {
    // 30 entities: Common 20, Uncommon 9, Rare 1 → gaps Rare, Epic (stay open at +1) and Legendary (closes at +1).
    const rarities = [...Array(20).fill('Common'), ...Array(9).fill('Uncommon'), 'Rare'] as string[];
    const entities = rarities.map((rarity, i) => ({ id: `e${i}`, data: { rarity, type: 'Weapon' } }) as unknown as StoredCatalogEntity);
    const before = analyzeCatalog('items', entities);
    const gaps = before.underrepresented.filter((u) => u.attribute === 'rarity');
    const verdicts = new Set<boolean>();
    for (const g of gaps) {
      const proposal = { rarity: g.value, type: 'Weapon' };
      const l = proposalLanding(before, proposal, null);
      const after = analyzeCatalog('items', [...entities, { id: 'p', data: proposal } as unknown as StoredCatalogEntity]);
      const stillGap = after.underrepresented.some((u) => u.attribute === 'rarity' && u.value === g.value);
      expect(l.dimensions.rarity.gap?.closes).toBe(!stillGap);
      verdicts.add(!stillGap);
    }
    expect([...verdicts].sort()).toEqual([false, true]);
  });
});
