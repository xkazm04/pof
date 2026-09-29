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

// ── catalog-gap-analysis/A: world scope + coverage honesty ────────────────────────────────
// Gap analysis is the ONE owner of which world's entities count (canon profile) and of what
// an unmeasured dimension means (absent, with coverage — never "balanced").

const ent = (id: string, catalogId: string, data: Record<string, unknown>, canonProfile?: string): StoredCatalogEntity => ({
  id, catalogId, name: id, categoryPath: [], tags: [], lifecycle: 'planned', data,
  ...(canonProfile ? {
    provenance: {
      kind: 'ingest', sourceGame: 'Diablo I (1996)', sourceProject: 'devilutionx', sourceFile: 'x.tsv',
      sourceRow: id, licenceNote: 'test', ingestedAt: '2026-09-27', canonProfile,
    },
  } : {}),
} as StoredCatalogEntity);

describe('analyzeCatalog — canon-profile scope', () => {
  it('props: {profile:"pof"} counts and samples only PoF entities', () => {
    const ents = [
      ent('prop-pof', 'props', { description: 'x' }),
      ...[1, 2, 3, 4].map((i) => ent(`d1-barrel-${i}`, 'props', { kind: 'barrel' }, 'diablo1')),
    ];
    const out = analyzeCatalog('props', ents, { profile: 'pof' });
    expect(out.total).toBe(1);
    expect(out.profile).toBe('pof');
    expect(out.sample.map((s) => s.id)).toEqual(['prop-pof']);
  });

  it('spellbook: no diablo1 tier value leaks into the PoF histogram', () => {
    const ents = [
      ...[1, 2, 3].map((i) => ent(`pof-${i}`, 'spellbook', { tier: 'T1', element: 'fire', category: 'a' })),
      ...[1, 2].map((i) => ent(`d1-${i}`, 'spellbook', { tier: '5' }, 'diablo1')),
    ];
    expect(analyzeCatalog('spellbook', ents, { profile: 'pof' }).byAttribute.tier).toEqual({ T1: 3 });
  });
});

describe('analyzeCatalog — coverage, unmeasured, degenerate, gapBasis', () => {
  const quests = [1, 2, 3].map((i) => ent(`q${i}`, 'quests', { description: 'x' }));

  it('quests: declared dimensions that read 0 of 3 are reported, not dropped', () => {
    const out = analyzeCatalog('quests', quests);
    expect(out.coverage).toEqual({ status: { covered: 0, of: 3 }, area: { covered: 0, of: 3 } });
    expect(out.unmeasured).toEqual(['status', 'area']);
    expect(out.byAttribute).toEqual({});
  });

  it('gapBasis is "none" without an expected share and "expected-share" with one', () => {
    expect(analyzeCatalog('quests', quests).gapBasis).toBe('none');
    const rar = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'];
    const typ = ['Weapon', 'Armor'];
    const items = Array.from({ length: 10 }, (_, i) => ent(`i${i}`, 'items', { rarity: rar[i % 5], type: typ[i % 2] }));
    expect(analyzeCatalog('items', items).gapBasis).toBe('expected-share');
  });

  it('combat-map: a per-entity-unique dimension is degenerate, not a histogram', () => {
    const ents = [1, 2, 3, 4, 5, 6].map((i) => ent(`cm${i}`, 'combat-map', { name: `Node ${i}` }));
    const out = analyzeCatalog('combat-map', ents);
    expect(out.degenerate).toContain('name');
    expect(out.byAttribute).not.toHaveProperty('name');
  });
});
