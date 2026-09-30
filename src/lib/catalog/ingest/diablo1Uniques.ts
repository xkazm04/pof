/** Named-monster overrides are applied after base initialization (.reference/devilutionX/Source/monster.cpp:3325-3347). */
import { dropValues, prefix } from '@/lib/catalog/ingest/decode';
import { dropped, gap, mapped, type FieldMap } from '@/lib/catalog/ingest/fieldMap';
import { MONSTER_RESISTANCE_DECODE } from '@/lib/catalog/ingest/diablo1';

const NO_DRAIN = 'on-hit stat-drain has no representation: `status-effects` is a catalog but no archetype→status-effect link `role` exists';
const NO_RESIST = 'PoF bestiary has no per-element resistance field — the engine flags remain available in the wrapper raw row for effective-stat resolution';

export const UNIQUE_MAP: FieldMap = {
  type: mapped('links[role=base]', prefix('d1-')),
  name: mapped('name'),
  // Loaded only as the unique monster's palette translation
  // (.reference/devilutionX/Source/monster.cpp:3320-3322).
  trn: dropped('palette-swap presentation file; PoF re-skins through materials, not colour LUTs'),
  // Zero is not a literal level: Monster::level uses base level + 5; otherwise it doubles
  // the unique value (.reference/devilutionX/Source/monster.h:398-405).
  level: mapped('data.stats[Level]', dropValues('0')),
  // The engine shifts this point value by 6, halves it in single-player, then applies the
  // difficulty transform (.reference/devilutionX/Source/monster.cpp:3328-3333,3365-3382).
  maxHp: mapped('data.stats[HP Max]'),
  ai: mapped('tags'),
  intelligence: mapped('data.intelligence'),
  minDamage: mapped('data.stats[Damage Min]'),
  maxDamage: mapped('data.stats[Damage Max]'),
  reducePlayerStrength: gap(NO_DRAIN),
  reducePlayerMagic: gap(NO_DRAIN),
  reducePlayerDexterity: gap(NO_DRAIN),
  reducePlayerVitality: gap(NO_DRAIN),
  reducePlayerMaxHP: gap(NO_DRAIN),
  reducePlayerMaxMana: gap(NO_DRAIN),
  // Both tables use the same enum-list parser (.reference/devilutionX/Source/tables/monstdat.cpp:396,447);
  // `raw.resistance` is decoded by the effective resolver because PoF has no native destination.
  resistance: gap(NO_RESIST),
  // None spawns no group; Independent spawns ordinary minions; Leashed additionally binds
  // them to the unique leader (.reference/devilutionX/Source/tables/monstdat.h:307-319;
  // .reference/devilutionX/Source/monster.cpp:3402-3403).
  monsterPack: mapped('data.pack'),
  // Zero means use the base monster values (.reference/devilutionX/Source/monster.cpp:3392-3399,5005-5008).
  customToHit: mapped('data.customToHit', dropValues('0')),
  customArmorClass: mapped('data.customArmorClass', dropValues('0')),
  talkMessage: mapped('links[role=talk-line]', dropValues('TEXT_NONE'), prefix('d1-')),
};

/** Shared decoder for consumers that need the engine resistance vocabulary as a list. */
export const UNIQUE_RESISTANCE_DECODE = MONSTER_RESISTANCE_DECODE;
