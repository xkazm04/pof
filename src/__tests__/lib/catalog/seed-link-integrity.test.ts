/**
 * Every cross-catalog CatalogLink a CODE seed declares must resolve to a code-seeded entity.
 *
 * Seeds link across catalogs (bestiary -> spellbook/loot-tables, characters -> bestiary /
 * dialog-trees / quests, arena slices -> bestiary). The server `CheckerContext.has()` and the
 * lab both resolve those ids against the seeds, so a renamed or deleted target turns a link into a
 * silently-broken dependency. Before this test only the arena-slice links and Captain Vael's two
 * spellbook links were pinned; the rest (e.g. Darth Malgrave's archetype / host / target links)
 * could dangle with every test green.
 */
import { describe, it, expect } from 'vitest';
import { CATALOG_SECTIONS } from '@/lib/catalog/sections';
import type { CatalogLink } from '@/lib/catalog/types';

interface Seeded { id: string; links?: CatalogLink[] }
type SeedMap = ReadonlyMap<string, readonly Seeded[]>;

function danglingLinks(seeds: SeedMap): string[] {
  const ids = new Map<string, Set<string>>();
  for (const [catalogId, entities] of seeds) ids.set(catalogId, new Set(entities.map((e) => e.id)));
  const out: string[] = [];
  for (const [catalogId, entities] of seeds) {
    for (const e of entities) {
      for (const l of e.links ?? []) {
        if (!ids.get(l.catalogId)?.has(l.entityId)) out.push(`${catalogId}/${e.id} -> ${l.catalogId}/${l.entityId} (${l.role})`);
      }
    }
  }
  return out;
}

const SEEDS: SeedMap = new Map(CATALOG_SECTIONS.map((s) => [s.catalogId, s.seed() as Seeded[]]));
const linkCount = [...SEEDS.values()].flat().reduce((n, e) => n + (e.links?.length ?? 0), 0);

describe('code seed cross-catalog links (all CATALOG_SECTIONS)', () => {
  it('the detector bites on a link to an unseeded entity and to an unregistered catalog', () => {
    const seeded = new Map(SEEDS);
    seeded.set('characters', [...(SEEDS.get('characters') ?? []), {
      id: 'char-probe',
      links: [
        { catalogId: 'bestiary', entityId: 'bestiary-no-such-archetype', role: 'archetype' },
        { catalogId: 'no-such-catalog', entityId: 'x', role: 'host' },
      ],
    }]);
    expect(danglingLinks(seeded).filter((l) => l.startsWith('characters/char-probe '))).toEqual([
      'characters/char-probe -> bestiary/bestiary-no-such-archetype (archetype)',
      'characters/char-probe -> no-such-catalog/x (host)',
    ]);
  });

  it('the seeds actually carry links (the guard is not vacuous)', () => {
    expect(linkCount).toBeGreaterThanOrEqual(30);
  });

  it('every seeded link resolves to a seeded entity of its target catalog', () => {
    expect(danglingLinks(SEEDS)).toEqual([]);
  });
});
