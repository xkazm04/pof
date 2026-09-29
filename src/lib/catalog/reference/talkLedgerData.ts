/** Pin-verified conversation assembly data. This module imports public types only. */
import type {
  TalkGossipRule,
  TalkMenuEntry,
  TalkPreMenuHandler,
  TalkQuestFlag,
  TalkQuestId,
  TalkQuestTopic,
  TalkingMonsterTalkLedgerData,
  TalkRepeatRule,
  TalkSpeechId,
  TalkTownerId,
  TownerTalkLedgerData,
} from '@/lib/catalog/reference/talkLedger';

const source = (file: string, lines: string) => `.reference/devilutionX/Source/${file}:${lines}`;
const asset = (file: string, line: string) => `.reference/devilutionX/assets/txtdata/${file}:${line}`;
const stores = (lines: string) => source('stores.cpp', lines);
const towners = (lines: string) => source('towners.cpp', lines);
const quests = (lines: string) => source('quests.cpp', lines);
const monster = (lines: string) => source('monster.cpp', lines);
const townerTable = (line: string) => asset('towners/towners.tsv', line);
const questDialogTable = (line: string) => asset('towners/quest_dialog.tsv', line);
const uniqueMonsterTable = (line: string) => asset('monsters/unique_monstdat.tsv', line);

const TopicCodeRefs = [
  stores('1204-1245'),
  stores('1968-2004'),
  source('tables/townerdat.cpp', '133-242'),
] as const;

const GossipCodeRefs = [
  towners('117-138'),
  stores('1204-1245'),
  stores('1968-2004'),
] as const;

function menu(
  id: string,
  kind: TalkMenuEntry['kind'],
  condition: string,
  action: string,
  refs: readonly string[],
): TalkMenuEntry {
  return { id, kind, condition, action, refs };
}

function topic(
  towner: TalkTownerId,
  quest: TalkQuestId,
  speech: `TEXT_${string}`,
  row: string,
  sourceKind: TalkQuestTopic['source'] = 'quest-dialog-table',
  extraRefs: readonly string[] = [],
): TalkQuestTopic {
  return {
    quest,
    speech,
    source: sourceKind,
    availabilityCondition: `!gbIsSpawn; Quests[${quest}]._qactive == QUEST_ACTIVE; Quests[${quest}]._qlog; GetTownerQuestDialog(${towner}, ${quest}) == ${speech}`,
    selectionEffect: `InitQTextMsg(GetTownerQuestDialog(${towner}, ${quest}))`,
    repeatRule: 'repeatable-while-condition',
    refs: [...TopicCodeRefs, questDialogTable(row), ...extraRefs],
  };
}

function tableTopics(
  towner: TalkTownerId,
  row: string,
  pairs: readonly (readonly [TalkQuestId, `TEXT_${string}`])[],
): TalkQuestTopic[] {
  return pairs.map(([quest, speech]) => topic(towner, quest, speech, row));
}

function gossip(pool: readonly `TEXT_${string}`[], row: string): TalkGossipRule {
  const first = pool[0];
  const last = pool.at(-1);
  if (!first || !last) throw new Error('a gossip range must contain at least one TEXT_ enum name');
  return {
    pool: { first, last, enumNames: pool },
    menuOrder: 'before-quest-topics',
    availabilityCondition: '!gbIsSpawn; TalkID::Gossip is open',
    selectionRule: 'InitTownerFromData: max(GenerateRnd(entry.gossipTexts.size()), 0) selects one entry and assigns Towner::gossip',
    repeatRule: 'TalkEnter reuses Towner::gossip on every selection until InitTowners initializes the towner again',
    refs: [...GossipCodeRefs, townerTable(row)],
  };
}

function handler(
  id: string,
  quest: TalkQuestId | null,
  triggerCondition: string,
  effect: string,
  speech: readonly TalkSpeechId[],
  repeatRule: TalkRepeatRule,
  refs: readonly string[],
  mutatesQuestState = quest !== null,
  outcome: TalkPreMenuHandler['outcome'] = 'stop-before-menu',
): TalkPreMenuHandler {
  return {
    id,
    phase: 'pre-menu',
    quest,
    triggerCondition,
    effect,
    speech,
    repeatRule,
    outcome,
    mutatesQuestState,
    refs,
  };
}

function fallback(
  id: string,
  speech: `TEXT_${string}`,
  action: string,
  refs: readonly string[],
): TalkPreMenuHandler {
  return {
    id,
    phase: 'fallback-menu',
    quest: null,
    triggerCondition: 'no earlier pre-menu handler returns',
    effect: `TownerTalk(${speech}); ${action}`,
    speech: [speech],
    repeatRule: 'repeatable',
    outcome: 'open-menu',
    mutatesQuestState: false,
    refs: [towners('205-210'), ...refs],
  };
}

const leave = (refs: readonly string[]) => menu(
  'leave',
  'leave',
  'menu is open',
  'ActiveStore=TalkID::None',
  refs,
);

const talk = (towner: TalkTownerId, oldStore: string, refs: readonly string[]) => menu(
  'talk',
  'talk-submenu',
  'menu is open',
  `TownerId=${towner}; OldActiveStore=${oldStore}; StartStore(TalkID::Gossip)`,
  refs,
);

const smithTopics = tableTopics('TOWN_SMITH', '2', [
  ['Q_ROCK', 'TEXT_INFRA6'],
  ['Q_MUSHROOM', 'TEXT_MUSH6'],
  ['Q_VEIL', 'TEXT_VEIL5'],
  ['Q_BUTCHER', 'TEXT_BUTCH5'],
  ['Q_LTBANNER', 'TEXT_BANNER6'],
  ['Q_BLIND', 'TEXT_BLIND5'],
  ['Q_BLOOD', 'TEXT_BLOOD5'],
  ['Q_ANVIL', 'TEXT_ANVIL6'],
  ['Q_WARLORD', 'TEXT_WARLRD5'],
  ['Q_SKELKING', 'TEXT_KING7'],
  ['Q_PWATER', 'TEXT_POISON7'],
  ['Q_SCHAMB', 'TEXT_BONE5'],
  ['Q_BETRAYER', 'TEXT_VILE9'],
  ['Q_GRAVE', 'TEXT_GRAVE2'],
]);

const healerTopics = [
  topic('TOWN_HEALER', 'Q_ROCK', 'TEXT_INFRA3', '3'),
  topic('TOWN_HEALER', 'Q_MUSHROOM', 'TEXT_MUSH3', '3', 'runtime-override', [
    quests('60-64'),
    towners('352-361'),
    towners('435-442'),
  ]),
  ...tableTopics('TOWN_HEALER', '3', [
    ['Q_VEIL', 'TEXT_VEIL3'],
    ['Q_BUTCHER', 'TEXT_BUTCH3'],
    ['Q_LTBANNER', 'TEXT_BANNER4'],
    ['Q_BLIND', 'TEXT_BLIND3'],
    ['Q_BLOOD', 'TEXT_BLOOD3'],
    ['Q_ANVIL', 'TEXT_ANVIL3'],
    ['Q_WARLORD', 'TEXT_WARLRD3'],
    ['Q_SKELKING', 'TEXT_KING5'],
    ['Q_PWATER', 'TEXT_POISON4'],
    ['Q_SCHAMB', 'TEXT_BONE3'],
    ['Q_BETRAYER', 'TEXT_VILE7'],
    ['Q_GRAVE', 'TEXT_GRAVE3'],
  ]),
];

const tavernTopics = tableTopics('TOWN_TAVERN', '5', [
  ['Q_ROCK', 'TEXT_INFRA2'],
  ['Q_MUSHROOM', 'TEXT_MUSH2'],
  ['Q_VEIL', 'TEXT_VEIL2'],
  ['Q_BUTCHER', 'TEXT_BUTCH2'],
  ['Q_BLIND', 'TEXT_BLIND2'],
  ['Q_BLOOD', 'TEXT_BLOOD2'],
  ['Q_ANVIL', 'TEXT_ANVIL2'],
  ['Q_WARLORD', 'TEXT_WARLRD2'],
  ['Q_SKELKING', 'TEXT_KING3'],
  ['Q_PWATER', 'TEXT_POISON2'],
  ['Q_SCHAMB', 'TEXT_BONE2'],
  ['Q_BETRAYER', 'TEXT_VILE4'],
  ['Q_GRAVE', 'TEXT_GRAVE5'],
]);

const storytellerTopics = tableTopics('TOWN_STORY', '6', [
  ['Q_ROCK', 'TEXT_INFRA1'],
  ['Q_MUSHROOM', 'TEXT_MUSH1'],
  ['Q_VEIL', 'TEXT_VEIL1'],
  ['Q_DIABLO', 'TEXT_VILE3'],
  ['Q_BUTCHER', 'TEXT_BUTCH1'],
  ['Q_LTBANNER', 'TEXT_BANNER1'],
  ['Q_BLIND', 'TEXT_BLIND1'],
  ['Q_BLOOD', 'TEXT_BLOOD1'],
  ['Q_ANVIL', 'TEXT_ANVIL1'],
  ['Q_WARLORD', 'TEXT_WARLRD1'],
  ['Q_SKELKING', 'TEXT_KING1'],
  ['Q_PWATER', 'TEXT_POISON1'],
  ['Q_SCHAMB', 'TEXT_BONE1'],
  ['Q_BETRAYER', 'TEXT_VILE2'],
  ['Q_GRAVE', 'TEXT_GRAVE6'],
]);

const drunkTopics = tableTopics('TOWN_DRUNK', '7', [
  ['Q_ROCK', 'TEXT_INFRA8'],
  ['Q_MUSHROOM', 'TEXT_MUSH7'],
  ['Q_VEIL', 'TEXT_VEIL6'],
  ['Q_BUTCHER', 'TEXT_BUTCH6'],
  ['Q_LTBANNER', 'TEXT_BANNER7'],
  ['Q_BLIND', 'TEXT_BLIND6'],
  ['Q_BLOOD', 'TEXT_BLOOD6'],
  ['Q_ANVIL', 'TEXT_ANVIL8'],
  ['Q_WARLORD', 'TEXT_WARLRD6'],
  ['Q_SKELKING', 'TEXT_KING8'],
  ['Q_PWATER', 'TEXT_POISON8'],
  ['Q_SCHAMB', 'TEXT_BONE6'],
  ['Q_BETRAYER', 'TEXT_VILE10'],
  ['Q_GRAVE', 'TEXT_GRAVE7'],
]);

const witchTopics = tableTopics('TOWN_WITCH', '8', [
  ['Q_ROCK', 'TEXT_INFRA9'],
  ['Q_MUSHROOM', 'TEXT_MUSH9'],
  ['Q_VEIL', 'TEXT_VEIL7'],
  ['Q_BUTCHER', 'TEXT_BUTCH7'],
  ['Q_LTBANNER', 'TEXT_BANNER8'],
  ['Q_BLIND', 'TEXT_BLIND7'],
  ['Q_BLOOD', 'TEXT_BLOOD7'],
  ['Q_ANVIL', 'TEXT_ANVIL9'],
  ['Q_WARLORD', 'TEXT_WARLRD7'],
  ['Q_SKELKING', 'TEXT_KING9'],
  ['Q_PWATER', 'TEXT_POISON9'],
  ['Q_SCHAMB', 'TEXT_BONE7'],
  ['Q_BETRAYER', 'TEXT_VILE11'],
  ['Q_GRAVE', 'TEXT_GRAVE1'],
]);

const barmaidTopics = tableTopics('TOWN_BMAID', '9', [
  ['Q_ROCK', 'TEXT_INFRA4'],
  ['Q_MUSHROOM', 'TEXT_MUSH5'],
  ['Q_VEIL', 'TEXT_VEIL4'],
  ['Q_BUTCHER', 'TEXT_BUTCH4'],
  ['Q_LTBANNER', 'TEXT_BANNER5'],
  ['Q_BLIND', 'TEXT_BLIND4'],
  ['Q_BLOOD', 'TEXT_BLOOD4'],
  ['Q_ANVIL', 'TEXT_ANVIL4'],
  ['Q_WARLORD', 'TEXT_WARLRD4'],
  ['Q_SKELKING', 'TEXT_KING6'],
  ['Q_PWATER', 'TEXT_POISON6'],
  ['Q_SCHAMB', 'TEXT_BONE4'],
  ['Q_BETRAYER', 'TEXT_VILE8'],
  ['Q_GRAVE', 'TEXT_GRAVE8'],
]);

const boyTopics = tableTopics('TOWN_PEGBOY', '10', [
  ['Q_ROCK', 'TEXT_INFRA10'],
  ['Q_MUSHROOM', 'TEXT_MUSH13'],
  ['Q_VEIL', 'TEXT_VEIL8'],
  ['Q_BUTCHER', 'TEXT_BUTCH8'],
  ['Q_LTBANNER', 'TEXT_BANNER9'],
  ['Q_BLIND', 'TEXT_BLIND8'],
  ['Q_BLOOD', 'TEXT_BLOOD8'],
  ['Q_ANVIL', 'TEXT_ANVIL10'],
  ['Q_WARLORD', 'TEXT_WARLRD8'],
  ['Q_SKELKING', 'TEXT_KING10'],
  ['Q_PWATER', 'TEXT_POISON10'],
  ['Q_SCHAMB', 'TEXT_BONE8'],
  ['Q_BETRAYER', 'TEXT_VILE12'],
  ['Q_GRAVE', 'TEXT_GRAVE9'],
]);

export const D1_TOWNER_TALK_LEDGERS: readonly TownerTalkLedgerData[] = [
  {
    kind: 'towner', towner: 'TOWN_SMITH', entityId: 'd1-TOWN_SMITH', scope: 'vanilla-single-player',
    menuEntries: [
      talk('TOWN_SMITH', 'TalkID::Smith', [stores('432-452'), stores('1285-1329')]),
      menu('buy-basic', 'service', 'menu is open; storeUi != StoreUi::VisualGrid', 'StartStore(TalkID::SmithBuy)', [stores('432-452'), stores('1306-1315')]),
      menu('buy-premium', 'service', 'menu is open; storeUi != StoreUi::VisualGrid', 'StartStore(TalkID::SmithPremiumBuy)', [stores('432-452'), stores('1316-1318')]),
      menu('sell', 'service', 'menu is open; storeUi != StoreUi::VisualGrid', 'StartStore(TalkID::SmithSell)', [stores('432-452'), stores('1319-1321')]),
      menu('repair', 'service', 'menu is open; storeUi != StoreUi::VisualGrid', 'StartStore(TalkID::SmithRepair)', [stores('432-452'), stores('1322-1324')]),
      menu('visual-trade-repair', 'service', 'menu is open; storeUi == StoreUi::VisualGrid', 'OpenVisualStore(VisualStoreVendor::Smith)', [stores('432-452'), stores('1285-1303')]),
      leave([stores('432-452'), stores('1285-1329')]),
    ],
    questTopics: smithTopics,
    gossip: gossip([
      'TEXT_GRISWOLD2', 'TEXT_GRISWOLD3', 'TEXT_GRISWOLD4', 'TEXT_GRISWOLD5', 'TEXT_GRISWOLD6',
      'TEXT_GRISWOLD7', 'TEXT_GRISWOLD8', 'TEXT_GRISWOLD9', 'TEXT_GRISWOLD10', 'TEXT_GRISWOLD12',
      'TEXT_GRISWOLD13',
    ], '2'),
    preMenuHandlers: [
      handler('rock-briefing', 'Q_ROCK', 'Q_ROCK is available and not QUEST_DONE; floor 4 or 5 visited; _qvar2==0', '_qvar2=1; _qlog=true; QUEST_INIT becomes QUEST_ACTIVE', ['TEXT_INFRA5'], 'one-shot-state-guarded', [towners('294-305')]),
      handler('rock-hand-in', 'Q_ROCK', 'Q_ROCK is available and not QUEST_DONE; _qvar2==1; RemoveInventoryItemById(IDI_ROCK) succeeds', 'remove IDI_ROCK; QUEST_DONE; SpawnUnique(UITEM_INFRARING)', ['TEXT_INFRA7'], 'one-shot-state-guarded', [towners('294-315')]),
      handler('anvil-briefing', 'Q_ANVIL', 'Q_ANVIL is neither QUEST_NOTAVAIL nor QUEST_DONE; floor 9 or 10 visited; _qvar2==0', '_qvar2=1; _qlog=true; QUEST_INIT becomes QUEST_ACTIVE', ['TEXT_ANVIL5'], 'one-shot-state-guarded', [towners('316-326')]),
      handler('anvil-hand-in', 'Q_ANVIL', 'Q_ANVIL is neither QUEST_NOTAVAIL nor QUEST_DONE; _qvar2==1; RemoveInventoryItemById(IDI_ANVIL) succeeds', 'remove IDI_ANVIL; QUEST_DONE; SpawnUnique(UITEM_GRISWOLD)', ['TEXT_ANVIL7'], 'one-shot-state-guarded', [towners('316-335')]),
      fallback('smith-fallback', 'TEXT_GRISWOLD1', 'StartStore(TalkID::Smith)', [towners('337-339')]),
    ],
    refs: [towners('292-339'), stores('432-452'), stores('1204-1245'), stores('1285-1329')],
  },
  {
    kind: 'towner', towner: 'TOWN_HEALER', entityId: 'd1-TOWN_HEALER', scope: 'vanilla-single-player',
    menuEntries: [
      talk('TOWN_HEALER', 'TalkID::Healer', [stores('1030-1043'), stores('1876-1896')]),
      menu('buy', 'service', 'menu is open', 'StartStore(TalkID::HealerBuy)', [stores('1030-1043'), stores('1876-1896')]),
      leave([stores('1030-1043'), stores('1876-1896')]),
    ],
    questTopics: healerTopics,
    gossip: gossip([
      'TEXT_PEPIN2', 'TEXT_PEPIN3', 'TEXT_PEPIN4', 'TEXT_PEPIN5', 'TEXT_PEPIN6', 'TEXT_PEPIN7',
      'TEXT_PEPIN9', 'TEXT_PEPIN10', 'TEXT_PEPIN11',
    ], '3'),
    preMenuHandlers: [
      handler('poison-water-briefing', 'Q_PWATER', 'Q_PWATER is available; (QUEST_INIT and floor 1 or 5 visited) or (QUEST_ACTIVE and !_qlog)', 'QUEST_ACTIVE; _qlog=true; _qmsg=TEXT_POISON3', ['TEXT_POISON3'], 'one-shot-state-guarded', [towners('413-426')]),
      handler('poison-water-reward', 'Q_PWATER', 'Q_PWATER==QUEST_DONE; _qvar1!=2', '_qvar1=2; SpawnUnique(UITEM_TRING)', ['TEXT_POISON5'], 'one-shot-state-guarded', [towners('427-433')]),
      handler('brain-hand-in', 'Q_MUSHROOM', 'Q_MUSHROOM==QUEST_ACTIVE; QS_MUSHGIVEN<=_qvar1<QS_BRAINGIVEN; RemoveInventoryItemById(IDI_BRAIN) succeeds', 'remove IDI_BRAIN; SpawnQuestItem(IDI_SPECELIX); _qvar1=QS_BRAINGIVEN; SetTownerQuestDialog(TOWN_HEALER,Q_MUSHROOM,TEXT_NONE)', ['TEXT_MUSH4'], 'one-shot-state-guarded', [towners('435-445')]),
      fallback('healer-fallback', 'TEXT_PEPIN1', 'StartStore(TalkID::Healer)', [towners('447-449')]),
    ],
    refs: [towners('413-449'), stores('1018-1043'), stores('1204-1245'), stores('1876-1925')],
  },
  {
    kind: 'towner', towner: 'TOWN_DEADGUY', entityId: 'd1-TOWN_DEADGUY', scope: 'vanilla-single-player',
    menuEntries: [], questTopics: [], gossip: null,
    preMenuHandlers: [
      handler('completed-silent', 'Q_BUTCHER', 'Q_BUTCHER==QUEST_DONE', 'return', [], 'repeatable-while-condition', [towners('273-278')], false),
      handler('avenged-reminder', 'Q_BUTCHER', 'Q_BUTCHER!=QUEST_DONE; _qvar1==1', 'Player::SaySpecific(HeroSpeech::YourDeathWillBeAvenged)', ['HeroSpeech::YourDeathWillBeAvenged'], 'repeatable-while-condition', [towners('279-282')], false),
      handler('butcher-briefing', 'Q_BUTCHER', 'Q_BUTCHER!=QUEST_DONE; _qvar1!=1', 'QUEST_ACTIVE; _qlog=true; _qmsg=TEXT_BUTCH9; _qvar1=1', ['TEXT_BUTCH9'], 'one-shot-state-guarded', [towners('283-290')]),
    ],
    refs: [towners('191-203'), towners('273-290')],
  },
  {
    kind: 'towner', towner: 'TOWN_TAVERN', entityId: 'd1-TOWN_TAVERN', scope: 'vanilla-single-player',
    menuEntries: [
      talk('TOWN_TAVERN', 'TalkID::Tavern', [stores('1247-1258'), stores('2006-2019')]),
      leave([stores('1247-1258'), stores('2006-2019')]),
    ],
    questTopics: tavernTopics,
    gossip: gossip(['TEXT_OGDEN2', 'TEXT_OGDEN3', 'TEXT_OGDEN4', 'TEXT_OGDEN5', 'TEXT_OGDEN6', 'TEXT_OGDEN8', 'TEXT_OGDEN9', 'TEXT_OGDEN10'], '5'),
    preMenuHandlers: [
      handler('intro-before-visiting-dungeon', null, '!player._pLvlVisited[0]', 'InitQTextMsg(TEXT_INTRO)', ['TEXT_INTRO'], 'repeatable-while-condition', [towners('212-217')], false),
      handler('skeleton-king-briefing', 'Q_SKELKING', 'Q_SKELKING is available; floor 2 or 4 visited; _qvar2==0', '_qvar2=1; _qlog=true; QUEST_INIT becomes QUEST_ACTIVE with _qvar1=1', ['TEXT_KING2'], 'one-shot-state-guarded', [towners('219-232')]),
      handler('skeleton-king-epilogue', 'Q_SKELKING', 'Q_SKELKING==QUEST_DONE; floor 2 or 4 visited; _qvar2==1', '_qvar2=2; _qvar1=2', ['TEXT_KING4'], 'one-shot-state-guarded', [towners('219-240')]),
      handler('banner-briefing', 'Q_LTBANNER', 'Q_LTBANNER is available and not QUEST_DONE; floor 3 or 4 visited; _qvar2==0', '_qvar2=1; _qlog=true; QUEST_INIT becomes QUEST_ACTIVE with _qvar1=1', ['TEXT_BANNER2'], 'one-shot-state-guarded', [towners('243-256')]),
      handler('banner-hand-in', 'Q_LTBANNER', 'Q_LTBANNER is available and not QUEST_DONE; floor 3 or 4 visited; _qvar2==1; RemoveInventoryItemById(IDI_BANNER) succeeds', 'remove IDI_BANNER; QUEST_DONE; _qvar1=3; SpawnUnique(UITEM_HARCREST)', ['TEXT_BANNER3'], 'one-shot-state-guarded', [towners('243-267')]),
      fallback('tavern-fallback', 'TEXT_OGDEN1', 'StartStore(TalkID::Tavern)', [towners('269-271')]),
    ],
    refs: [towners('212-271'), stores('1204-1258'), stores('1968-2019')],
  },
  {
    kind: 'towner', towner: 'TOWN_STORY', entityId: 'd1-TOWN_STORY', scope: 'vanilla-single-player',
    menuEntries: [
      talk('TOWN_STORY', 'TalkID::Storyteller', [stores('1072-1082'), stores('1927-1943')]),
      menu('identify', 'service', 'menu is open', 'StartStore(TalkID::StorytellerIdentify)', [stores('1072-1082'), stores('1927-1943')]),
      leave([stores('1072-1082'), stores('1927-1943')]),
    ],
    questTopics: storytellerTopics,
    gossip: gossip(['TEXT_STORY2', 'TEXT_STORY3', 'TEXT_STORY4', 'TEXT_STORY5', 'TEXT_STORY6', 'TEXT_STORY7', 'TEXT_STORY9', 'TEXT_STORY10', 'TEXT_STORY11'], '6'),
    preMenuHandlers: [
      handler('lazarus-staff-hand-in', 'Q_BETRAYER', '!UseMultiplayerQuests(); Q_BETRAYER==QUEST_INIT; RemoveInventoryItemById(IDI_LAZSTAFF) succeeds', 'remove IDI_LAZSTAFF; _qlog=true; QUEST_ACTIVE; _qvar1=2', ['TEXT_VILE1'], 'one-shot-state-guarded', [towners('457-468')]),
      handler('betrayer-epilogue', 'Q_BETRAYER', 'Q_BETRAYER==QUEST_DONE; _qvar1==7', 'Q_BETRAYER._qvar1=8; Q_DIABLO._qlog=true', ['TEXT_VILE3'], 'one-shot-state-guarded', [towners('477-487')]),
      fallback('storyteller-fallback', 'TEXT_STORY1', 'StartStore(TalkID::Storyteller)', [towners('489-491')]),
    ],
    refs: [towners('457-491'), stores('1072-1082'), stores('1204-1245'), stores('1927-2004')],
  },
  {
    kind: 'towner', towner: 'TOWN_DRUNK', entityId: 'd1-TOWN_DRUNK', scope: 'vanilla-single-player',
    menuEntries: [
      talk('TOWN_DRUNK', 'TalkID::Drunk', [stores('1273-1283'), stores('2047-2060')]),
      leave([stores('1273-1283'), stores('2047-2060')]),
    ],
    questTopics: drunkTopics,
    gossip: gossip([
      'TEXT_FARNHAM2', 'TEXT_FARNHAM3', 'TEXT_FARNHAM4', 'TEXT_FARNHAM5', 'TEXT_FARNHAM6',
      'TEXT_FARNHAM8', 'TEXT_FARNHAM9', 'TEXT_FARNHAM10', 'TEXT_FARNHAM11', 'TEXT_FARNHAM12',
      'TEXT_FARNHAM13',
    ], '7'),
    preMenuHandlers: [fallback('drunk-fallback', 'TEXT_FARNHAM1', 'StartStore(TalkID::Drunk)', [towners('407-411')])],
    refs: [towners('407-411'), stores('1204-1245'), stores('1273-1283'), stores('2047-2060')],
  },
  {
    kind: 'towner', towner: 'TOWN_WITCH', entityId: 'd1-TOWN_WITCH', scope: 'vanilla-single-player',
    menuEntries: [
      talk('TOWN_WITCH', 'TalkID::Witch', [stores('690-711'), stores('1531-1575')]),
      menu('buy', 'service', 'menu is open; storeUi != StoreUi::VisualGrid', 'StartStore(TalkID::WitchBuy)', [stores('690-711'), stores('1555-1564')]),
      menu('sell', 'service', 'menu is open; storeUi != StoreUi::VisualGrid', 'StartStore(TalkID::WitchSell)', [stores('690-711'), stores('1555-1567')]),
      menu('visual-buy-sell', 'service', 'menu is open; storeUi == StoreUi::VisualGrid', 'OpenVisualStore(VisualStoreVendor::Witch)', [stores('690-711'), stores('1531-1552')]),
      menu('recharge', 'service', 'menu is open', 'StartStore(TalkID::WitchRecharge)', [stores('690-711'), stores('1531-1570')]),
      leave([stores('690-711'), stores('1531-1575')]),
    ],
    questTopics: witchTopics,
    gossip: gossip([
      'TEXT_ADRIA2', 'TEXT_ADRIA3', 'TEXT_ADRIA4', 'TEXT_ADRIA5', 'TEXT_ADRIA6', 'TEXT_ADRIA7',
      'TEXT_ADRIA8', 'TEXT_ADRIA9', 'TEXT_ADRIA10', 'TEXT_ADRIA12', 'TEXT_ADRIA13',
    ], '8'),
    preMenuHandlers: [
      handler('fungal-tome-hand-in', 'Q_MUSHROOM', 'Q_MUSHROOM is available and QUEST_INIT; RemoveInventoryItemById(IDI_FUNGALTM) succeeds', 'remove IDI_FUNGALTM; QUEST_ACTIVE; _qlog=true; _qvar1=QS_TOMEGIVEN', ['TEXT_MUSH8'], 'one-shot-state-guarded', [towners('341-351')]),
      handler('mushroom-hand-in', 'Q_MUSHROOM', 'Q_MUSHROOM==QUEST_ACTIVE; QS_TOMEGIVEN<=_qvar1<QS_MUSHGIVEN; RemoveInventoryItemById(IDI_MUSHROOM) succeeds', '_qvar1=QS_MUSHGIVEN; SetTownerQuestDialog(TOWN_HEALER,Q_MUSHROOM,TEXT_MUSH3); SetTownerQuestDialog(TOWN_WITCH,Q_MUSHROOM,TEXT_NONE); _qmsg=TEXT_MUSH10', ['TEXT_MUSH10'], 'one-shot-state-guarded', [towners('352-362')]),
      handler('mushroom-reminder', 'Q_MUSHROOM', 'Q_MUSHROOM==QUEST_ACTIVE; QS_TOMEGIVEN<=_qvar1<QS_MUSHGIVEN; no removable IDI_MUSHROOM; _qmsg!=TEXT_MUSH9', '_qmsg=TEXT_MUSH9', ['TEXT_MUSH9'], 'one-shot-state-guarded', [towners('352-369')]),
      handler('brain-noticed', 'Q_MUSHROOM', 'Q_MUSHROOM==QUEST_ACTIVE; _qvar1>=QS_MUSHGIVEN; HasInventoryItemWithId(IDI_BRAIN); _qvar2!=TEXT_MUSH11', '_qmsg=TEXT_MUSH11; _qvar2=TEXT_MUSH11; retain IDI_BRAIN', ['TEXT_MUSH11'], 'one-shot-state-guarded', [towners('370-377')]),
      handler('spectral-elixir-carried', 'Q_MUSHROOM', 'Q_MUSHROOM==QUEST_ACTIVE; _qvar1>=QS_MUSHGIVEN; HasInventoryOrBeltItemWithId(IDI_SPECELIX)', 'QUEST_DONE; retain IDI_SPECELIX', ['TEXT_MUSH12'], 'one-shot-state-guarded', [towners('370-384')]),
      fallback('witch-fallback', 'TEXT_ADRIA1', 'StartStore(TalkID::Witch)', [towners('388-390')]),
    ],
    refs: [towners('341-390'), stores('690-711'), stores('1204-1245'), stores('1531-1575')],
  },
  {
    kind: 'towner', towner: 'TOWN_BMAID', entityId: 'd1-TOWN_BMAID', scope: 'vanilla-single-player',
    menuEntries: [
      talk('TOWN_BMAID', 'TalkID::Barmaid', [stores('1260-1271'), stores('2021-2045')]),
      menu('storage', 'service', 'menu is open', 'ActiveStore=TalkID::None; IsStashOpen=true; Stash.RefreshItemStatFlags()', [stores('1260-1271'), stores('2021-2045')]),
      leave([stores('1260-1271'), stores('2021-2045')]),
    ],
    questTopics: barmaidTopics,
    gossip: gossip(['TEXT_GILLIAN2', 'TEXT_GILLIAN3', 'TEXT_GILLIAN4', 'TEXT_GILLIAN5', 'TEXT_GILLIAN6', 'TEXT_GILLIAN7', 'TEXT_GILLIAN9', 'TEXT_GILLIAN10'], '9'),
    preMenuHandlers: [
      handler('grave-map-briefing', 'Q_GRAVE', '!player._pLvlVisited[21]; HasInventoryItemWithId(IDI_MAPOFDOOM); Q_GRAVE._qmsg!=TEXT_GRAVE8', 'QUEST_ACTIVE; _qlog=true; _qmsg=TEXT_GRAVE8', ['TEXT_GRAVE8'], 'one-shot-state-guarded', [towners('392-401')]),
      fallback('barmaid-fallback', 'TEXT_GILLIAN1', 'StartStore(TalkID::Barmaid)', [towners('403-405')]),
    ],
    refs: [towners('392-405'), stores('1204-1271'), stores('1968-2045')],
  },
  {
    kind: 'towner', towner: 'TOWN_PEGBOY', entityId: 'd1-TOWN_PEGBOY', scope: 'vanilla-single-player',
    menuEntries: [
      talk('TOWN_PEGBOY', 'TalkID::Boy', [stores('971-988'), stores('1694-1723')]),
      menu('inspect-offer', 'service', 'menu is open; !BoyItem.isEmpty()', 'PlayerCanAfford inspection fee ? StartStore(TalkID::BoyBuy) or OpenVisualStore(VisualStoreVendor::Boy) : StartStore(TalkID::NoMoney)', [stores('971-1016'), stores('1694-1723')]),
      leave([stores('971-988'), stores('1694-1723')]),
    ],
    questTopics: boyTopics,
    gossip: gossip([
      'TEXT_WIRT2', 'TEXT_WIRT3', 'TEXT_WIRT4', 'TEXT_WIRT5', 'TEXT_WIRT6',
      'TEXT_WIRT7', 'TEXT_WIRT8', 'TEXT_WIRT9', 'TEXT_WIRT11', 'TEXT_WIRT12',
    ], '10'),
    preMenuHandlers: [fallback('boy-fallback', 'TEXT_WIRT1', 'StartStore(TalkID::Boy)', [towners('451-455')])],
    refs: [towners('451-455'), stores('971-1016'), stores('1204-1245'), stores('1694-1723')],
  },
  {
    kind: 'towner', towner: 'TOWN_COW', entityId: 'd1-TOWN_COW', scope: 'vanilla-single-player',
    menuEntries: [], questTopics: [], gossip: null,
    preMenuHandlers: [
      handler('active-cow-sfx-guard', null, 'CowPlaying!=SfxID::None; effect_is_playing(CowPlaying)', 'return', [], 'repeatable-while-condition', [towners('493-497')], false),
      handler('fourth-cow-click', null, 'no cow effect is playing; incremented CowClicks==4', 'CowPlaying=SfxID::Cow2; gbIsSpawn resets CowClicks=0; PlaySfxLoc', [], 'cyclic', [towners('498-505'), towners('520-521')], false),
      handler('eighth-cow-click', null, 'no cow effect is playing; incremented CowClicks>=8; !gbIsSpawn', 'CowClicks=4; rotate CowMsg; Player::SaySpecific; CowPlaying=SfxID::Cow1; PlaySfxLoc', ['HeroSpeech::YepThatsACowAlright', 'HeroSpeech::ImNotThirsty', 'HeroSpeech::ImNoMilkmaid'], 'cyclic', [towners('498-521')], false),
      handler('default-cow-click', null, 'no cow effect is playing; incremented CowClicks!=4; CowClicks<8 or gbIsSpawn', 'CowPlaying=SfxID::Cow1; PlaySfxLoc', [], 'repeatable', [towners('498-521')], false),
    ],
    refs: [towners('26-31'), towners('140-171'), towners('493-521')],
  },
  {
    kind: 'towner', towner: 'TOWN_FARMER', entityId: 'd1-TOWN_FARMER', scope: 'hellfire-flag-only',
    menuEntries: [], questTopics: [], gossip: null, preMenuHandlers: [],
    refs: [towners('523-577'), towners('697-699'), towners('735-748')],
    note: 'Hellfire-only towner; conversation assembly is outside this ledger scope.',
  },
  {
    kind: 'towner', towner: 'TOWN_COWFARM', entityId: 'd1-TOWN_COWFARM', scope: 'hellfire-flag-only',
    menuEntries: [], questTopics: [], gossip: null, preMenuHandlers: [],
    refs: [towners('173-189'), towners('579-649'), towners('697-699'), towners('735-748')],
    note: 'Hellfire-only towner; conversation assembly is outside this ledger scope.',
  },
  {
    kind: 'towner', towner: 'TOWN_GIRL', entityId: 'd1-TOWN_GIRL', scope: 'hellfire-flag-only',
    menuEntries: [], questTopics: [], gossip: null, preMenuHandlers: [],
    refs: [towners('651-682'), towners('697-699'), towners('735-748')],
    note: 'Hellfire-only towner; conversation assembly is outside this ledger scope.',
  },
];

function monsterHandler(
  id: string,
  quest: TalkQuestId,
  triggerCondition: string,
  effect: string,
  speech: readonly `TEXT_${string}`[],
  repeatRule: TalkRepeatRule,
  refs: readonly string[],
  mutatesQuestState = true,
): TalkPreMenuHandler {
  return handler(id, quest, triggerCondition, effect, speech, repeatRule, refs, mutatesQuestState, 'no-menu');
}

function questFlag(purpose: string, setWhen: string, refs: readonly string[]): TalkQuestFlag {
  return { flag: 'MFLAG_QUEST_COMPLETE', purpose, setWhen, refs };
}

const CommonMonsterTalkRefs = [monster('1427-1467'), monster('4747-4804'), monster('4846-4849')] as const;

export const D1_TALKING_MONSTER_LEDGERS: readonly TalkingMonsterTalkLedgerData[] = [
  {
    kind: 'talking-monster', monster: 'UniqueMonsterType::Garbud', entityId: 'd1-uniq-gharbad-the-weak', quest: 'Q_GARBUD',
    initialSpeech: 'TEXT_GARBUD1', speechSequence: ['TEXT_GARBUD1', 'TEXT_GARBUD2', 'TEXT_GARBUD3', 'TEXT_GARBUD4'],
    interactionCondition: 'CanTalkToMonst: goal is MonsterGoal::Inquiring or MonsterGoal::Talking',
    menuEntries: [], questTopics: [], gossip: null,
    preMenuHandlers: [
      monsterHandler('garbud-first-talk', 'Q_GARBUD', 'local player; talkMsg==TEXT_GARBUD1', 'QUEST_ACTIVE; _qlog=true; MonsterTalk(TEXT_GARBUD1)', ['TEXT_GARBUD1'], 'repeatable-until-message-advance', [monster('1427-1433'), monster('4789-4794')]),
      monsterHandler('garbud-first-reward', 'Q_GARBUD', 'local player; talkMsg==TEXT_GARBUD2; MFLAG_QUEST_COMPLETE is clear', 'spawn deterministic item; set MFLAG_QUEST_COMPLETE; _qvar1=QS_GHARBAD_FIRST_ITEM_SPAWNED', ['TEXT_GARBUD2'], 'one-shot-state-guarded', [monster('4789-4802')]),
    ],
    questFlags: [questFlag('guards the first reward spawn', 'first local TEXT_GARBUD2 interaction', [monster('4795-4801')])],
    refs: [...CommonMonsterTalkRefs, monster('2578-2627'), uniqueMonsterTable('2')],
  },
  {
    kind: 'talking-monster', monster: 'UniqueMonsterType::Zhar', entityId: 'd1-uniq-zhar-the-mad', quest: 'Q_ZHAR',
    initialSpeech: 'TEXT_ZHAR1', speechSequence: ['TEXT_ZHAR1', 'TEXT_ZHAR2'],
    interactionCondition: 'CanTalkToMonst: goal is MonsterGoal::Inquiring or MonsterGoal::Talking',
    menuEntries: [], questTopics: [], gossip: null,
    preMenuHandlers: [
      monsterHandler('zhar-first-talk', 'Q_ZHAR', 'talkMsg==TEXT_ZHAR1; MFLAG_QUEST_COMPLETE is clear; local player', 'QUEST_ACTIVE; _qlog=true; _qvar1=QS_ZHAR_ITEM_SPAWNED; spawn deterministic IMISC_BOOK; set MFLAG_QUEST_COMPLETE', ['TEXT_ZHAR1'], 'one-shot-state-guarded', [monster('4774-4786')]),
    ],
    questFlags: [questFlag('guards the first-talk book spawn', 'first local TEXT_ZHAR1 interaction', [monster('4774-4786')])],
    refs: [...CommonMonsterTalkRefs, monster('2786-2815'), uniqueMonsterTable('4')],
  },
  {
    kind: 'talking-monster', monster: 'UniqueMonsterType::SnotSpill', entityId: 'd1-uniq-snotspill', quest: 'Q_LTBANNER',
    initialSpeech: 'TEXT_BANNER10', speechSequence: ['TEXT_BANNER10', 'TEXT_BANNER11', 'TEXT_BANNER12'],
    interactionCondition: 'CanTalkToMonst: goal is MonsterGoal::Inquiring or MonsterGoal::Talking',
    menuEntries: [], questTopics: [], gossip: null,
    preMenuHandlers: [
      monsterHandler('snotspill-offer', 'Q_LTBANNER', 'talkMsg==TEXT_BANNER10; MFLAG_QUEST_COMPLETE is clear', 'open first map section; _qvar1=2; QUEST_INIT becomes QUEST_ACTIVE; set MFLAG_QUEST_COMPLETE', ['TEXT_BANNER10'], 'one-shot-state-guarded', [monster('1427-1448')]),
      monsterHandler('snotspill-banner-hand-in', 'Q_LTBANNER', 'Q_LTBANNER.IsAvailable(); _qvar1==2; RemoveInventoryItemById(IDI_BANNER) succeeds', 'QUEST_DONE; talkMsg=TEXT_BANNER12; goal=MonsterGoal::Inquiring', ['TEXT_BANNER12'], 'one-shot-state-guarded', [monster('4747-4759')]),
    ],
    questFlags: [questFlag('guards the first map-section opening', 'first TEXT_BANNER10 MonsterTalk', [monster('1434-1445')])],
    refs: [...CommonMonsterTalkRefs, monster('2630-2666'), uniqueMonsterTable('5')],
  },
  {
    kind: 'talking-monster', monster: 'UniqueMonsterType::Lazarus', entityId: 'd1-uniq-arch-bishop-lazarus', quest: 'Q_BETRAYER',
    initialSpeech: 'TEXT_VILE13', speechSequence: ['TEXT_VILE13'],
    interactionCondition: '!UseMultiplayerQuests(); visible; goal==MonsterGoal::Inquiring; scripted tile or TalktoMonster interaction',
    menuEntries: [], questTopics: [], gossip: null,
    preMenuHandlers: [
      monsterHandler('lazarus-greeting', 'Q_BETRAYER', '!UseMultiplayerQuests(); visible; talkMsg==TEXT_VILE13; goal==MonsterGoal::Inquiring', 'MonsterMode::Talk; _qvar1 advances through 5 to 6; clear talkMsg; hostility', ['TEXT_VILE13'], 'one-shot-state-guarded', [monster('2879-2925')]),
    ],
    questFlags: [],
    refs: [...CommonMonsterTalkRefs, monster('2879-2925'), monster('3325-3363'), uniqueMonsterTable('6')],
  },
  {
    kind: 'talking-monster', monster: 'UniqueMonsterType::RedVex', entityId: 'd1-uniq-red-vex', quest: 'Q_BETRAYER',
    initialSpeech: 'TEXT_VILE13', speechSequence: ['TEXT_VILE13'],
    interactionCondition: '!UseMultiplayerQuests(); visible; Q_BETRAYER._qvar1<=5 keeps goal==MonsterGoal::Inquiring',
    menuEntries: [], questTopics: [], gossip: null,
    preMenuHandlers: [
      monsterHandler('red-vex-greeting', 'Q_BETRAYER', '!UseMultiplayerQuests(); Q_BETRAYER._qvar1<=5; player interacts', 'MonsterTalk(TEXT_VILE13); Lazarus progression later clears talkMsg and releases hostility', ['TEXT_VILE13'], 'repeatable-while-condition', [monster('2928-2950'), monster('4747-4751')], false),
    ],
    questFlags: [],
    refs: [...CommonMonsterTalkRefs, monster('2928-2950'), monster('3325-3363'), uniqueMonsterTable('7')],
  },
  {
    kind: 'talking-monster', monster: 'UniqueMonsterType::BlackJade', entityId: 'd1-uniq-black-jade', quest: 'Q_BETRAYER',
    initialSpeech: 'TEXT_VILE13', speechSequence: ['TEXT_VILE13'],
    interactionCondition: '!UseMultiplayerQuests(); visible; Q_BETRAYER._qvar1<=5 keeps goal==MonsterGoal::Inquiring',
    menuEntries: [], questTopics: [], gossip: null,
    preMenuHandlers: [
      monsterHandler('black-jade-greeting', 'Q_BETRAYER', '!UseMultiplayerQuests(); Q_BETRAYER._qvar1<=5; player interacts', 'MonsterTalk(TEXT_VILE13); Lazarus progression later clears talkMsg and releases hostility', ['TEXT_VILE13'], 'repeatable-while-condition', [monster('2928-2950'), monster('4747-4751')], false),
    ],
    questFlags: [],
    refs: [...CommonMonsterTalkRefs, monster('2928-2950'), monster('3325-3363'), uniqueMonsterTable('8')],
  },
  {
    kind: 'talking-monster', monster: 'UniqueMonsterType::Lachdan', entityId: 'd1-uniq-lachdanan', quest: 'Q_VEIL',
    initialSpeech: 'TEXT_VEIL9', speechSequence: ['TEXT_VEIL9', 'TEXT_VEIL10', 'TEXT_VEIL11'],
    interactionCondition: 'CanTalkToMonst: goal is MonsterGoal::Inquiring or MonsterGoal::Talking',
    menuEntries: [], questTopics: [], gossip: null,
    preMenuHandlers: [
      monsterHandler('lachdan-first-talk', 'Q_VEIL', 'talkMsg==TEXT_VEIL9', 'QUEST_ACTIVE; _qlog=true', ['TEXT_VEIL9'], 'repeatable-until-message-advance', [monster('1427-1456')]),
      monsterHandler('lachdan-elixir-hand-in', 'Q_VEIL', 'Q_VEIL.IsAvailable(); talkMsg>=TEXT_VEIL9; RemoveInventoryItemById(IDI_GLDNELIX) succeeds; MFLAG_QUEST_COMPLETE is clear', 'talkMsg=TEXT_VEIL11; set MFLAG_QUEST_COMPLETE; SpawnUnique(UITEM_STEELVEIL); _qvar2=QS_VEIL_ITEM_SPAWNED', ['TEXT_VEIL11'], 'one-shot-state-guarded', [monster('4761-4771')]),
    ],
    questFlags: [questFlag('guards the golden-elixir reward hand-in', 'successful IDI_GLDNELIX removal', [monster('4761-4771')])],
    refs: [...CommonMonsterTalkRefs, monster('2953-2981'), uniqueMonsterTable('9')],
  },
  {
    kind: 'talking-monster', monster: 'UniqueMonsterType::WarlordOfBlood', entityId: 'd1-uniq-warlord-of-blood', quest: 'Q_WARLORD',
    initialSpeech: 'TEXT_WARLRD9', speechSequence: ['TEXT_WARLRD9'],
    interactionCondition: 'visible; talkMsg==TEXT_WARLRD9; goal==MonsterGoal::Inquiring automatically enters MonsterMode::Talk',
    menuEntries: [], questTopics: [], gossip: null,
    preMenuHandlers: [
      monsterHandler('warlord-confrontation', 'Q_WARLORD', 'visible; talkMsg==TEXT_WARLRD9; goal==MonsterGoal::Inquiring', 'MonsterMode::Talk; _qvar1=QS_WARLORD_TALKING; speech completion sets QS_WARLORD_ATTACKING and hostility', ['TEXT_WARLRD9'], 'one-shot-state-guarded', [monster('1427-1461'), monster('2984-3006')]),
    ],
    questFlags: [],
    refs: [...CommonMonsterTalkRefs, monster('2984-3006'), monster('3325-3363'), uniqueMonsterTable('10')],
  },
];
