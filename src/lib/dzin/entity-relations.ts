import type { EntitySelection } from '@/lib/dzin/selection-context';

/**
 * Static bidirectional relation map between abilities and tags.
 * Keys and values use the format `type:id`.
 */
export const ENTITY_RELATIONS: Record<string, string[]> = {
  // Abilities → related tags
  'ability:MeleeAttack': ['tag:Ability.MeleeAttack', 'tag:Damage.Physical', 'tag:Input.Attack'],
  'ability:Fireball': ['tag:Ability.Spell', 'tag:Damage.Fire', 'tag:Damage.Magical'],
  'ability:Dodge': ['tag:Ability.Dodge', 'tag:State.Invulnerable', 'tag:Input.Dodge'],
  'ability:HealOverTime': ['tag:Ability.Spell', 'tag:State.Invulnerable'],
  'ability:Shield': ['tag:Ability.Spell', 'tag:State.Invulnerable'],

  // Tags → related abilities (bidirectional)
  'tag:Ability.MeleeAttack': ['ability:MeleeAttack'],
  'tag:Ability.Dodge': ['ability:Dodge'],
  'tag:Ability.Spell': ['ability:Fireball', 'ability:HealOverTime', 'ability:Shield'],
  'tag:Damage.Physical': ['ability:MeleeAttack'],
  'tag:Damage.Fire': ['ability:Fireball'],
  'tag:Damage.Magical': ['ability:Fireball'],
  'tag:State.Invulnerable': ['ability:Dodge', 'ability:HealOverTime', 'ability:Shield'],
  'tag:State.Dead': [],
  'tag:State.Stunned': [],
  'tag:Input.Attack': ['ability:MeleeAttack'],
  'tag:Input.Dodge': ['ability:Dodge'],
  'tag:Input.Interact': [],
  'tag:Element.Fire': ['ability:Fireball'],
  'tag:Ability.Movement': ['ability:Dodge'],
};

/**
 * Check if an item is related to the current selection.
 *
 * Returns `true` (fully visible) when:
 * - No selection is active (everything visible)
 * - The item IS the selection
 * - The item appears in the selected entity's relation set
 */
export function isRelatedToSelection(
  itemType: 'ability' | 'tag',
  itemId: string,
  selection: EntitySelection | null,
  relations: Record<string, string[]> = ENTITY_RELATIONS,
): boolean {
  // No selection — everything is related
  if (!selection) return true;

  // Item is the selection itself
  if (selection.type === itemType && selection.id === itemId) return true;

  // Check relation map
  const selKey = `${selection.type}:${selection.id}`;
  const related = relations[selKey];
  if (!related) return false;

  const itemKey = `${itemType}:${itemId}`;
  return related.includes(itemKey);
}
