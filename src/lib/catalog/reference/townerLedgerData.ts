/** Pinned engine behaviour for Tristram towners; no dialogue prose or TSV row values live here. */
import type { TownerLedgerData } from '@/lib/catalog/reference/townerLedger';

const towners = (lines: string) => `.reference/devilutionX/Source/towners.cpp:${lines}`;
const stores = (lines: string) => `.reference/devilutionX/Source/stores.cpp:${lines}`;
const quests = (lines: string) => `.reference/devilutionX/Source/quests.cpp:${lines}`;

export const TOWNER_LEDGER_DATA: readonly TownerLedgerData[] = [
  {
    towner: 'TOWN_SMITH', name: 'Griswold', expansion: 'diablo', scope: 'full',
    preMenuHandlers: [
      {
        quest: 'Q_ROCK',
        condition: 'Q_ROCK != QUEST_NOTAVAIL; Q_ROCK != QUEST_DONE; player._pLvlVisited[4] || player._pLvlVisited[5]; _qvar2 == 0',
        effect: '_qvar2=1; _qlog=true; QUEST_INIT becomes QUEST_ACTIVE; speak TEXT_INFRA5',
        speechLineIds: ['TEXT_INFRA5'], consumesTurn: true, refs: [towners('294-305')],
      },
      {
        quest: 'Q_ROCK',
        condition: 'Q_ROCK != QUEST_NOTAVAIL; Q_ROCK != QUEST_DONE; player._pLvlVisited[4] || player._pLvlVisited[5]; _qvar2 == 1; remove IDI_ROCK succeeds',
        effect: 'remove IDI_ROCK; QUEST_DONE; spawn UITEM_INFRARING; speak TEXT_INFRA7',
        speechLineIds: ['TEXT_INFRA7'], consumesTurn: true, refs: [towners('294-315')],
      },
      {
        quest: 'Q_ANVIL',
        condition: 'Q_ANVIL is neither QUEST_NOTAVAIL nor QUEST_DONE; player._pLvlVisited[9] || player._pLvlVisited[10]; _qvar2 == 0',
        effect: '_qvar2=1; _qlog=true; QUEST_INIT becomes QUEST_ACTIVE; speak TEXT_ANVIL5',
        speechLineIds: ['TEXT_ANVIL5'], consumesTurn: true, refs: [towners('316-326')],
      },
      {
        quest: 'Q_ANVIL',
        condition: 'Q_ANVIL is neither QUEST_NOTAVAIL nor QUEST_DONE; _qvar2 == 1; remove IDI_ANVIL succeeds',
        effect: 'remove IDI_ANVIL; QUEST_DONE; spawn UITEM_GRISWOLD; speak TEXT_ANVIL7',
        speechLineIds: ['TEXT_ANVIL7'], consumesTurn: true, refs: [towners('316-335')],
      },
    ],
    services: [
      { service: 'buy-basic', condition: 'fallback menu opens; SmithItems is nonempty', effect: 'open TalkID::SmithBuy', trigger: 'menu-option', refs: [stores('432-483'), stores('1306-1315')] },
      { service: 'buy-premium', condition: 'fallback menu opens; PremiumItems is nonempty', effect: 'open TalkID::SmithPremiumBuy', trigger: 'menu-option', refs: [stores('432-452'), stores('485-523'), stores('1316-1318')] },
      { service: 'sell', condition: 'fallback menu opens; item passes SmithWillBuy', effect: 'sell eligible inventory or belt item', trigger: 'menu-option', refs: [stores('543-608'), stores('1319-1321'), stores('2866-2886')] },
      { service: 'repair', condition: 'fallback menu opens; equipped or carried item is damaged and eligible', effect: 'take repair price and restore maximum durability', trigger: 'menu-option', refs: [stores('610-688'), stores('1322-1324'), stores('1480-1506')] },
    ],
    greetingRules: [{
      condition: 'no ordered pre-menu handler matches',
      effect: 'TownerTalk resets cow-click state, speaks TEXT_GRISWOLD1, then StartStore(TalkID::Smith)',
      lineIds: ['TEXT_GRISWOLD1'], opensMenu: true, refs: [towners('205-210'), towners('337-339')],
    }],
    firstVisitBehavior: null,
    refs: [towners('292-339'), stores('432-688'), stores('1285-1329')],
  },
  {
    towner: 'TOWN_HEALER', name: 'Pepin', expansion: 'diablo', scope: 'full',
    preMenuHandlers: [
      {
        quest: 'Q_PWATER',
        condition: 'Q_PWATER != QUEST_NOTAVAIL; (QUEST_INIT and (player._pLvlVisited[1] || player._pLvlVisited[5])) || (QUEST_ACTIVE and !_qlog)',
        effect: 'QUEST_ACTIVE; _qlog=true; _qmsg=TEXT_POISON3; speak TEXT_POISON3',
        speechLineIds: ['TEXT_POISON3'], consumesTurn: true, refs: [towners('413-426')],
      },
      {
        quest: 'Q_PWATER',
        condition: 'Q_PWATER == QUEST_DONE; _qvar1 != 2',
        effect: '_qvar1=2; speak TEXT_POISON5; spawn UITEM_TRING',
        speechLineIds: ['TEXT_POISON5'], consumesTurn: true, refs: [towners('427-433')],
      },
      {
        quest: 'Q_MUSHROOM',
        condition: 'Q_MUSHROOM == QUEST_ACTIVE; _qvar1 >= QS_MUSHGIVEN and < QS_BRAINGIVEN; remove IDI_BRAIN succeeds',
        effect: 'remove IDI_BRAIN; spawn IDI_SPECELIX; speak TEXT_MUSH4; _qvar1=QS_BRAINGIVEN; set TOWN_HEALER Q_MUSHROOM topic to TEXT_NONE',
        speechLineIds: ['TEXT_MUSH4'], consumesTurn: true, refs: [towners('435-445')],
      },
    ],
    services: [
      { service: 'heal', condition: 'no pre-menu handler matched and StartStore(TalkID::Healer) begins', effect: 'immediately set current and base hit points to their maxima; mana is unchanged', trigger: 'menu-open', refs: [stores('1018-1043'), towners('447-448')] },
      { service: 'buy', condition: 'healer menu opens and the Buy option is selected', effect: 'open TalkID::HealerBuy', trigger: 'menu-option', refs: [stores('1030-1070'), stores('1876-1896')] },
    ],
    talkTopicOverrides: [{
      topic: 'Q_MUSHROOM',
      gating: 'Q_MUSHROOM == QUEST_ACTIVE; _qlog=true; TOWN_HEALER mapping is TEXT_MUSH3 after the mushroom hand-in and before the brain hand-in clears it',
      lineIds: ['TEXT_MUSH3'], rotates: false,
      refs: [quests('60-64'), towners('352-361'), towners('435-442')],
    }],
    greetingRules: [{
      condition: 'no ordered pre-menu handler matches',
      effect: 'TownerTalk resets cow-click state, speaks TEXT_PEPIN1, then StartStore(TalkID::Healer), whose first action is HealPlayer',
      lineIds: ['TEXT_PEPIN1'], opensMenu: true, refs: [towners('205-210'), towners('447-448'), stores('1018-1043')],
    }],
    firstVisitBehavior: null,
    refs: [towners('413-449'), stores('1018-1070'), stores('1876-1925')],
  },
  {
    towner: 'TOWN_TAVERN', name: 'Ogden', expansion: 'diablo', scope: 'full',
    preMenuHandlers: [
      {
        quest: null,
        condition: '!player._pLvlVisited[0]',
        effect: 'speak TEXT_INTRO before every quest handler; make no state change',
        speechLineIds: ['TEXT_INTRO'], consumesTurn: true, refs: [towners('212-217')],
      },
      {
        quest: 'Q_SKELKING',
        condition: 'Q_SKELKING != QUEST_NOTAVAIL; player._pLvlVisited[2] || player._pLvlVisited[4]; _qvar2 == 0',
        effect: '_qvar2=1; _qlog=true; QUEST_INIT becomes QUEST_ACTIVE with _qvar1=1; speak TEXT_KING2',
        speechLineIds: ['TEXT_KING2'], consumesTurn: true, refs: [towners('219-232')],
      },
      {
        quest: 'Q_SKELKING',
        condition: 'Q_SKELKING != QUEST_NOTAVAIL; player._pLvlVisited[2] || player._pLvlVisited[4]; QUEST_DONE; _qvar2 == 1',
        effect: '_qvar2=2; _qvar1=2; speak TEXT_KING4',
        speechLineIds: ['TEXT_KING4'], consumesTurn: true, refs: [towners('219-240')],
      },
      {
        quest: 'Q_LTBANNER',
        condition: 'Q_LTBANNER != QUEST_NOTAVAIL; Q_LTBANNER != QUEST_DONE; player._pLvlVisited[3] || player._pLvlVisited[4]; _qvar2 == 0',
        effect: '_qvar2=1; QUEST_INIT becomes QUEST_ACTIVE with _qvar1=1; _qlog=true; speak TEXT_BANNER2',
        speechLineIds: ['TEXT_BANNER2'], consumesTurn: true, refs: [towners('243-256')],
      },
      {
        quest: 'Q_LTBANNER',
        condition: 'Q_LTBANNER != QUEST_NOTAVAIL; Q_LTBANNER != QUEST_DONE; player._pLvlVisited[3] || player._pLvlVisited[4]; _qvar2 == 1; remove IDI_BANNER succeeds',
        effect: 'remove IDI_BANNER; QUEST_DONE; _qvar1=3; spawn UITEM_HARCREST; speak TEXT_BANNER3',
        speechLineIds: ['TEXT_BANNER3'], consumesTurn: true, refs: [towners('243-267')],
      },
    ],
    services: [],
    greetingRules: [{
      condition: 'player._pLvlVisited[0] and no later ordered pre-menu handler matches',
      effect: 'TownerTalk resets cow-click state, speaks TEXT_OGDEN1, then StartStore(TalkID::Tavern)',
      lineIds: ['TEXT_OGDEN1'], opensMenu: true, refs: [towners('205-217'), towners('269-271')],
    }],
    firstVisitBehavior: {
      condition: '!player._pLvlVisited[0]', effect: 'speak TEXT_INTRO and return before all quest handlers and the tavern menu',
      lineIds: ['TEXT_INTRO'], consumesTurn: true, refs: [towners('212-217')],
    },
    refs: [towners('212-271'), stores('1247-1258'), stores('2006-2019')],
  },
  {
    towner: 'TOWN_STORY', name: 'Cain', expansion: 'diablo', scope: 'full',
    preMenuHandlers: [
      {
        quest: 'Q_BETRAYER',
        condition: '!UseMultiplayerQuests(); Q_BETRAYER == QUEST_INIT; remove IDI_LAZSTAFF succeeds',
        effect: 'remove IDI_LAZSTAFF; speak TEXT_VILE1; _qlog=true; QUEST_ACTIVE; _qvar1=2',
        speechLineIds: ['TEXT_VILE1'], consumesTurn: true, refs: [towners('457-468')],
      },
      {
        quest: 'Q_BETRAYER',
        condition: 'UseMultiplayerQuests(); Q_BETRAYER == QUEST_ACTIVE; !_qlog',
        effect: 'speak TEXT_VILE1; _qlog=true',
        speechLineIds: ['TEXT_VILE1'], consumesTurn: true, refs: [towners('469-476')],
      },
      {
        quest: 'Q_BETRAYER',
        condition: 'Q_BETRAYER == QUEST_DONE; _qvar1 == 7',
        effect: 'Q_BETRAYER._qvar1=8; speak TEXT_VILE3; Q_DIABLO._qlog=true',
        speechLineIds: ['TEXT_VILE3'], consumesTurn: true, refs: [towners('477-487')],
      },
    ],
    services: [{
      service: 'identify', condition: 'fallback menu opens; selected equipped or inventory item is non-normal and unidentified; player can pay the fee',
      effect: 'take identification fee; mark selected item identified; recalculate inventory effects', trigger: 'menu-option',
      refs: [stores('1072-1188'), stores('1797-1823'), stores('1927-1966')],
    }],
    greetingRules: [{
      condition: 'no ordered pre-menu handler matches',
      effect: 'TownerTalk resets cow-click state, speaks TEXT_STORY1, then StartStore(TalkID::Storyteller)',
      lineIds: ['TEXT_STORY1'], opensMenu: true, refs: [towners('205-210'), towners('489-491')],
    }],
    firstVisitBehavior: null,
    refs: [towners('457-491'), stores('1072-1202'), stores('1927-1966')],
  },
  {
    towner: 'TOWN_BMAID', name: 'Gillian', expansion: 'diablo', scope: 'full',
    preMenuHandlers: [{
      quest: 'Q_GRAVE',
      condition: '!player._pLvlVisited[21]; player carries IDI_MAPOFDOOM; Q_GRAVE._qmsg != TEXT_GRAVE8',
      effect: 'Q_GRAVE=QUEST_ACTIVE; _qlog=true; _qmsg=TEXT_GRAVE8; speak TEXT_GRAVE8',
      speechLineIds: ['TEXT_GRAVE8'], consumesTurn: true, refs: [towners('392-401')],
    }],
    services: [{
      service: 'storage', condition: 'fallback menu opens and Access Storage is selected',
      effect: 'close the dialog, open the stash, refresh item stat flags, and focus inventory for controller input', trigger: 'menu-option',
      refs: [stores('1260-1271'), stores('2021-2045')],
    }],
    greetingRules: [{
      condition: 'the Q_GRAVE pre-menu handler does not match',
      effect: 'TownerTalk resets cow-click state, speaks TEXT_GILLIAN1, then StartStore(TalkID::Barmaid)',
      lineIds: ['TEXT_GILLIAN1'], opensMenu: true, refs: [towners('205-210'), towners('403-405')],
    }],
    firstVisitBehavior: null,
    refs: [towners('392-405'), stores('1260-1271'), stores('2021-2045')],
  },
  {
    towner: 'TOWN_DRUNK', name: 'Farnham', expansion: 'diablo', scope: 'full',
    preMenuHandlers: [], services: [],
    greetingRules: [{
      condition: 'every interaction',
      effect: 'TownerTalk resets cow-click state, speaks TEXT_FARNHAM1, then StartStore(TalkID::Drunk)',
      lineIds: ['TEXT_FARNHAM1'], opensMenu: true, refs: [towners('205-210'), towners('407-411')],
    }],
    firstVisitBehavior: null,
    refs: [towners('407-411'), stores('1273-1283'), stores('2047-2060')],
  },
  {
    towner: 'TOWN_WITCH', name: 'Adria', expansion: 'diablo', scope: 'full',
    preMenuHandlers: [
      {
        quest: 'Q_MUSHROOM',
        condition: 'Q_MUSHROOM != QUEST_NOTAVAIL; Q_MUSHROOM == QUEST_INIT; remove IDI_FUNGALTM succeeds',
        effect: 'remove IDI_FUNGALTM; QUEST_ACTIVE; _qlog=true; _qvar1=QS_TOMEGIVEN; speak TEXT_MUSH8',
        speechLineIds: ['TEXT_MUSH8'], consumesTurn: true, refs: [towners('341-351')],
      },
      {
        quest: 'Q_MUSHROOM',
        condition: 'Q_MUSHROOM == QUEST_ACTIVE; _qvar1 >= QS_TOMEGIVEN and < QS_MUSHGIVEN; remove IDI_MUSHROOM succeeds',
        effect: 'remove IDI_MUSHROOM; _qvar1=QS_MUSHGIVEN; set TOWN_HEALER topic to TEXT_MUSH3 and TOWN_WITCH topic to TEXT_NONE; _qmsg=TEXT_MUSH10; speak TEXT_MUSH10',
        speechLineIds: ['TEXT_MUSH10'], consumesTurn: true, refs: [towners('352-362')],
      },
      {
        quest: 'Q_MUSHROOM',
        condition: 'Q_MUSHROOM == QUEST_ACTIVE; _qvar1 >= QS_TOMEGIVEN and < QS_MUSHGIVEN; player lacks removable IDI_MUSHROOM; _qmsg != TEXT_MUSH9',
        effect: '_qmsg=TEXT_MUSH9; speak TEXT_MUSH9',
        speechLineIds: ['TEXT_MUSH9'], consumesTurn: true, refs: [towners('352-369')],
      },
      {
        quest: 'Q_MUSHROOM',
        condition: 'Q_MUSHROOM == QUEST_ACTIVE; _qvar1 >= QS_MUSHGIVEN; player carries IDI_BRAIN; _qvar2 != TEXT_MUSH11',
        effect: '_qmsg=TEXT_MUSH11; _qvar2=TEXT_MUSH11; speak TEXT_MUSH11; do not take IDI_BRAIN',
        speechLineIds: ['TEXT_MUSH11'], consumesTurn: true, refs: [towners('370-377')],
      },
      {
        quest: 'Q_MUSHROOM',
        condition: 'Q_MUSHROOM == QUEST_ACTIVE; _qvar1 >= QS_MUSHGIVEN; player carries IDI_SPECELIX in inventory or belt',
        effect: 'QUEST_DONE; speak TEXT_MUSH12; retain IDI_SPECELIX',
        speechLineIds: ['TEXT_MUSH12'], consumesTurn: true, refs: [towners('370-384')],
      },
    ],
    services: [
      { service: 'buy', condition: 'fallback menu opens and Buy is selected', effect: 'open TalkID::WitchBuy', trigger: 'menu-option', refs: [stores('690-754'), stores('1531-1575')] },
      { service: 'sell', condition: 'fallback menu opens and item passes WitchWillBuy', effect: 'sell eligible inventory or belt item', trigger: 'menu-option', refs: [stores('756-834'), stores('1531-1575'), stores('2888-2909')] },
      { service: 'recharge', condition: 'fallback menu opens; eligible equipped left-hand or inventory charged item is below maximum', effect: 'take recharge price and restore maximum charges', trigger: 'menu-option', refs: [stores('836-907'), stores('1648-1692')] },
    ],
    talkTopicOverrides: [{
      topic: 'Q_MUSHROOM',
      gating: 'Q_MUSHROOM == QUEST_ACTIVE; _qlog=true; TOWN_WITCH mapping is TEXT_MUSH9 until the mushroom hand-in changes it to TEXT_NONE',
      lineIds: ['TEXT_MUSH9'], rotates: false,
      refs: [quests('60-64'), towners('352-361')],
    }],
    greetingRules: [{
      condition: 'no ordered pre-menu handler matches',
      effect: 'TownerTalk resets cow-click state, speaks TEXT_ADRIA1, then StartStore(TalkID::Witch)',
      lineIds: ['TEXT_ADRIA1'], opensMenu: true, refs: [towners('205-210'), towners('388-390')],
    }],
    firstVisitBehavior: null,
    refs: [towners('341-390'), stores('690-907'), stores('1531-1692')],
  },
  {
    towner: 'TOWN_PEGBOY', name: 'Wirt', expansion: 'diablo', scope: 'full',
    preMenuHandlers: [],
    services: [
      { service: 'inspect', condition: 'BoyItem exists; fallback menu opens; player selects the offer and can pay the inspection fee', effect: 'take the inspection fee before showing BoyItem', trigger: 'menu-option', refs: [stores('971-1016'), stores('1694-1723')] },
      { service: 'buy', condition: 'BoyItem was inspected; player can pay its adjusted price and has inventory room', effect: 'take the purchase price, place BoyItem, and clear its store slot', trigger: 'menu-option', refs: [stores('1725-1733'), stores('1766-1795')] },
    ],
    greetingRules: [{
      condition: 'every interaction',
      effect: 'TownerTalk resets cow-click state, speaks TEXT_WIRT1, then StartStore(TalkID::Boy)',
      lineIds: ['TEXT_WIRT1'], opensMenu: true, refs: [towners('205-210'), towners('451-455')],
    }],
    firstVisitBehavior: null,
    refs: [towners('451-455'), stores('971-1016'), stores('1694-1795')],
  },
  {
    towner: 'TOWN_DEADGUY', name: 'Wounded Townsman', expansion: 'diablo', scope: 'full',
    preMenuHandlers: [
      {
        quest: 'Q_BUTCHER', condition: 'Q_BUTCHER == QUEST_DONE', effect: 'return silently',
        speechLineIds: [], consumesTurn: true, refs: [towners('273-278')],
      },
      {
        quest: 'Q_BUTCHER', condition: 'Q_BUTCHER != QUEST_DONE; _qvar1 == 1', effect: 'request HeroSpeech::YourDeathWillBeAvenged; make no quest-state change',
        speechLineIds: ['HeroSpeech::YourDeathWillBeAvenged'], consumesTurn: true, refs: [towners('279-282')],
      },
      {
        quest: 'Q_BUTCHER', condition: 'Q_BUTCHER != QUEST_DONE; _qvar1 != 1', effect: 'QUEST_ACTIVE; _qlog=true; _qmsg=TEXT_BUTCH9; _qvar1=1; speak TEXT_BUTCH9',
        speechLineIds: ['TEXT_BUTCH9'], consumesTurn: true, refs: [towners('283-290')],
      },
    ],
    services: [], greetingRules: [], firstVisitBehavior: null,
    refs: [towners('191-203'), towners('273-290'), quests('241-246')],
  },
  {
    towner: 'TOWN_COW', name: 'Cow', expansion: 'diablo', scope: 'full',
    preMenuHandlers: [
      {
        quest: null, condition: 'CowPlaying != SfxID::None and its effect is still playing', effect: 'ignore the click and return',
        speechLineIds: [], consumesTurn: true, refs: [towners('493-497')],
      },
      {
        quest: null, condition: 'no cow effect is playing; incremented CowClicks is not 4 and is below 8', effect: 'play SfxID::Cow1 at the cow',
        speechLineIds: [], consumesTurn: true, refs: [towners('498-520')],
      },
      {
        quest: null, condition: 'no cow effect is playing; incremented CowClicks == 4', effect: 'play SfxID::Cow2; shareware resets CowClicks to 0',
        speechLineIds: [], consumesTurn: true, refs: [towners('498-506'), towners('520-521')],
      },
      {
        quest: null, condition: 'no cow effect is playing; CowClicks >= 8; !gbIsSpawn', effect: 'set CowClicks=4; rotate CowMsg through three class-resolved HeroSpeech ids; play SfxID::Cow1',
        speechLineIds: ['HeroSpeech::YepThatsACowAlright', 'HeroSpeech::ImNotThirsty', 'HeroSpeech::ImNoMilkmaid'],
        consumesTurn: true, refs: [towners('498-521')],
      },
    ],
    services: [], greetingRules: [], firstVisitBehavior: null,
    refs: [towners('26-31'), towners('140-171'), towners('493-521')],
  },
  {
    towner: 'TOWN_FARMER', name: 'Lester', expansion: 'hellfire', scope: 'flag-only',
    preMenuHandlers: [], services: [], greetingRules: [], firstVisitBehavior: null,
    refs: [towners('523-577'), towners('697-699'), towners('735-748')],
    note: 'Hellfire-only towner; detailed behaviour is outside this ledger wave.',
  },
  {
    towner: 'TOWN_COWFARM', name: 'Complete Nut', expansion: 'hellfire', scope: 'flag-only',
    preMenuHandlers: [], services: [], greetingRules: [], firstVisitBehavior: null,
    refs: [towners('173-189'), towners('579-649'), towners('697-699'), towners('735-748')],
    note: 'Hellfire-only towner; detailed behaviour is outside this ledger wave.',
  },
  {
    towner: 'TOWN_GIRL', name: 'Celia', expansion: 'hellfire', scope: 'flag-only',
    preMenuHandlers: [], services: [], greetingRules: [], firstVisitBehavior: null,
    refs: [towners('651-682'), towners('697-699'), towners('735-748')],
    note: 'Hellfire-only towner; detailed behaviour is outside this ledger wave.',
  },
];
