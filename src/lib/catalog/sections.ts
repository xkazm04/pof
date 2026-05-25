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
import { seedAudioEntries } from './seed-audio';
import { seedAnimationAssetEntries } from './seed-animation-assets';
import { NEW_CATALOGS, newCatalogStarters } from './new-catalogs';

/** A catalog section: its id, label, spreadsheet category (for grouping), and seed. */
export interface CatalogSection {
  catalogId: string;
  label: string;
  /** Spreadsheet category for grouping (Live State, hub). */
  category?: string;
  /** One-line description of the entity type. */
  description?: string;
  seed: () => CatalogEntityBase[];
}

export const CATALOG_SECTIONS: CatalogSection[] = [
  { catalogId: 'spellbook', label: 'Spellbook', category: 'Game Assets', description: 'Active/passive abilities used by characters and enemies.', seed: seedSpellbookEntries },
  { catalogId: 'items', label: 'Items', category: 'Core / Existing', description: 'Equippable, consumable, or quest items.', seed: seedItemEntries },
  { catalogId: 'loot-tables', label: 'Loot Tables', category: 'Core / Existing', description: 'Drop distributions for enemies, containers, quests, vendors.', seed: seedLootEntries },
  { catalogId: 'bestiary', label: 'Bestiary', category: 'Core / Existing', description: 'Creature/NPC archetypes with stats, AI, and presentation.', seed: seedBestiaryEntries },
  { catalogId: 'combat-map', label: 'Combat Map', category: 'Core / Existing', description: 'Tactical encounter arenas with rules and spawn logic.', seed: seedCombatInteractionEntries },
  { catalogId: 'screen-flow', label: 'Screen Flow', category: 'Core / Existing', description: 'UI navigation graph between screens/menus.', seed: seedScreenEntries },
  { catalogId: 'zone-map', label: 'Zone Map', category: 'Core / Existing', description: 'Explorable regions with POIs, navigation, ambient systems.', seed: seedZoneEntries },
  { catalogId: 'state-graph', label: 'State Graph', category: 'Core / Existing', description: 'Generic finite state machines used across systems.', seed: seedAnimationEntries },
  // Phase 8 / 8b substrate proofs — empty seeds; data lift in Phase 10.
  { catalogId: 'materials', label: 'Materials', category: 'Core / Existing', description: 'Shader/material definitions with parameters and variants.', seed: seedMaterialEntries },
  { catalogId: 'audio', label: 'Audio', category: 'Audio & FX', description: 'SFX sets imported into UE.', seed: seedAudioEntries },
  { catalogId: 'animation-assets', label: 'Animation Assets', category: 'Core / Existing', description: 'Imported/retargeted animation assets.', seed: seedAnimationAssetEntries },
  // Catalog Pipeline Expansion — the 21 new catalogs, derived from NEW_CATALOGS.
  ...NEW_CATALOGS.map((c) => ({
    catalogId: c.catalogId, label: c.label, category: c.category, description: c.description,
    seed: () => newCatalogStarters(c),
  })),
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
