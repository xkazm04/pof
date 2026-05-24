import {
  COMBO_SEQUENCES,
  type ComboSequence,
} from '@/components/modules/core-engine/sub_combat/_shared/data-metrics';
import type { CombatInteractionEntry } from './types';

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
