import {
  COMBO_SEQUENCES,
  type ComboSequence,
} from '@/components/modules/core-engine/sub_combat/_shared/data-metrics';
import type { CombatInteractionEntry, ArenaSliceEntry } from './types';
import { ARENA_SLICES, type ArenaSliceSpec } from './arena-slice';

/** Convert one ComboSequence into a Combat Map entry. */
export function comboToEntry(combo: ComboSequence): CombatInteractionEntry {
  return {
    id: `combo-${combo.id}`,
    catalogId: 'combat-map',
    name: combo.name,
    categoryPath: ['Combat Map', combo.weaponCategory],
    tags: [combo.weaponCategory],
    lifecycle: 'planned',
    data: combo,
  };
}

/** Seed the combat-map catalog from COMBO_SEQUENCES. */
export function seedCombatInteractionEntries(): CombatInteractionEntry[] {
  return COMBO_SEQUENCES.map(comboToEntry);
}

/** Convert one Arena Slice spec into a Combat Map entry, wiring its waves'
 *  enemy archetypes as cross-catalog `bestiary` links. */
export function arenaSliceToEntry(spec: ArenaSliceSpec): ArenaSliceEntry {
  const archetypes = [...new Set(spec.waves.map((w) => w.enemyArchetype))];
  return {
    id: `arena-${spec.id}`,
    catalogId: 'combat-map',
    name: spec.name,
    categoryPath: ['Combat Map', 'Arenas'],
    tags: ['arena', spec.position],
    lifecycle: 'planned',
    links: archetypes.map((a) => ({ catalogId: 'bestiary', entityId: `bestiary-${a}`, role: 'spawn' })),
    data: spec,
  };
}

/** Seed the tactical-arena entities of the combat-map catalog. */
export function seedArenaSliceEntries(): ArenaSliceEntry[] {
  return ARENA_SLICES.map(arenaSliceToEntry);
}
