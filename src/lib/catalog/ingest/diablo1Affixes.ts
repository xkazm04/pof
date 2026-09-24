/**
 * Diablo I (1996) affix tables → PoF's `affixes` catalog (/diablo W11, D1). MAPPING and VOCABULARY only — never values.
 *
 * `items/item_prefixes.tsv` and `items/item_suffixes.tsv` share one header. A row is ONE TIER of an affix family: its
 * `power` names the family (TOHIT, STR, FIRERES…), `power.value1..2` the tier's range and `minLevel` the item level that
 * unlocks it — the registry's item-level-gated tiers, already. PoF's design unit is the FAMILY with its tiers, so rows are
 * aggregated per (power, side) at promotion; the prefix/suffix side is the TABLE a row comes from, not a column.
 */
import { dropped, gap, mapped, type FieldMap } from './fieldMap';
import { split } from './decode';
import type { ConversionGrade } from '@/lib/catalog/reference/playerScale';

export const AFFIX_MAP: FieldMap = {
  name: mapped('name'),
  power: mapped('data.power'),
  'power.value1': mapped('data.valueMin'),
  'power.value2': mapped('data.valueMax'),
  // The tier's item-level gate (FAffixTableRow.MinItemLevel — W11).
  minLevel: mapped('data.minItemLevel'),
  // Which item kinds the tier may roll on — the affixes catalog's Spawn Rules.
  itemTypes: mapped('data.itemTypes[]', split(',')),
  // Any / Good / Evil: an Evil affix is a CURSE (a *_CURSE power, a negative value).
  alignment: mapped('data.alignment'),
  // The tier's relative spawn weight (FAffixTableRow.Weight).
  chance: mapped('data.weight'),
  useful: dropped('a shop-generation hint (whether the vendor AI treats the roll as desirable), not a property of the affix'),
  minVal: gap('the affix\'s contribution to an item\'s gold VALUE — PoF prices items in its Economy step, with no per-affix value term'),
  maxVal: gap('see minVal — the upper bound of the value contribution'),
  multVal: gap('see minVal — the value multiplier an affix applies'),
};

const A = 'UARPGAttributeSet.';
const RES = [`${A}FireResistance`, `${A}LightningResistance`, `${A}MagicResistance`];
const ATTRS = [`${A}Strength`, `${A}Dexterity`, `${A}Intelligence`];

interface PowerTarget { targets: string[]; grade: ConversionGrade; reason: string }
const to = (targets: string[], grade: ConversionGrade, reason: string): PowerTarget => ({ targets, grade, reason });
const none = (reason: string): PowerTarget => ({ targets: [], grade: 'dropped', reason });

/** Every power the Diablo affix tables use → the PoF attribute(s) it modifies, graded (lossy-conversion-disclosure). */
export const AFFIX_POWERS: Record<string, PowerTarget> = {
  STR: to([`${A}Strength`], 'full', 'flat Strength'),
  DEX: to([`${A}Dexterity`], 'full', 'flat Dexterity'),
  MAG: to([`${A}Intelligence`], 'approximate', 'Diablo\'s Magic read as PoF\'s Intelligence'),
  ATTRIBS: to(ATTRS, 'approximate', 'all attributes; PoF has no Vitality, so three of Diablo\'s four'),
  LIFE: to([`${A}MaxHealth`], 'full', 'flat maximum life'),
  MANA: to([`${A}MaxMana`], 'full', 'flat maximum mana'),
  FIRERES: to([`${A}FireResistance`], 'full', 'fire resistance'),
  LIGHTRES: to([`${A}LightningResistance`], 'full', 'lightning resistance'),
  MAGICRES: to([`${A}MagicResistance`], 'full', 'magic resistance'),
  ALLRES: to(RES, 'full', 'every Diablo element (fire, lightning, magic)'),
  ACP: to([`${A}Armor`], 'approximate', 'Diablo raises the ITEM\'s armour by a percent; PoF Armor is a flat attribute'),
  DAMP: to([`${A}AttackPower`], 'approximate', 'Diablo raises the WEAPON\'s damage by a percent; PoF adds AttackPower flat per hit'),
  DAMMOD: to([`${A}AttackPower`], 'full', 'flat added damage per hit'),
  TOHIT_DAMP: to([`${A}AttackPower`], 'approximate', 'the damage half only — PoF has no to-hit roll'),
  DUR: to(['UARPGItemDefinition.MaxDurability'], 'approximate', 'the ITEM\'s durability by a percent — an item property, not an attribute'),
  INDESTRUCTIBLE: to(['UARPGItemDefinition.MaxDurability'], 'full', 'durability 0 = indestructible'),
  VIT: none('PoF has no Vitality attribute (its life effect is LIFE\'s)'),
  TOHIT: none('PoF melee always lands — there is no to-hit roll to raise'),
  GETHIT: none('no flat damage-taken reduction attribute'),
  FASTATTACK: none('no attack-speed attribute (swing speed is per class in Diablo, per weapon in PoF)'),
  FASTRECOVER: none('no hit-recovery attribute'),
  FASTBLOCK: none('no block-speed attribute'),
  TARGAC: none('no "reduce the target\'s armour" effect'),
  STEALLIFE: none('no life-leech effect'),
  STEALMANA: none('no mana-leech effect'),
  THORNS: none('no damage-reflection effect'),
  LIGHT: none('no light-radius attribute'),
  LIGHT_ARROWS: none('no elemental-arrow effect on a bow'),
  FIRE_ARROWS: none('no elemental-arrow effect on a bow'),
  LIGHTDAM: none('no item-level elemental added damage'),
  FIREDAM: none('no item-level elemental added damage'),
  KNOCKBACK: none('knockback exists as a status effect, but no affix applies it'),
  SPLLVLADD: none('no spell-level attribute'),
  CHARGES: none('no staff-charge system'),
  NOMANA: none('no "consumes no mana" effect'),
  ABSHALFTRAP: none('no trap-damage reduction'),
};

/** The target(s) of a power, a CURSE (`X_CURSE`) being its base power reversed; `null` for an unknown power. */
export function affixTargetsOf(power: string): (PowerTarget & { sign: 1 | -1 }) | null {
  const curse = power.endsWith('_CURSE');
  const base = curse ? power.slice(0, -'_CURSE'.length) : power;
  const t = AFFIX_POWERS[base];
  if (!t) return null;
  return { ...t, sign: curse ? -1 : 1 };
}
