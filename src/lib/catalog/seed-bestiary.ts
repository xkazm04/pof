import {
  ARCHETYPES,
  type ArchetypeConfig,
} from '@/components/modules/core-engine/sub_bestiary/_shared/data';
import { lootTableIdForArchetype } from '@/lib/loot/enemy-loot-join';
import { spellbookIdForName } from './seed-spellbook';
import type { BestiaryEntry, CatalogLink } from './types';

function resolveLinks(archetype: ArchetypeConfig): CatalogLink[] {
  const links: CatalogLink[] = [];
  for (const abilityName of archetype.abilities) {
    const id = spellbookIdForName(abilityName);
    if (id) links.push({ catalogId: 'spellbook', entityId: id, role: 'ability' });
  }
  // One normalised join ('melee-grunt' → 'lt-MeleeGrunt'); null when no loot table is bound.
  const lootTableId = lootTableIdForArchetype(archetype.id);
  if (lootTableId) links.push({ catalogId: 'loot-tables', entityId: lootTableId, role: 'loot' });
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
