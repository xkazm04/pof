import type { CatalogEntityBase } from './types';
import { seedSpellbookEntries } from './seed-spellbook';
import { seedItemEntries } from './seed-items';
import { seedLootEntries } from './seed-loot';
import { seedBestiaryEntries } from './seed-bestiary';
import { seedCombatInteractionEntries } from './seed-combat-map';
import { seedScreenEntries } from './seed-screen-flow';
import { seedZoneEntries } from './seed-zone-map';
import { seedAnimationEntries } from './seed-state-graph';
import { seedMaterialEntries } from './seed-materials';

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
  { catalogId: 'bestiary', label: 'Bestiary', seed: seedBestiaryEntries },
  { catalogId: 'combat-map', label: 'Combat Map', seed: seedCombatInteractionEntries },
  { catalogId: 'screen-flow', label: 'Screen Flow', seed: seedScreenEntries },
  { catalogId: 'zone-map', label: 'Zone Map', seed: seedZoneEntries },
  { catalogId: 'state-graph', label: 'State Graph', seed: seedAnimationEntries },
  // Phase 8 substrate proof — empty seed; data lift from material-db.ts is Phase 8b.
  { catalogId: 'materials', label: 'Materials', seed: seedMaterialEntries },
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
