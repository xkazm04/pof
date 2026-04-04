import type { EntitySelection, EntityType } from '@/lib/dzin/selection-context';

/**
 * Static bidirectional relation map between entities.
 * Keys and values use the format `type:id`.
 */
export const ENTITY_RELATIONS: Record<string, string[]> = {
  /* ── Abilities ↔ Tags ───────────────────────────────────────────────── */
  'ability:MeleeAttack': ['tag:Ability.MeleeAttack', 'tag:Damage.Physical', 'tag:Input.Attack', 'attribute:Strength', 'attribute:AttackPower'],
  'ability:Fireball': ['tag:Ability.Spell', 'tag:Damage.Fire', 'tag:Damage.Magical', 'attribute:Intelligence', 'attribute:SpellPower'],
  'ability:Dodge': ['tag:Ability.Dodge', 'tag:State.Invulnerable', 'tag:Input.Dodge', 'attribute:Agility'],
  'ability:HealOverTime': ['tag:Ability.Spell', 'tag:State.Invulnerable', 'attribute:Intelligence'],
  'ability:Shield': ['tag:Ability.Spell', 'tag:State.Invulnerable', 'attribute:Vitality'],

  'tag:Ability.MeleeAttack': ['ability:MeleeAttack'],
  'tag:Ability.Dodge': ['ability:Dodge'],
  'tag:Ability.Spell': ['ability:Fireball', 'ability:HealOverTime', 'ability:Shield'],
  'tag:Damage.Physical': ['ability:MeleeAttack', 'item:IronSword', 'item:WarAxe'],
  'tag:Damage.Fire': ['ability:Fireball', 'item:FlameStaff'],
  'tag:Damage.Magical': ['ability:Fireball'],
  'tag:State.Invulnerable': ['ability:Dodge', 'ability:HealOverTime', 'ability:Shield'],
  'tag:State.Dead': [],
  'tag:State.Stunned': [],
  'tag:Input.Attack': ['ability:MeleeAttack'],
  'tag:Input.Dodge': ['ability:Dodge'],
  'tag:Input.Interact': [],
  'tag:Element.Fire': ['ability:Fireball', 'item:FlameStaff', 'enemy:FireElemental'],
  'tag:Ability.Movement': ['ability:Dodge'],

  /* ── Items ↔ Tags/Attributes ────────────────────────────────────────── */
  'item:IronSword': ['tag:Damage.Physical', 'attribute:Strength', 'attribute:AttackPower'],
  'item:WarAxe': ['tag:Damage.Physical', 'attribute:Strength'],
  'item:FlameStaff': ['tag:Damage.Fire', 'tag:Element.Fire', 'attribute:Intelligence', 'attribute:SpellPower'],
  'item:PlateArmor': ['attribute:Vitality', 'attribute:Armor'],
  'item:LeatherBoots': ['attribute:Agility'],

  /* ── Enemies ↔ Zones/Items/Abilities ────────────────────────────────── */
  'enemy:Skeleton': ['zone:Catacombs', 'item:IronSword', 'ability:MeleeAttack'],
  'enemy:FireElemental': ['zone:VolcanicRift', 'tag:Element.Fire', 'ability:Fireball'],
  'enemy:ForestSpider': ['zone:WhisperWoods'],
  'enemy:StoneGolem': ['zone:AncientRuins', 'attribute:Armor'],
  'enemy:DarkSorcerer': ['zone:ShadowCitadel', 'ability:Fireball', 'ability:Shield'],

  /* ── Zones ↔ Enemies ────────────────────────────────────────────────── */
  'zone:WhisperWoods': ['enemy:ForestSpider'],
  'zone:Catacombs': ['enemy:Skeleton'],
  'zone:VolcanicRift': ['enemy:FireElemental'],
  'zone:AncientRuins': ['enemy:StoneGolem'],
  'zone:ShadowCitadel': ['enemy:DarkSorcerer'],

  /* ── Attributes ↔ Abilities/Items ───────────────────────────────────── */
  'attribute:Strength': ['ability:MeleeAttack', 'item:IronSword', 'item:WarAxe'],
  'attribute:Intelligence': ['ability:Fireball', 'ability:HealOverTime', 'item:FlameStaff'],
  'attribute:Agility': ['ability:Dodge', 'item:LeatherBoots'],
  'attribute:Vitality': ['ability:Shield', 'item:PlateArmor'],
  'attribute:AttackPower': ['ability:MeleeAttack', 'item:IronSword'],
  'attribute:SpellPower': ['ability:Fireball', 'item:FlameStaff'],
  'attribute:Armor': ['item:PlateArmor', 'enemy:StoneGolem'],
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
  itemType: EntityType,
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
