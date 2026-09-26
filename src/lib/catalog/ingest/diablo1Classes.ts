/** Diablo I playable-class attributes and class-manifest schema. Column names only; never rows. */
import { split } from '@/lib/catalog/ingest/decode';
import { dropped, mapped, type FieldMap } from '@/lib/catalog/ingest/fieldMap';
import { contentHash } from '@/lib/catalog/reference/hash';
import type { DeriveSpec } from '@/lib/catalog/reference/derive';

export const CLASS_ATTRIBUTES_MAP: FieldMap = {
  classFlags: mapped('data.classFlags[]', split(',')),
  baseStr: mapped('data.baseStrength'),
  baseMag: mapped('data.baseMagic'),
  baseDex: mapped('data.baseDexterity'),
  baseVit: mapped('data.baseVitality'),
  maxStr: mapped('data.maxStrength'),
  maxMag: mapped('data.maxMagic'),
  maxDex: mapped('data.maxDexterity'),
  maxVit: mapped('data.maxVitality'),
  blockBonus: mapped('data.blockBonus'),
  adjLife: mapped('data.lifeAdjustment'),
  adjMana: mapped('data.manaAdjustment'),
  lvlLife: mapped('data.lifePerLevel'),
  lvlMana: mapped('data.manaPerLevel'),
  chrLife: mapped('data.lifePerBaseVitality'),
  chrMana: mapped('data.manaPerBaseMagic'),
  itmLife: mapped('data.lifePerItemVitality'),
  itmMana: mapped('data.manaPerItemMagic'),
  baseMagicToHit: mapped('data.baseMagicToHit'),
  baseMeleeToHit: mapped('data.baseMeleeToHit'),
  baseRangedToHit: mapped('data.baseRangedToHit'),
};

export const CLASSDAT_MAP: FieldMap = {
  className: mapped('name'),
  folderName: mapped('id'),
  portrait: dropped('portrait selection is presentation data owned by the source renderer'),
  inv: dropped('inventory-panel asset selection is presentation data owned by the source renderer'),
};

export const DIABLO1_CLASSES = [
  { folder: 'warrior', name: 'Warrior' },
  { folder: 'rogue', name: 'Rogue' },
  { folder: 'sorcerer', name: 'Sorcerer' },
  { folder: 'monk', name: 'Monk' },
  { folder: 'bard', name: 'Bard' },
  { folder: 'barbarian', name: 'Barbarian' },
] as const;

const HELLFIRE_CLASS_FOLDERS = ['monk', 'bard', 'barbarian'] as const;

/** Expansion is identity-derived because the transposed attribute record has no expansion field. */
export const CLASS_DERIVE: DeriveSpec = {
  version: () => contentHash({ code: 'class-expansion@1', hellfire: HELLFIRE_CLASS_FOLDERS }),
  derive: (entity) => {
    const classFolder = DIABLO1_CLASSES.find(({ folder }) => entity.id.endsWith(`-class-${folder}`))?.folder;
    if (!classFolder) return { gap: `entity id "${entity.id}" does not name a registered class folder` };
    return { expansion: HELLFIRE_CLASS_FOLDERS.includes(classFolder as typeof HELLFIRE_CLASS_FOLDERS[number]) ? 'hellfire' : 'diablo' };
  },
};

export const EXPERIENCE_MAP: FieldMap = {
  Level: mapped('data.level'),
  Experience: mapped('data.experienceToReach'),
};
