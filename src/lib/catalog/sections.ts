import type { CatalogEntityBase } from './types';
import { seedSpellbookEntries } from './seed-spellbook';
import { seedItemEntries } from './seed-items';
import { seedLootEntries } from './seed-loot';

/** A Core Engine catalog section: its id, label, and how to seed it. */
export interface CatalogSection {
  catalogId: string;
  label: string;
  seed: () => CatalogEntityBase[];
}

export const CATALOG_SECTIONS: CatalogSection[] = [
  { catalogId: 'spellbook', label: 'Spellbook', seed: seedSpellbookEntries },
  { catalogId: 'items', label: 'Items', seed: seedItemEntries },
  { catalogId: 'loot-tables', label: 'Loot Tables', seed: seedLootEntries },
];

function indexById(entities: CatalogEntityBase[]): Record<string, CatalogEntityBase> {
  const map: Record<string, CatalogEntityBase> = {};
  for (const e of entities) map[e.id] = e;
  return map;
}

/** Seed every registered catalog: { [catalogId]: { [entityId]: entity } }. */
export function seedAllCatalogs(): Record<string, Record<string, CatalogEntityBase>> {
  const out: Record<string, Record<string, CatalogEntityBase>> = {};
  for (const s of CATALOG_SECTIONS) out[s.catalogId] = indexById(s.seed());
  return out;
}
