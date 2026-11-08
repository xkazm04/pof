import {
  SPELLBOOK_ABILITIES,
  type SpellbookAbility,
} from '@/components/modules/core-engine/sub_ability/_shared/data';
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

let byName: Map<string, string> | null = null;

/**
 * The ONE ability-name → spellbook id resolver (case-insensitive) every seed that links to the
 * spellbook uses — bestiary and characters each kept their own copy of this index before.
 * `undefined` when no spellbook entry carries the name; callers drop the link rather than fake one.
 */
export function spellbookIdForName(name: string): string | undefined {
  byName ??= new Map(seedSpellbookEntries().map((e) => [e.data.name.toLowerCase(), e.id]));
  return byName.get(name.toLowerCase());
}
