// @vitest-environment node
/**
 * Envelope facets as fallback dimensions: a stale plugin (generic starters carry only
 * `{ description }`) must still produce a histogram, healthy catalogs must not change.
 */
import { describe, it, expect } from 'vitest';
import { readEntityPath } from '@/lib/catalog/gap-analysis/facets';
import { aggregateByAttr, analyzeCatalog } from '@/lib/catalog/gap-analysis';
import { proposalLanding } from '@/lib/catalog/gap-analysis/landing';
import { unmeasuredDimensions } from '@/lib/catalog/gap-analysis/coverage';
import { codeSeededEntities } from '@/lib/catalog/seed';
import type { StoredCatalogEntity } from '@/lib/catalog/types';

const mk = (
  id: string, catalogId: string, data: Record<string, unknown>,
  lifecycle: string = 'planned', categoryPath: string[] = [],
): StoredCatalogEntity => ({ id, catalogId, name: id, categoryPath, tags: [], lifecycle, data }) as unknown as StoredCatalogEntity;

describe('readEntityPath', () => {
  it('reads envelope facets and data paths', () => {
    const ent = mk('a', 'items', { rarity: 'Rare' }, 'wired', ['Offensive', 'Fire']);
    expect(readEntityPath(ent, '@lifecycle')).toBe('wired');
    expect(readEntityPath(ent, '@category')).toBe('Offensive');
    expect(readEntityPath(ent, 'rarity')).toBe('Rare');
    expect(readEntityPath(mk('b', 'items', {}), '@category')).toBeUndefined();
  });
});

describe('aggregateByAttr with facets', () => {
  it('counts lifecycle; data paths unchanged [guard]', () => {
    const ents = [
      mk('a', 'items', { rarity: 'Rare' }), mk('b', 'items', { rarity: 'Rare' }),
      mk('c', 'items', { rarity: 'Common' }), mk('d', 'items', {}, 'wired'),
    ];
    expect(aggregateByAttr(ents, '@lifecycle')).toEqual({ planned: 3, wired: 1 });
    expect(aggregateByAttr(ents, 'rarity')).toEqual({ Rare: 2, Common: 1 });
  });
});

describe('analyzeCatalog facet fallback', () => {
  const starters = [
    mk('q1', 'quests', { description: 'x' }, 'planned', ['Main']),
    mk('q2', 'quests', { description: 'y' }, 'planned', ['Side']),
    mk('q3', 'quests', { description: 'z' }, 'planned', ['Side']),
  ];

  it('a stale plugin gets @lifecycle and @category, declared dims stay unmeasured', () => {
    const out = analyzeCatalog('quests', starters);
    expect(out.byAttribute['@lifecycle']).toEqual({ planned: 3 });
    expect(out.byAttribute['@category']).toEqual({ Main: 1, Side: 2 });
    expect(out.coverage['@lifecycle']).toEqual({ covered: 3, of: 3 });
    expect(out.unmeasured).toEqual(expect.arrayContaining(['status', 'area']));
    expect(out.unmeasured.some((u) => u.startsWith('@'))).toBe(false);
    expect(out.sample.length).toBeGreaterThan(0);
  });

  it('facets never invent gaps: no underrepresented rows, gapBasis none', () => {
    const out = analyzeCatalog('quests', starters);
    expect(out.underrepresented).toEqual([]);
    expect(out.gapBasis).toBe('none');
  });

  it('healthy catalog keeps exactly its declared dimensions [guard]', () => {
    const items = [
      mk('i1', 'items', { rarity: 'Common', type: 'Weapon' }), mk('i2', 'items', { rarity: 'Rare', type: 'Armor' }),
    ];
    const out = analyzeCatalog('items', items);
    expect(Object.keys(out.byAttribute).filter((k) => k.startsWith('@'))).toEqual([]);
    expect(Object.keys(out.byAttribute).length).toBeGreaterThan(0);
  });

  it('no plugin and data without usable keys falls back to facets', () => {
    const out = analyzeCatalog('no-such-catalog', [mk('n1', 'no-such-catalog', {}), mk('n2', 'no-such-catalog', {})]);
    expect(out.byAttribute['@lifecycle']).toEqual({ planned: 2 });
  });
});

describe('proposalLanding and the ratchet', () => {
  it('skips @ dimensions but lands data dimensions', () => {
    const d = analyzeCatalog('quests', [mk('q1', 'quests', { description: 'x' })]);
    const l = proposalLanding(d, { description: 'p', status: 'open' }, null);
    expect(Object.keys(l.dimensions).some((k) => k.startsWith('@'))).toBe(false);
    const healthy = analyzeCatalog('items', [mk('i1', 'items', { rarity: 'Common' })]);
    expect(proposalLanding(healthy, { rarity: 'Common' }, null).dimensions.rarity).toBeDefined();
  });

  it('unmeasuredDimensions stays on declared dimensions only', () => {
    const seed = codeSeededEntities('quests');
    expect(unmeasuredDimensions('quests', seed).length).toBeGreaterThan(0);
    expect(unmeasuredDimensions('quests', seed).some((u) => u.startsWith('@'))).toBe(false);
  });
});
