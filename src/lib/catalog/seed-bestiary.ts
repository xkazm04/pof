import {
  ARCHETYPES,
  type ArchetypeConfig,
} from '@/components/modules/core-engine/unique-tabs/EnemyBestiary/data';
import { DEFAULT_ENEMY_LOOT_BINDINGS } from '@/components/modules/core-engine/unique-tabs/LootTableVisualizer/data-binding';
import { seedSpellbookEntries } from './seed-spellbook';
import type { BestiaryEntry, CatalogLink } from './types';

/** Build a case-insensitive name → spellbook entry id map (computed once). */
function buildSpellbookNameIndex(): Map<string, string> {
  const map = new Map<string, string>();
  for (const e of seedSpellbookEntries()) {
    map.set(e.data.name.toLowerCase(), e.id);
  }
  return map;
}

const SPELLBOOK_BY_NAME = buildSpellbookNameIndex();

function resolveLinks(archetype: ArchetypeConfig): CatalogLink[] {
  const links: CatalogLink[] = [];
  for (const abilityName of archetype.abilities) {
    const id = SPELLBOOK_BY_NAME.get(abilityName.toLowerCase());
    if (id) links.push({ catalogId: 'spellbook', entityId: id, role: 'ability' });
  }
  // Loot binding ids are PascalCase ('Brute'); archetype ids are lowercase ('brute').
  // Case-insensitive lookup, then use the binding's id (PascalCase) to match seed-loot.ts's `lt-${binding.archetypeId}` ids.
  const lootBinding = DEFAULT_ENEMY_LOOT_BINDINGS.find(
    (b) => b.archetypeId.toLowerCase() === archetype.id.toLowerCase(),
  );
  if (lootBinding) {
    links.push({ catalogId: 'loot-tables', entityId: `lt-${lootBinding.archetypeId}`, role: 'loot' });
  }
  return links;
}

/** Convert one ArchetypeConfig into a Bestiary entry with resolved cross-catalog links. */
export function archetypeToEntry(archetype: ArchetypeConfig): BestiaryEntry {
  return {
    id: `bestiary-${archetype.id}`,
    catalogId: 'bestiary',
    name: archetype.label,
    categoryPath: ['Bestiary', archetype.tier, archetype.role],
    tags: [archetype.class, archetype.category],
    lifecycle: 'planned',
    links: resolveLinks(archetype),
    data: archetype,
  };
}

/** Seed the bestiary catalog from ARCHETYPES (DERIVED + KOTOR + EXPANDED). */
export function seedBestiaryEntries(): BestiaryEntry[] {
  return ARCHETYPES.map(archetypeToEntry);
}
