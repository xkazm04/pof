import type { ReferenceWrapper } from '@/lib/catalog/reference/wrapper';

export type EffectiveItemSource = 'base' | 'unique power' | 'engine rule';

export interface EffectiveItemStat<T> {
  value: T;
  source: EffectiveItemSource;
}

export interface EffectiveItemRange {
  min: number;
  max: number;
}

export interface EffectiveUniqueItem {
  itemClass: EffectiveItemStat<string>;
  equipType: EffectiveItemStat<string>;
  itemType: EffectiveItemStat<string>;
  slot: EffectiveItemStat<string>;
  damage: EffectiveItemStat<EffectiveItemRange>;
  damagePercent: EffectiveItemStat<EffectiveItemRange>;
  flatDamage: EffectiveItemStat<EffectiveItemRange>;
  effectiveDamage: EffectiveItemStat<EffectiveItemRange>;
  armor: EffectiveItemStat<EffectiveItemRange>;
  armorPercent: EffectiveItemStat<EffectiveItemRange>;
  effectiveArmor: EffectiveItemStat<EffectiveItemRange>;
  requiredStrength: EffectiveItemStat<number>;
  requiredMagic: EffectiveItemStat<number>;
  requiredDexterity: EffectiveItemStat<number>;
  requiredLevel: EffectiveItemStat<number>;
  durability: EffectiveItemStat<EffectiveItemRange>;
}

export interface EffectiveUniqueItemIssue {
  entityId: string;
  reason: string;
}

export interface EffectiveUniqueItemsResult {
  wrappers: ReferenceWrapper[];
  unresolved: EffectiveUniqueItemIssue[];
}

interface UniquePower {
  power: string;
  min?: string;
  max?: string;
}

const BASE_ITEM_FILE = 'items/itemdat.tsv';
const UNIQUE_ITEM_FILE = 'items/unique_itemdat.tsv';

function numeric(raw: Record<string, string>, key: string, owner: string): number {
  const value = Number(raw[key]);
  if (!Number.isFinite(value)) throw new Error(`${owner} has no numeric ${key}`);
  return value;
}

function powerRange(power: UniquePower, owner: string): EffectiveItemRange {
  const min = power.min == null || power.min === '' ? 0 : Number(power.min);
  const max = power.max == null || power.max === '' ? min : Number(power.max);
  if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) {
    throw new Error(`${owner} power ${power.power} has invalid min/max`);
  }
  return { min, max };
}

function addRange(left: EffectiveItemRange, right: EffectiveItemRange): EffectiveItemRange {
  return { min: left.min + right.min, max: left.max + right.max };
}

function subtractRange(left: EffectiveItemRange, right: EffectiveItemRange): EffectiveItemRange {
  return { min: left.min - right.max, max: left.max - right.min };
}

function transformRange(
  left: EffectiveItemRange,
  right: EffectiveItemRange,
  transform: (left: number, right: number) => number,
): EffectiveItemRange {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (let a = left.min; a <= left.max; a++) {
    for (let b = right.min; b <= right.max; b++) {
      const value = transform(a, b);
      min = Math.min(min, value);
      max = Math.max(max, value);
    }
  }
  return { min, max };
}

function slotOf(equipType: string, itemType: string): string {
  if (equipType === 'One-handed' || equipType === 'Two-handed') return itemType === 'Shield' ? 'OffHand' : 'Weapon';
  return ({ Armor: 'Chest', Helm: 'Helm', Ring: 'Ring', Amulet: 'Amulet' } as Record<string, string>)[equipType]
    ?? 'Unequippable';
}

function assertWrappers(unique: ReferenceWrapper, base: ReferenceWrapper): void {
  if (unique.catalogId !== 'items' || unique.file !== UNIQUE_ITEM_FILE || !unique.entity.id.startsWith('d1-uitem-')) {
    throw new Error(`${unique.entity.id} is not a Diablo I unique-item wrapper`);
  }
  if (base.catalogId !== 'items' || base.file !== BASE_ITEM_FILE) {
    throw new Error(`${base.entity.id} is not a Diablo I itemdat base wrapper`);
  }
  if (unique.raw.uniqueBaseItem !== base.raw.uniqueBaseItem) {
    throw new Error(`${unique.entity.id} requires base enum ${unique.raw.uniqueBaseItem}, not ${base.entity.id}`);
  }
}

/**
 * Build the runtime item state produced by GetItemAttrs followed by GetUniqueItem.
 * Base fields are copied first (.reference/devilutionX/Source/items.cpp:3131-3154), then
 * unique powers are applied in table order (.reference/devilutionX/Source/items.cpp:1452-1460).
 * Percentage damage and armor remain separate item bonuses in that state
 * (.reference/devilutionX/Source/items.cpp:712-740,840-855,949-974); the two effective
 * ranges additionally apply the engine's integer formulas
 * (.reference/devilutionX/Source/player.cpp:568-569;
 * .reference/devilutionX/Source/items.cpp:2479-2490).
 */
export function effectiveUniqueItem(unique: ReferenceWrapper, base: ReferenceWrapper): EffectiveUniqueItem {
  assertWrappers(unique, base);

  let equipType = base.raw.equipType;
  let equipTypeSource: EffectiveItemSource = 'base';
  let damage = { min: numeric(base.raw, 'minDamage', base.entity.id), max: numeric(base.raw, 'maxDamage', base.entity.id) };
  let damageSource: EffectiveItemSource = 'base';
  let damagePercent = { min: 0, max: 0 };
  let damagePercentSource: EffectiveItemSource = 'engine rule';
  let flatDamage = { min: 0, max: 0 };
  let flatDamageSource: EffectiveItemSource = 'engine rule';
  let armor = { min: numeric(base.raw, 'minArmor', base.entity.id), max: numeric(base.raw, 'maxArmor', base.entity.id) };
  let armorSource: EffectiveItemSource = 'base';
  let armorPercent = { min: 0, max: 0 };
  let armorPercentSource: EffectiveItemSource = 'engine rule';
  let requiredStrength = numeric(base.raw, 'minStrength', base.entity.id);
  let requiredStrengthSource: EffectiveItemSource = 'base';
  let durability = {
    min: numeric(base.raw, 'durability', base.entity.id),
    max: numeric(base.raw, 'durability', base.entity.id),
  };
  let durabilitySource: EffectiveItemSource = 'base';

  const powers = Array.isArray(unique.entity.data.powers)
    ? unique.entity.data.powers as UniquePower[]
    : [];
  for (const power of powers) {
    const range = powerRange(power, unique.entity.id);
    // SaveItemPower rolls inclusively with RndPL before dispatch, except SETDAM and SETDUR
    // read their parameters directly (.reference/devilutionX/Source/items.cpp:666-668,701-705,955-961).
    switch (power.power) {
      case 'DAMP':
      case 'TOHIT_DAMP':
        damagePercent = addRange(damagePercent, range);
        damagePercentSource = 'unique power';
        break;
      case 'DAMP_CURSE':
      case 'TOHIT_DAMP_CURSE':
        damagePercent = subtractRange(damagePercent, range);
        damagePercentSource = 'unique power';
        break;
      case 'CRYSTALLINE':
        damagePercent = addRange(damagePercent, { min: 140 + range.min * 2, max: 140 + range.max * 2 });
        damagePercentSource = 'unique power';
        durability = transformRange(durability, range, (value, percent) => Math.max(1, value - Math.trunc(percent * value / 100)));
        durabilitySource = 'unique power';
        break;
      case 'DAMMOD':
        flatDamage = addRange(flatDamage, range);
        flatDamageSource = 'unique power';
        break;
      case 'SETDAM':
        damage = { min: range.min, max: range.max };
        damageSource = 'unique power';
        break;
      case 'ACP':
        armorPercent = addRange(armorPercent, range);
        armorPercentSource = 'unique power';
        break;
      case 'ACP_CURSE':
        armorPercent = subtractRange(armorPercent, range);
        armorPercentSource = 'unique power';
        break;
      case 'SETAC':
        armor = range;
        armorSource = 'unique power';
        break;
      case 'AC_CURSE':
        armor = subtractRange(armor, range);
        armorSource = 'unique power';
        break;
      case 'DUR':
        durability = transformRange(durability, range, (value, percent) => value + Math.trunc(percent * value / 100));
        durabilitySource = 'unique power';
        break;
      case 'DUR_CURSE':
        durability = transformRange(durability, range, (value, percent) => Math.max(1, value - Math.trunc(percent * value / 100)));
        durabilitySource = 'unique power';
        break;
      case 'INDESTRUCTIBLE':
        // DUR_INDESTRUCTIBLE is the engine sentinel 255 (.reference/devilutionX/Source/items.h:33).
        durability = { min: 255, max: 255 };
        durabilitySource = 'engine rule';
        break;
      case 'SETDUR':
        durability = { min: range.min, max: range.min };
        durabilitySource = 'unique power';
        break;
      case 'ONEHAND':
        equipType = 'One-handed';
        equipTypeSource = 'unique power';
        break;
      case 'NOMINSTR':
        requiredStrength = 0;
        requiredStrengthSource = 'unique power';
        break;
    }
  }

  const effectiveDamage = transformRange(damage, damagePercent, (value, percent) =>
    value + Math.trunc(value * percent / 100));
  const damageWithFlat = addRange(effectiveDamage, flatDamage);
  const effectiveArmor = transformRange(armor, armorPercent, (value, percent) => {
    if (percent === 0) return value;
    let bonus = Math.trunc(value * percent / 100);
    if (bonus === 0) bonus = Math.sign(percent);
    return value + bonus;
  });
  const slot = slotOf(equipType, base.raw.itemType);

  return {
    itemClass: { value: base.raw.class, source: 'base' },
    equipType: { value: equipType, source: equipTypeSource },
    itemType: { value: base.raw.itemType, source: 'base' },
    slot: { value: slot, source: equipTypeSource },
    damage: { value: damage, source: damageSource },
    damagePercent: { value: damagePercent, source: damagePercentSource },
    flatDamage: { value: flatDamage, source: flatDamageSource },
    effectiveDamage: { value: damageWithFlat, source: 'engine rule' },
    armor: { value: armor, source: armorSource },
    armorPercent: { value: armorPercent, source: armorPercentSource },
    effectiveArmor: { value: effectiveArmor, source: 'engine rule' },
    requiredStrength: { value: requiredStrength, source: requiredStrengthSource },
    requiredMagic: { value: numeric(base.raw, 'minMagic', base.entity.id), source: 'base' },
    requiredDexterity: { value: numeric(base.raw, 'minDexterity', base.entity.id), source: 'base' },
    // Diablo checks only the three attribute requirements when equipping an item
    // (.reference/devilutionX/Source/items.cpp:529-535,1851-1866).
    requiredLevel: { value: 0, source: 'engine rule' },
    durability: { value: durability, source: durabilitySource },
  };
}

/**
 * Add effective stats to selected unique wrappers at promotion time. A forced unique scans
 * itemdat from index zero and uses the first matching base enum
 * (.reference/devilutionX/Source/items.cpp:3210-3216), so the first ordered base-item link
 * is authoritative. If link order is unavailable and several rows match, this reports the
 * ambiguity instead of using database order as an engine rule.
 */
export function effectiveUniqueItemsForPromotion(
  selected: readonly ReferenceWrapper[],
  available: readonly ReferenceWrapper[],
): EffectiveUniqueItemsResult {
  const byId = new Map(available.map((wrapper) => [wrapper.entity.id, wrapper]));
  const baseRows = available.filter((wrapper) => wrapper.file === BASE_ITEM_FILE);
  const wrappers: ReferenceWrapper[] = [];
  const unresolved: EffectiveUniqueItemIssue[] = [];

  for (const wrapper of selected) {
    if (wrapper.file !== UNIQUE_ITEM_FILE || !wrapper.entity.id.startsWith('d1-uitem-')) {
      wrappers.push(wrapper);
      continue;
    }

    const linkedIds = (wrapper.entity.links ?? [])
      .filter((link) => link.role === 'base-item' && link.catalogId === 'items')
      .map((link) => link.entityId);
    let base = linkedIds.length > 0 ? byId.get(linkedIds[0]) : undefined;
    if (!base && linkedIds.length === 0) {
      const matches = baseRows.filter((candidate) => candidate.raw.uniqueBaseItem === wrapper.raw.uniqueBaseItem);
      if (matches.length === 1) base = matches[0];
      else if (matches.length > 1) {
        unresolved.push({
          entityId: wrapper.entity.id,
          reason: `base enum ${wrapper.raw.uniqueBaseItem} matches ${matches.length} itemdat rows but ordered base-item links are unavailable`,
        });
        continue;
      }
    }
    if (!base) {
      unresolved.push({
        entityId: wrapper.entity.id,
        reason: linkedIds.length > 0
          ? `engine-selected base-item link ${linkedIds[0]} does not resolve to an available wrapper`
          : `base enum ${wrapper.raw.uniqueBaseItem} has no itemdat wrapper`,
      });
      continue;
    }

    wrappers.push({
      ...wrapper,
      entity: {
        ...wrapper.entity,
        data: { ...wrapper.entity.data, effective: effectiveUniqueItem(wrapper, base) },
      },
    });
  }

  return { wrappers, unresolved };
}
