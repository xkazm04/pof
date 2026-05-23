import {
  SPELLBOOK_ABILITIES,
  type SpellbookAbility,
} from '@/components/modules/core-engine/unique-tabs/AbilitySpellbook/data';
import type { AbilityEntry } from './types';

/** Convert one static SpellbookAbility into a catalog AbilityEntry. */
export function abilityToEntry(a: SpellbookAbility): AbilityEntry {
  return {
    id: a.id,
    catalogId: 'spellbook',
    name: a.name,
    categoryPath: [a.category, a.element],
    tags: [a.tier],
    lifecycle: 'planned',
    data: a,
  };
}

/** Seed the spellbook catalog from the existing static ability list. */
export function seedSpellbookEntries(): AbilityEntry[] {
  return SPELLBOOK_ABILITIES.map(abilityToEntry);
}
