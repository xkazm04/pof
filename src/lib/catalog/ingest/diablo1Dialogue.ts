/** Diablo I town NPC, dialogue-line, quest-talk and quest mappings. Schema only — never rows. */
import { dropValues, split } from '@/lib/catalog/ingest/decode';
import { dropped, gap, mapped, type FieldMap } from '@/lib/catalog/ingest/fieldMap';
import { contentHash } from '@/lib/catalog/reference/hash';
import type { DeriveSpec } from '@/lib/catalog/reference/derive';

export const TOWNER_MAP: FieldMap = {
  type: mapped('id'),
  name: mapped('name'),
  // Neither CharacterData nor ZoneRecord has an NPC-instance placement field. ZoneRecord's
  // coordinates place the zone on UI/topology canvases, not an actor within a town map.
  position_x: gap('PoF characters and zone-map have no NPC-instance placement field; zone coordinates place the zone itself, not an actor inside it'),
  position_y: gap('PoF characters and zone-map have no NPC-instance placement field; zone coordinates place the zone itself, not an actor inside it'),
  direction: dropped('initial facing is presentation state rather than persistent NPC design data'),
  animWidth: dropped('sprite-cell width belongs to the 1996 renderer and has no design meaning'),
  animPath: dropped('sprite animation path belongs to the 1996 renderer and asset layout'),
  animFrames: dropped('sprite frame count belongs to the 1996 renderer and animation format'),
  animDelay: dropped('sprite playback delay belongs to the 1996 renderer and animation format'),
  gossipTexts: mapped('links[role=gossip]', split(',')),
  animOrder: dropped('sprite frame ordering belongs to the 1996 renderer and animation format'),
};

export const TEXT_LINE_MAP: FieldMap = {
  txtstrid: mapped('id'),
  txtstr: mapped('data.text'),
  scrlltxt: mapped('data.scrolling'),
  // `None` (×2) = an unvoiced line: a sentinel, not a sound called None.
  sfxnr: mapped('data.voiceClip', dropValues('None')),
};

export const QUEST_DIALOG_MAP: FieldMap = {
  towner_type: mapped('id'),
  Q_ROCK: mapped('data.questTalk[Q_ROCK]', dropValues('TEXT_NONE')),
  Q_MUSHROOM: mapped('data.questTalk[Q_MUSHROOM]', dropValues('TEXT_NONE')),
  Q_GARBUD: mapped('data.questTalk[Q_GARBUD]', dropValues('TEXT_NONE')),
  Q_ZHAR: mapped('data.questTalk[Q_ZHAR]', dropValues('TEXT_NONE')),
  Q_VEIL: mapped('data.questTalk[Q_VEIL]', dropValues('TEXT_NONE')),
  Q_DIABLO: mapped('data.questTalk[Q_DIABLO]', dropValues('TEXT_NONE')),
  Q_BUTCHER: mapped('data.questTalk[Q_BUTCHER]', dropValues('TEXT_NONE')),
  Q_LTBANNER: mapped('data.questTalk[Q_LTBANNER]', dropValues('TEXT_NONE')),
  Q_BLIND: mapped('data.questTalk[Q_BLIND]', dropValues('TEXT_NONE')),
  Q_BLOOD: mapped('data.questTalk[Q_BLOOD]', dropValues('TEXT_NONE')),
  Q_ANVIL: mapped('data.questTalk[Q_ANVIL]', dropValues('TEXT_NONE')),
  Q_WARLORD: mapped('data.questTalk[Q_WARLORD]', dropValues('TEXT_NONE')),
  Q_SKELKING: mapped('data.questTalk[Q_SKELKING]', dropValues('TEXT_NONE')),
  Q_PWATER: mapped('data.questTalk[Q_PWATER]', dropValues('TEXT_NONE')),
  Q_SCHAMB: mapped('data.questTalk[Q_SCHAMB]', dropValues('TEXT_NONE')),
  Q_BETRAYER: mapped('data.questTalk[Q_BETRAYER]', dropValues('TEXT_NONE')),
  Q_GRAVE: mapped('data.questTalk[Q_GRAVE]', dropValues('TEXT_NONE')),
  Q_TRADER: mapped('data.questTalk[Q_TRADER]', dropValues('TEXT_NONE')),
};

/** Row order from DevilutionX Source/tables/questdat.hpp (`enum quest_id`). */
export const QUEST_ROW_IDS = [
  'Q_ROCK',
  'Q_MUSHROOM',
  'Q_GARBUD',
  'Q_ZHAR',
  'Q_VEIL',
  'Q_DIABLO',
  'Q_BUTCHER',
  'Q_LTBANNER',
  'Q_BLIND',
  'Q_BLOOD',
  'Q_ANVIL',
  'Q_WARLORD',
  'Q_SKELKING',
  'Q_PWATER',
  'Q_SCHAMB',
  'Q_BETRAYER',
  'Q_GRAVE',
  'Q_FARMER',
  'Q_GIRL',
  'Q_TRADER',
  'Q_DEFILER',
  'Q_NAKRUL',
  'Q_CORNSTN',
  'Q_JERSEY',
] as const;

export const QUEST_MAP: FieldMap = {
  qdlvl: mapped('data.dungeonLevel'),
  // Source/quests.cpp assigns this only for a quest allowed in multiplayer; -1 occurs on
  // single-player-only rows, where that branch is never entered, so it means no fixed MP level.
  qdmultlvl: mapped('data.dungeonLevelMultiplayer', dropValues('-1')),
  qlvlt: mapped('data.setLevelType'),
  bookOrder: mapped('data.logOrder'),
  // Loaded by Source/tables/questdat.cpp but never read. Source/quests.cpp instead randomizes
  // availability through the hard-coded groups in InitialiseQuestPools.
  qdrnd: dropped('the current engine loads this legacy random-selection value but never reads it; quest pools are hard-coded instead'),
  qslvl: mapped('data.setLevel', dropValues('SL_NONE')),
  isSinglePlayerOnly: mapped('data.singlePlayerOnly'),
  // `_qdmsg` initializes Quest::_qmsg; Source/panels/quest_log.cpp plays that line when the
  // selected quest-log entry opens, so this is not necessarily the quest introduction.
  qdmsg: mapped('links[role=quest-log-line]'),
  qlstr: mapped('name'),
};

const HELLFIRE_QUEST_IDS = QUEST_ROW_IDS.slice(QUEST_ROW_IDS.indexOf('Q_GRAVE'));

/**
 * The enum's Hellfire suffix is confirmed by the explicit `gbIsHellfire` cases in
 * Source/control/control_chat_commands.cpp::IsQuestEnabled. Current Source/quests.cpp does
 * not contain the older gate; it initializes the combined table for either game mode.
 */
export const QUEST_DERIVE: DeriveSpec = {
  version: () => contentHash({ code: 'quest-expansion@1', hellfire: HELLFIRE_QUEST_IDS }),
  derive: (entity) => {
    const questId = QUEST_ROW_IDS.find((id) => entity.id.endsWith(`-${id}`));
    if (!questId) return { gap: `entity id "${entity.id}" does not name a declared quest_id` };
    return { expansion: HELLFIRE_QUEST_IDS.includes(questId) ? 'hellfire' : 'diablo' };
  },
};
