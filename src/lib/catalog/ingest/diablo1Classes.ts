/** Diablo I playable-class attributes and class-manifest schema. Column names only; never rows. */
import { split } from '@/lib/catalog/ingest/decode';
import { dropped, gap, mapped, type FieldMap } from '@/lib/catalog/ingest/fieldMap';
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

export const CLASS_ANIMATIONS_MAP: FieldMap = {
  unarmedFrames: mapped('data.animations.attack.unarmed.frames'),
  unarmedActionFrame: mapped('data.animations.attack.unarmed.actionFrame'),
  unarmedShieldFrames: mapped('data.animations.attack.unarmedShield.frames'),
  unarmedShieldActionFrame: mapped('data.animations.attack.unarmedShield.actionFrame'),
  swordFrames: mapped('data.animations.attack.sword.frames'),
  swordActionFrame: mapped('data.animations.attack.sword.actionFrame'),
  swordShieldFrames: mapped('data.animations.attack.swordShield.frames'),
  swordShieldActionFrame: mapped('data.animations.attack.swordShield.actionFrame'),
  bowFrames: mapped('data.animations.attack.bow.frames'),
  bowActionFrame: mapped('data.animations.attack.bow.actionFrame'),
  axeFrames: mapped('data.animations.attack.axe.frames'),
  axeActionFrame: mapped('data.animations.attack.axe.actionFrame'),
  maceFrames: mapped('data.animations.attack.mace.frames'),
  maceActionFrame: mapped('data.animations.attack.mace.actionFrame'),
  maceShieldFrames: mapped('data.animations.attack.maceShield.frames'),
  maceShieldActionFrame: mapped('data.animations.attack.maceShield.actionFrame'),
  staffFrames: mapped('data.animations.attack.staff.frames'),
  staffActionFrame: mapped('data.animations.attack.staff.actionFrame'),
  idleFrames: mapped('data.animations.dungeon.idleFrames'),
  walkingFrames: mapped('data.animations.dungeon.walkingFrames'),
  blockingFrames: mapped('data.animations.block.frames'),
  deathFrames: mapped('data.animations.death.frames'),
  castingFrames: mapped('data.animations.cast.frames'),
  recoveryFrames: mapped('data.animations.hitRecovery.frames'),
  townIdleFrames: mapped('data.animations.town.idleFrames'),
  townWalkingFrames: mapped('data.animations.town.walkingFrames'),
  castingActionFrame: mapped('data.animations.cast.actionFrame'),
};

export const CLASS_STARTING_LOADOUT_MAP: FieldMap = {
  skill: mapped('data.startingLoadout.skillId'),
  spell: mapped('data.startingLoadout.spellId'),
  spellLevel: mapped('data.startingLoadout.spellLevel'),
  item0: mapped('data.startingLoadout.itemIds[0]'),
  item1: mapped('data.startingLoadout.itemIds[1]'),
  item2: mapped('data.startingLoadout.itemIds[2]'),
  item3: mapped('data.startingLoadout.itemIds[3]'),
  item4: mapped('data.startingLoadout.itemIds[4]'),
  gold: mapped('data.startingLoadout.gold'),
};

export const CLASS_SOUNDS_MAP: FieldMap = {
  speech: mapped('data.heroSpeech[].eventId'),
  sfx: gap('The source audio binding is runtime-significant, but PoF characters have no event-to-audio binding contract.'),
};

export const CLASS_SPRITES_MAP: FieldMap = {
  classPath: dropped('Renderer asset-directory convention; it does not change hero gameplay.'),
  classChar: dropped('Renderer filename-letter convention; it does not change hero gameplay.'),
  trn: dropped('Renderer palette-translation selection; palette assets are outside this wrapper.'),
  stand: dropped('Standing-sprite pixel width is renderer data, not animation timing.'),
  walk: dropped('Walking-sprite pixel width is renderer data, not animation timing.'),
  attack: dropped('Attack-sprite pixel width is renderer data, not attack timing.'),
  bow: dropped('Bow-sprite pixel width is renderer data, not bow timing.'),
  swHit: dropped('Hit-recovery sprite width is renderer data, not the recovery frame count.'),
  block: dropped('Block-sprite pixel width is renderer data, not the block frame count.'),
  lightning: dropped('Lightning-cast sprite width is renderer data, not casting timing.'),
  fire: dropped('Fire-cast sprite width is renderer data, not casting timing.'),
  magic: dropped('Magic-cast sprite width is renderer data, not casting timing.'),
  death: dropped('Death-sprite pixel width is renderer data, not death timing.'),
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
