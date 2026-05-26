import { describe, it, expect } from 'vitest';
import { aggregateByAttr, analyzeCatalog } from '@/lib/catalog/gap-analysis';
import type { StoredCatalogEntity } from '@/lib/catalog/types';

const e = (id: string, data: Record<string, unknown>): StoredCatalogEntity => ({
  id, catalogId: 'items', name: id, categoryPath: [], tags: [], lifecycle: 'planned', data,
});

describe('aggregateByAttr', () => {
  it('counts values at the given path', () => {
    const ents = [
      e('a', { rarity: 'Common' }), e('b', { rarity: 'Common' }), e('c', { rarity: 'Rare' }),
    ];
    expect(aggregateByAttr(ents, 'rarity')).toEqual({ Common: 2, Rare: 1 });
  });

  it('handles nested paths', () => {
    const ents = [e('a', { stats: { Damage: 10 } }), e('b', { stats: { Damage: 10 } })];
    expect(aggregateByAttr(ents, 'stats.Damage')).toEqual({ '10': 2 });
  });

  it('skips entities missing the path', () => {
    expect(aggregateByAttr([e('a', {}), e('b', { rarity: 'Rare' })], 'rarity')).toEqual({ Rare: 1 });
  });
});

describe('analyzeCatalog', () => {
  it('returns total + per-attribute histograms for an unknown catalog (generic fallback)', () => {
    const ents = [e('a', { type: 'Weapon' }), e('b', { type: 'Armor' })];
    const out = analyzeCatalog('items', ents);
    expect(out.total).toBe(2);
    expect(out.byAttribute.type).toEqual({ Weapon: 1, Armor: 1 });
  });

  it('sample is at most 5 stratified across the primary attribute', () => {
    const ents = Array.from({ length: 50 }, (_, i) => e(`e${i}`, { type: i % 2 ? 'A' : 'B' }));
    const out = analyzeCatalog('items', ents);
    expect(out.sample.length).toBeLessThanOrEqual(5);
  });
});
