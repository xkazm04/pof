/** Engine-derived Diablo I unique-monster talk machines; ids and behavior only. */
import type { MonsterTalkSpec } from '@/lib/catalog/reference/monsterTalk';

// TEXT_VILE14 is not a talk state at this pin: player.cpp only treats it as an
// attackable-message sentinel, and no engine routine assigns it to either Lazarus minion.
export const D1_MONSTER_TALK_SPECS: readonly MonsterTalkSpec[] = [
  {
    monster: 'd1-uniq-gharbad-the-weak', quest: 'Q_GARBUD', terminal: 'hostility',
    states: [
      { id: 'offer', line: 'TEXT_GARBUD1', enters: 'initial talkMsg; player interacts while Inquiring', exits: 'speaker leaves visibility after the line while Talking', effect: 'QUEST_ACTIVE; _qlog=true' },
      { id: 'first-reward', line: 'TEXT_GARBUD2', enters: 'previous visibility exit selects this line and Inquiring', exits: 'speaker leaves visibility after the line while Talking', effect: 'first interaction spawns deterministic random loot; _qvar1=QS_GHARBAD_FIRST_ITEM_SPAWNED' },
      { id: 'waiting', line: 'TEXT_GARBUD3', enters: 'previous visibility exit selects this line and Inquiring', exits: 'speaker leaves visibility after the line while Talking', effect: '_qvar1 advances from QS_GHARBAD_SECOND_ITEM_NEARLY_DONE to QS_GHARBAD_SECOND_ITEM_READY on exit' },
      { id: 'attack', line: 'TEXT_GARBUD4', enters: 'previous visibility exit selects this line and Inquiring', exits: 'speech SFX is no longer playing while visible and Talking', effect: 'talkMsg=TEXT_NONE; goal=Normal; _qvar1=QS_GHARBAD_ATTACKING; hostility' },
    ],
    refs: ['Source/monster.cpp:2578-2627', 'Source/monster.cpp:4789-4802', 'Source/quests.cpp:509-538'],
  },
  {
    monster: 'd1-uniq-zhar-the-mad', quest: 'Q_ZHAR', terminal: 'hostility',
    states: [
      { id: 'warning', line: 'TEXT_ZHAR1', enters: 'initial talkMsg; player interacts while Inquiring', exits: 'speaker leaves visibility after the line while Talking', effect: 'QUEST_ACTIVE; _qlog=true; deterministic book spawned; _qvar1=QS_ZHAR_ITEM_SPAWNED' },
      { id: 'attack', line: 'TEXT_ZHAR2', enters: 'previous visibility exit selects this line and Inquiring', exits: 'speech SFX is no longer playing while visible and Talking', effect: 'talkMsg=TEXT_NONE; goal=Normal; _qvar1=QS_ZHAR_ATTACKING; hostility' },
    ],
    refs: ['Source/monster.cpp:2786-2815', 'Source/monster.cpp:4774-4786', 'Source/quests.cpp:540-559'],
  },
  {
    monster: 'd1-uniq-snotspill', quest: 'Q_LTBANNER', terminal: 'hostility',
    states: [
      { id: 'offer', line: 'TEXT_BANNER10', enters: 'initial talkMsg; player interacts while Inquiring', exits: 'speaker leaves visibility after the line while Talking', effect: 'first map section opens; QUEST_INIT becomes QUEST_ACTIVE; _qvar1=2' },
      { id: 'banner-request', line: 'TEXT_BANNER11', enters: 'previous visibility exit selects this line and Inquiring', exits: 'player interacts at _qvar1=2 and IDI_BANNER is removed', effect: 'QUEST_DONE; talkMsg=TEXT_BANNER12; goal=Inquiring' },
      { id: 'banner-returned', line: 'TEXT_BANNER12', enters: 'banner hand-in selects this line', exits: 'speech SFX is no longer playing while visible and Talking', effect: 'full map opens; _qvar1=3; talkMsg=TEXT_NONE; goal=Normal; hostility' },
    ],
    refs: ['Source/monster.cpp:1427-1467', 'Source/monster.cpp:2630-2666', 'Source/monster.cpp:4747-4759', 'Source/quests.cpp:404-445'],
  },
  {
    monster: 'd1-uniq-arch-bishop-lazarus', quest: 'Q_BETRAYER', terminal: 'hostility',
    states: [
      { id: 'greeting', line: 'TEXT_VILE13', enters: 'single player: visible, Inquiring, player at tile {35,46}; multiplayer quests: visible, Inquiring, _qvar1<=3', exits: 'single player: speech SFX ends while visible and Talking; multiplayer: MonsterTalk completes immediately', effect: 'single player opens the map and sets _qvar1=6; multiplayer sets _qvar1=6; talkMsg=TEXT_NONE; goal=Normal; hostility' },
    ],
    refs: ['Source/monster.cpp:1427-1467', 'Source/monster.cpp:2879-2925', 'Source/monster.cpp:3325-3363'],
  },
  {
    monster: 'd1-uniq-red-vex', quest: 'Q_BETRAYER', terminal: 'hostility',
    states: [
      { id: 'greeting', line: 'TEXT_VILE13', enters: 'single player: visible with _qvar1<=5, which forces Inquiring; player interacts', exits: 'Lazarus progression reaches _qvar1>5 while the minion is visible', effect: 'talkMsg=TEXT_NONE; goal=Normal; hostility; multiplayer suppresses this talkMsg at initialization' },
    ],
    refs: ['Source/monster.cpp:1427-1433', 'Source/monster.cpp:2928-2950', 'Source/monster.cpp:3325-3363', 'Source/monster.cpp:4747-4750'],
  },
  {
    monster: 'd1-uniq-black-jade', quest: 'Q_BETRAYER', terminal: 'hostility',
    states: [
      { id: 'greeting', line: 'TEXT_VILE13', enters: 'single player: visible with _qvar1<=5, which forces Inquiring; player interacts', exits: 'Lazarus progression reaches _qvar1>5 while the minion is visible', effect: 'talkMsg=TEXT_NONE; goal=Normal; hostility; multiplayer suppresses this talkMsg at initialization' },
    ],
    refs: ['Source/monster.cpp:1427-1433', 'Source/monster.cpp:2928-2950', 'Source/monster.cpp:3325-3363', 'Source/monster.cpp:4747-4750'],
  },
  {
    monster: 'd1-uniq-lachdanan', quest: 'Q_VEIL', terminal: 'removal and quest completion',
    states: [
      { id: 'request', line: 'TEXT_VEIL9', enters: 'initial talkMsg; player interacts while Inquiring', exits: 'speaker leaves visibility after the line while Talking', effect: 'QUEST_ACTIVE; _qlog=true' },
      { id: 'early-return', line: 'TEXT_VEIL10', enters: 'previous visibility exit selects this line and Inquiring', exits: 'player interacts with talkMsg>=TEXT_VEIL9 and IDI_GLDNELIX is removed', effect: 'UITEM_STEELVEIL spawned; _qvar2=QS_VEIL_ITEM_SPAWNED; talkMsg=TEXT_VEIL11' },
      { id: 'release', line: 'TEXT_VEIL11', enters: 'elixir hand-in selects this line and Inquiring', exits: 'speech SFX is no longer playing while visible and Talking', effect: 'QUEST_DONE; monster death and removal' },
    ],
    refs: ['Source/monster.cpp:1427-1457', 'Source/monster.cpp:2953-2981', 'Source/monster.cpp:4761-4772', 'Source/quests.cpp:569-585'],
  },
  {
    monster: 'd1-uniq-warlord-of-blood', quest: 'Q_WARLORD', terminal: 'hostility',
    states: [
      { id: 'confrontation', line: 'TEXT_WARLRD9', enters: 'visible while Inquiring automatically starts Talk mode', exits: 'speech SFX is no longer playing while visible and Talking', effect: '_qvar1 advances through QS_WARLORD_TALKING to QS_WARLORD_ATTACKING; talkMsg=TEXT_NONE; goal=Normal; hostility' },
    ],
    refs: ['Source/monster.cpp:1427-1461', 'Source/monster.cpp:2984-3006', 'Source/quests.cpp:561-568'],
  },
];
