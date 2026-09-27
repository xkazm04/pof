/** Pinned engine causality only: identifiers and code conditions, never dialogue prose or table rows. */
import type {
  QuestCausalityDependency,
  QuestCausalityEventKind,
  QuestCausalityLedgerData,
  QuestCausalityTransition,
  QuestSpecCausalityFinding,
} from '@/lib/catalog/reference/questCausality';
import type { QuestId } from '@/lib/catalog/reference/questSpecs';

const ref = (file: string, lines: string) => `.reference/devilutionX/Source/${file}:${lines}`;

const transition = (
  id: string,
  kind: QuestCausalityEventKind,
  subject: string,
  guard: string,
  effect: string,
  ...refs: string[]
): QuestCausalityTransition => ({ id, trigger: { kind, subject }, guard, effect, refs });

const ledger = (
  questId: QuestId,
  initialState: string,
  startTransitionIds: readonly string[],
  completionTransitionIds: readonly string[],
  transitions: readonly QuestCausalityTransition[],
  flags: readonly string[] = [],
): QuestCausalityLedgerData => ({
  questId,
  scope: 'vanilla-single-player',
  initialState,
  startTransitionIds,
  completionTransitionIds,
  transitions,
  flags,
});

export const D1_QUEST_CAUSALITY_DATA: Record<QuestId, QuestCausalityLedgerData> = {
  'd1-Q_ROCK': ledger(
    'd1-Q_ROCK',
    'Q_ROCK: _qactive=QUEST_INIT; _qvar1=0; _qvar2=0; _qlog=false',
    ['pick-up-rock', 'smith-briefing'],
    ['hand-in-rock'],
    [
      transition(
        'spawn-rock', 'level-entered', 'Q_ROCK._qlevel',
        '!setlevel; Q_ROCK.IsAvailable(); an OBJ_STAND was placed',
        'SpawnRock creates IDI_ROCK on OBJ_STAND; quest state is unchanged.',
        ref('items.cpp', '1589-1607'), ref('items.cpp', '2451-2456'),
      ),
      transition(
        'pick-up-rock', 'item-picked-up', 'IDI_ROCK',
        'Q_ROCK._qactive != QUEST_NOTAVAIL',
        'If _qactive==QUEST_INIT, set _qactive=QUEST_ACTIVE; _qlog and _qvar2 are unchanged.',
        ref('inv.cpp', '993-1032'),
      ),
      transition(
        'smith-briefing', 'talk-to-towner', 'TOWN_SMITH',
        'Q_ROCK is available and not QUEST_DONE; player visited floor 4 or 5; _qvar2==0',
        'Set _qvar2=1 and _qlog=true; QUEST_INIT becomes QUEST_ACTIVE; start TEXT_INFRA5.',
        ref('towners.cpp', '292-305'),
      ),
      transition(
        'hand-in-rock', 'item-handed-in', 'IDI_ROCK -> TOWN_SMITH',
        'Q_ROCK is available and not QUEST_DONE; _qvar2==1; RemoveInventoryItemById succeeds',
        'Remove IDI_ROCK; set _qactive=QUEST_DONE; spawn UITEM_INFRARING; start TEXT_INFRA7.',
        ref('towners.cpp', '292-315'),
      ),
    ],
  ),

  'd1-Q_MUSHROOM': ledger(
    'd1-Q_MUSHROOM',
    'Q_MUSHROOM: _qactive=QUEST_INIT; _qvar1=QS_INIT; _qvar2=0; _qlog=false',
    ['hand-in-fungal-tome'],
    ['carry-spectral-elixir'],
    [
      transition(
        'spawn-fungal-tome', 'level-entered', 'Q_MUSHROOM._qlevel',
        '!setlevel; _qactive==QUEST_INIT; _qvar1==QS_INIT',
        'Spawn IDI_FUNGALTM and set _qvar1=QS_TOMESPAWNED.',
        ref('quests.cpp', '449-453'),
      ),
      transition(
        'hand-in-fungal-tome', 'item-handed-in', 'IDI_FUNGALTM -> TOWN_WITCH',
        '_qactive==QUEST_INIT; RemoveInventoryItemById succeeds',
        'Remove IDI_FUNGALTM; set _qactive=QUEST_ACTIVE, _qlog=true, _qvar1=QS_TOMEGIVEN; start TEXT_MUSH8.',
        ref('towners.cpp', '341-351'),
      ),
      transition(
        'operate-mushroom-patch', 'object-operated', 'OBJ_MUSHPATCH',
        '_qactive==QUEST_ACTIVE; object is interactable; item capacity remains',
        'Disable the patch; spawn IDI_MUSHROOM; set _qvar1=QS_MUSHSPAWNED.',
        ref('objects.cpp', '2073-2101'),
      ),
      transition(
        'pick-up-mushroom', 'item-picked-up', 'IDI_MUSHROOM',
        '_qactive==QUEST_ACTIVE; _qvar1==QS_MUSHSPAWNED',
        'Set _qvar1=QS_MUSHPICKED and play the hero pickup speech.',
        ref('inv.cpp', '993-1008'),
      ),
      transition(
        'hand-in-mushroom', 'item-handed-in', 'IDI_MUSHROOM -> TOWN_WITCH',
        '_qactive==QUEST_ACTIVE; QS_TOMEGIVEN <= _qvar1 < QS_MUSHGIVEN; removal succeeds',
        'Remove IDI_MUSHROOM; set _qvar1=QS_MUSHGIVEN and _qmsg=TEXT_MUSH10; enable the TOWN_HEALER topic and clear the TOWN_WITCH topic; start TEXT_MUSH10.',
        ref('towners.cpp', '352-369'),
      ),
      transition(
        'spawn-brain', 'monster-killed', 'eligible ordinary monster',
        '_qactive==QUEST_ACTIVE; _qvar1==QS_MUSHGIVEN; ordinary drop path executes',
        'Set _qvar1=QS_BRAINSPAWNED; replace the single-player normal drop with IDI_BRAIN.',
        ref('items.cpp', '3422-3453'),
      ),
      transition(
        'witch-notices-brain', 'item-carried', 'IDI_BRAIN at TOWN_WITCH',
        '_qactive==QUEST_ACTIVE; _qvar1>=QS_MUSHGIVEN; IDI_BRAIN is in inventory; _qvar2!=TEXT_MUSH11',
        'Set _qmsg=TEXT_MUSH11 and _qvar2=TEXT_MUSH11; start TEXT_MUSH11; do not remove the brain.',
        ref('towners.cpp', '370-377'),
      ),
      transition(
        'hand-in-brain', 'item-handed-in', 'IDI_BRAIN -> TOWN_HEALER',
        '_qactive==QUEST_ACTIVE; QS_MUSHGIVEN <= _qvar1 < QS_BRAINGIVEN; removal succeeds',
        'Remove IDI_BRAIN; spawn IDI_SPECELIX; set _qvar1=QS_BRAINGIVEN; clear the TOWN_HEALER topic; start TEXT_MUSH4.',
        ref('towners.cpp', '413-445'),
      ),
      transition(
        'carry-spectral-elixir', 'item-carried', 'IDI_SPECELIX at TOWN_WITCH',
        '_qactive==QUEST_ACTIVE; _qvar1>=QS_MUSHGIVEN; IDI_SPECELIX is in inventory or belt',
        'Set _qactive=QUEST_DONE and start TEXT_MUSH12; retain IDI_SPECELIX, which is now usable.',
        ref('towners.cpp', '370-383'), ref('items.cpp', '4800-4804'),
      ),
    ],
    ['The multiplayer-only pre-spawn and extra-drop branches are flagged but not expanded.'],
  ),

  'd1-Q_GARBUD': ledger(
    'd1-Q_GARBUD',
    'Q_GARBUD: _qactive=QUEST_INIT; _qvar1=QS_GHARBAD_INIT; _qlog=false',
    ['first-talk'],
    ['kill-garbud'],
    [
      transition(
        'first-talk', 'talk-to-monster', 'UniqueMonsterType::Garbud / TEXT_GARBUD1',
        'local player talks while talkMsg==TEXT_GARBUD1',
        'Set _qactive=QUEST_ACTIVE and _qlog=true; MonsterTalk starts TEXT_GARBUD1.',
        ref('monster.cpp', '4747-4751'), ref('monster.cpp', '4789-4794'), ref('monster.cpp', '1427-1433'),
      ),
      transition(
        'first-item-ready', 'monster-left-visibility', 'UniqueMonsterType::Garbud',
        'talkMsg==TEXT_GARBUD1; goal==MonsterGoal::Talking; tile is not visible',
        'Set talkMsg=TEXT_GARBUD2, goal=MonsterGoal::Inquiring, and _qvar1=QS_GHARBAD_FIRST_ITEM_READY.',
        ref('monster.cpp', '2578-2596'),
      ),
      transition(
        'spawn-first-item', 'talk-to-monster', 'UniqueMonsterType::Garbud / TEXT_GARBUD2',
        'local player talks; MFLAG_QUEST_COMPLETE is clear',
        'Spawn the deterministic monster item; set MFLAG_QUEST_COMPLETE and _qvar1=QS_GHARBAD_FIRST_ITEM_SPAWNED.',
        ref('monster.cpp', '4789-4802'),
      ),
      transition(
        'second-item-nearly-done', 'monster-left-visibility', 'UniqueMonsterType::Garbud',
        'talkMsg==TEXT_GARBUD2; goal==MonsterGoal::Talking; tile is not visible',
        'Set talkMsg=TEXT_GARBUD3, goal=MonsterGoal::Inquiring, and _qvar1=QS_GHARBAD_SECOND_ITEM_NEARLY_DONE.',
        ref('monster.cpp', '2586-2601'),
      ),
      transition(
        'second-item-ready', 'monster-left-visibility', 'UniqueMonsterType::Garbud',
        'talkMsg==TEXT_GARBUD3; goal==MonsterGoal::Talking; tile is not visible',
        'Set talkMsg=TEXT_GARBUD4, goal=MonsterGoal::Inquiring, and _qvar1=QS_GHARBAD_SECOND_ITEM_READY.',
        ref('monster.cpp', '2586-2606'),
      ),
      transition(
        'garbud-hostile', 'speech-finished', 'TEXT_GARBUD4',
        'Garbud is visible; talkMsg==TEXT_GARBUD4; goal==MonsterGoal::Talking; SfxID::Gharbad4 is not playing',
        'Clear talkMsg; set goal=MonsterGoal::Normal, activeForTicks=UINT8_MAX, and _qvar1=QS_GHARBAD_ATTACKING.',
        ref('monster.cpp', '2612-2620'),
      ),
      transition(
        'kill-garbud', 'monster-killed', 'UniqueMonsterType::Garbud',
        'Garbud is killed',
        'Spawn the Garbud death item, then set Q_GARBUD._qactive=QUEST_DONE and play the hero kill speech.',
        ref('monster.cpp', '911-919'), ref('quests.cpp', '247-250'), ref('monster.cpp', '3996-4028'),
      ),
    ],
    ['Multiplayer resynchronization of talkMsg and MonsterGoal is flagged but not expanded.'],
  ),

  'd1-Q_ZHAR': ledger(
    'd1-Q_ZHAR',
    'Q_ZHAR: _qactive=QUEST_INIT; _qvar1=QS_ZHAR_INIT; _qlog=false',
    ['first-talk', 'operate-library-bookcase'],
    ['kill-zhar'],
    [
      transition(
        'first-talk', 'talk-to-monster', 'UniqueMonsterType::Zhar / TEXT_ZHAR1',
        'talkMsg==TEXT_ZHAR1; MFLAG_QUEST_COMPLETE is clear; local player talks',
        'Set _qactive=QUEST_ACTIVE, _qlog=true, _qvar1=QS_ZHAR_ITEM_SPAWNED; spawn a deterministic IMISC_BOOK; set MFLAG_QUEST_COMPLETE.',
        ref('monster.cpp', '4774-4786'),
      ),
      transition(
        'zhar-angry', 'monster-left-visibility', 'UniqueMonsterType::Zhar',
        'talkMsg==TEXT_ZHAR1; goal==MonsterGoal::Talking; tile is not visible',
        'Set talkMsg=TEXT_ZHAR2, goal=MonsterGoal::Inquiring, and _qvar1=QS_ZHAR_ANGRY.',
        ref('monster.cpp', '2786-2798'),
      ),
      transition(
        'operate-library-bookcase', 'object-operated', 'Zhar library bookcase',
        'Q_ZHAR.IsAvailable(); Zhar is standing, active, alive, and occupies the reserved unique slot',
        'Spawn a book from the bookcase; set Zhar talkMsg=TEXT_ZHAR2 and goal=MonsterGoal::Attack; start his talk mode without activating or logging Q_ZHAR.',
        ref('objects.cpp', '3128-3154'),
      ),
      transition(
        'zhar-hostile', 'speech-finished', 'TEXT_ZHAR2',
        'Zhar is visible; talkMsg==TEXT_ZHAR2; goal==MonsterGoal::Talking; SfxID::Zhar2 is not playing',
        'Clear talkMsg; set goal=MonsterGoal::Normal, activeForTicks=UINT8_MAX, and _qvar1=QS_ZHAR_ATTACKING.',
        ref('monster.cpp', '2800-2808'),
      ),
      transition(
        'kill-zhar', 'monster-killed', 'UniqueMonsterType::Zhar',
        'Zhar is killed',
        'Set Q_ZHAR._qactive=QUEST_DONE and play the hero kill speech.',
        ref('quests.cpp', '251-254'), ref('monster.cpp', '3996-4028'),
      ),
    ],
    ['If no Zhar library was placed, the unstarted quest becomes QUEST_NOTAVAIL; this is availability, not accepted-quest failure.'],
  ),

  'd1-Q_VEIL': ledger(
    'd1-Q_VEIL',
    'Q_VEIL: _qactive=QUEST_INIT; _qvar1=0; _qvar2=QS_VEIL_INIT; _qlog=false',
    ['first-talk'],
    ['finish-final-speech'],
    [
      transition(
        'first-talk', 'talk-to-monster', 'UniqueMonsterType::Lachdan / TEXT_VEIL9',
        'MonsterTalk starts while talkMsg==TEXT_VEIL9',
        'Set _qactive=QUEST_ACTIVE and _qlog=true; start TEXT_VEIL9.',
        ref('monster.cpp', '1427-1456'),
      ),
      transition(
        'early-return', 'monster-left-visibility', 'UniqueMonsterType::Lachdan',
        'talkMsg==TEXT_VEIL9; goal==MonsterGoal::Talking; tile is not visible',
        'Set talkMsg=TEXT_VEIL10, goal=MonsterGoal::Inquiring, and _qvar2=QS_VEIL_EARLY_RETURN.',
        ref('monster.cpp', '2953-2966'),
      ),
      transition(
        'spawn-golden-elixir', 'level-entered', 'Q_VEIL._qlevel + 1',
        '_qactive==QUEST_ACTIVE; _qvar1==0; !gbIsMultiplayer',
        'Set _qvar1=1 and spawn IDI_GLDNELIX.',
        ref('quests.cpp', '465-469'),
      ),
      transition(
        'pick-up-golden-elixir', 'item-picked-up', 'IDI_GLDNELIX',
        'Q_VEIL._qactive != QUEST_NOTAVAIL',
        'Play the hero carry-to-Lachdanan speech; quest state is unchanged.',
        ref('inv.cpp', '1020-1022'),
      ),
      transition(
        'hand-in-golden-elixir', 'item-handed-in', 'IDI_GLDNELIX -> UniqueMonsterType::Lachdan',
        'Q_VEIL.IsAvailable(); talkMsg>=TEXT_VEIL9; removal succeeds; MFLAG_QUEST_COMPLETE is clear',
        'Remove IDI_GLDNELIX; immediately spawn UITEM_STEELVEIL; set _qvar2=QS_VEIL_ITEM_SPAWNED, talkMsg=TEXT_VEIL11, goal=MonsterGoal::Inquiring, and MFLAG_QUEST_COMPLETE.',
        ref('monster.cpp', '4761-4771'),
      ),
      transition(
        'finish-final-speech', 'speech-finished', 'TEXT_VEIL11',
        'Lachdan is visible; talkMsg==TEXT_VEIL11; goal==MonsterGoal::Talking; SfxID::Lachdanan3 is not playing',
        'Clear talkMsg; set Q_VEIL._qactive=QUEST_DONE; script Lachdan death and synchronize his removal.',
        ref('monster.cpp', '2968-2977'),
      ),
    ],
    ['Multiplayer pre-spawn and resynchronization branches are flagged but not expanded.'],
  ),

  'd1-Q_DIABLO': ledger(
    'd1-Q_DIABLO',
    'Q_DIABLO: _qactive=QUEST_INIT; _qlog=false',
    ['lazarus-kill-activates'],
    ['kill-diablo'],
    [
      transition(
        'lazarus-kill-activates', 'other-quest-state', 'Q_BETRAYER / UniqueMonsterType::Lazarus killed',
        'CheckQuestKill dispatches the Lazarus unique kill',
        'Set Q_DIABLO._qactive=QUEST_ACTIVE; single-player also initializes the onward triggers.',
        ref('quests.cpp', '255-281'),
      ),
      transition(
        'cain-reveals-journal', 'talk-to-towner', 'TOWN_STORY',
        'Q_BETRAYER._qactive==QUEST_DONE; Q_BETRAYER._qvar1==7',
        'Set Q_BETRAYER._qvar1=8 and Q_DIABLO._qlog=true; start TEXT_VILE3.',
        ref('towners.cpp', '477-486'),
      ),
      transition(
        'kill-diablo', 'monster-killed', 'MT_DIABLO',
        'Diablo is killed',
        'Set Q_DIABLO._qactive=QUEST_DONE; begin the ending state, kill other active monsters, and record the single-player kill difficulty.',
        ref('monster.cpp', '875-909'), ref('monster.cpp', '3996-4028'),
      ),
    ],
    ['The multiplayer-only pentagram map synchronization branch is flagged but not expanded.'],
  ),

  'd1-Q_BUTCHER': ledger(
    'd1-Q_BUTCHER',
    'Q_BUTCHER: _qactive=QUEST_INIT; _qvar1=0; _qlog=false',
    ['dead-townsman-briefing'],
    ['kill-butcher'],
    [
      transition(
        'dead-townsman-briefing', 'talk-to-towner', 'TOWN_DEADGUY',
        '_qactive!=QUEST_DONE; _qvar1!=1',
        'Set _qactive=QUEST_ACTIVE, _qlog=true, _qmsg=TEXT_BUTCH9, and _qvar1=1; start TEXT_BUTCH9.',
        ref('towners.cpp', '273-290'),
      ),
      transition(
        'kill-butcher', 'monster-killed', 'MT_CLEAVER',
        'the Butcher monster is killed; prior briefing is not required',
        'Set Q_BUTCHER._qactive=QUEST_DONE and play the hero kill speech; TOWN_DEADGUY is absent after towners are initialized again.',
        ref('quests.cpp', '241-246'), ref('towners.cpp', '735-747'), ref('monster.cpp', '3996-4028'),
      ),
    ],
  ),

  'd1-Q_LTBANNER': ledger(
    'd1-Q_LTBANNER',
    'Q_LTBANNER: _qactive=QUEST_INIT; _qvar1=1; _qvar2=0; _qlog=false',
    ['ogden-briefing', 'snotspill-offer'],
    ['hand-in-sign-ogden', 'hand-in-sign-snotspill'],
    [
      transition(
        'ogden-briefing', 'talk-to-towner', 'TOWN_TAVERN',
        'Q_LTBANNER is available and not QUEST_DONE; player visited floor 3 or 4; _qvar2==0',
        'Set _qvar2=1 and _qlog=true; if QUEST_INIT, set _qactive=QUEST_ACTIVE and _qvar1=1; start TEXT_BANNER2.',
        ref('towners.cpp', '243-256'),
      ),
      transition(
        'snotspill-offer', 'talk-to-monster', 'UniqueMonsterType::SnotSpill / TEXT_BANNER10',
        'talkMsg==TEXT_BANNER10; MFLAG_QUEST_COMPLETE is clear',
        'Open the first map region; set Q_LTBANNER._qvar1=2 and QUEST_INIT to QUEST_ACTIVE; set MFLAG_QUEST_COMPLETE. This path does not set _qlog.',
        ref('monster.cpp', '1427-1448'),
      ),
      transition(
        'snotspill-reminder', 'monster-left-visibility', 'UniqueMonsterType::SnotSpill',
        'talkMsg==TEXT_BANNER10; goal==MonsterGoal::Talking; tile is not visible',
        'Set talkMsg=TEXT_BANNER11 and goal=MonsterGoal::Inquiring; quest state is unchanged.',
        ref('monster.cpp', '2630-2646'),
      ),
      transition(
        'open-sign-chest', 'object-operated', 'OBJ_SIGNCHEST',
        'Q_LTBANNER._qvar1==2; object is interactable; item capacity remains',
        'Disable the chest and spawn IDI_BANNER; quest state is unchanged.',
        ref('objects.cpp', '2104-2130'),
      ),
      transition(
        'hand-in-sign-ogden', 'item-handed-in', 'IDI_BANNER -> TOWN_TAVERN',
        'Q_LTBANNER is available and not QUEST_DONE; _qvar2==1; removal succeeds',
        'Remove IDI_BANNER; set _qactive=QUEST_DONE and _qvar1=3; spawn UITEM_HARCREST; start TEXT_BANNER3.',
        ref('towners.cpp', '243-267'),
      ),
      transition(
        'hand-in-sign-snotspill', 'item-handed-in', 'IDI_BANNER -> UniqueMonsterType::SnotSpill',
        'Q_LTBANNER.IsAvailable(); _qvar1==2; removal succeeds',
        'Remove IDI_BANNER; immediately set Q_LTBANNER._qactive=QUEST_DONE; set SnotSpill talkMsg=TEXT_BANNER12 and goal=MonsterGoal::Inquiring.',
        ref('monster.cpp', '4747-4759'),
      ),
      transition(
        'finish-snotspill-exchange', 'speech-finished', 'TEXT_BANNER12',
        'SnotSpill is visible; talkMsg==TEXT_BANNER12; goal==MonsterGoal::Talking; SfxID::Snotspill3 is not playing',
        'Open the full room; set Q_LTBANNER._qvar1=3; clear talkMsg; set goal=MonsterGoal::Normal and activeForTicks=UINT8_MAX; refresh vision.',
        ref('monster.cpp', '2648-2663'),
      ),
    ],
    ['Multiplayer map and monster resynchronization branches are flagged but not expanded.'],
  ),

  'd1-Q_BLIND': ledger(
    'd1-Q_BLIND',
    'Q_BLIND: _qactive=QUEST_INIT; _qvar1=0; _qvar2=0; _qlog=false',
    ['operate-blind-book'],
    ['pick-up-optic-amulet'],
    [
      transition(
        'operate-blind-book', 'object-operated', 'OBJ_BLINDBOOK',
        'object is interactable; qtextflag is false; ActiveItemCount<MAXITEMS; _qvar1==0',
        'Set _qactive=QUEST_ACTIVE, _qlog=true, and _qvar1=1; open the map region, spawn UITEM_OPTAMULET, and start the class-specific TEXT_* line.',
        ref('objects.cpp', '1924-1966'),
      ),
      transition(
        'pick-up-optic-amulet', 'item-picked-up', 'IDI_OPTAMULET / spawned reward position',
        'Q_BLIND._qactive==QUEST_ACTIVE; item id or guarded spawn position matches',
        'Set Q_BLIND._qactive=QUEST_DONE.',
        ref('inv.cpp', '993-1002'),
      ),
    ],
  ),

  'd1-Q_BLOOD': ledger(
    'd1-Q_BLOOD',
    'Q_BLOOD: _qactive=QUEST_INIT; _qvar1=0; _qvar2=0; _qlog=false; OBJ_PEDESTAL._oVar6=0',
    ['operate-blood-book'],
    ['pick-up-valor-armor'],
    [
      transition(
        'operate-blood-book', 'object-operated', 'OBJ_BLOODBOOK',
        'object is interactable; qtextflag is false; ActiveItemCount<MAXITEMS; _qvar1==0',
        'Set _qactive=QUEST_ACTIVE, _qlog=true, and _qvar1=1; spawn the first IDI_BLDSTONE and start the class-specific TEXT_* line.',
        ref('objects.cpp', '1924-1966'),
      ),
      transition(
        'insert-first-blood-stone', 'item-handed-in', 'IDI_BLDSTONE -> OBJ_PEDESTAL',
        'pedestal._oVar6<3; RemoveInventoryItemById succeeds',
        'Remove IDI_BLDSTONE; increment pedestal._oVar6 to 1; open the first area and spawn the second IDI_BLDSTONE.',
        ref('objects.cpp', '2207-2233'),
      ),
      transition(
        'insert-second-blood-stone', 'item-handed-in', 'IDI_BLDSTONE -> OBJ_PEDESTAL',
        'pedestal._oVar6==1; RemoveInventoryItemById succeeds',
        'Remove IDI_BLDSTONE; increment pedestal._oVar6 to 2; open the second area and spawn the third IDI_BLDSTONE.',
        ref('objects.cpp', '2207-2239'),
      ),
      transition(
        'insert-third-blood-stone', 'item-handed-in', 'IDI_BLDSTONE -> OBJ_PEDESTAL',
        'pedestal._oVar6==2; RemoveInventoryItemById succeeds',
        'Remove IDI_BLDSTONE; increment pedestal._oVar6 to 3; open the final area, load its objects, spawn UITEM_ARMOFVAL, and disable the pedestal.',
        ref('objects.cpp', '2207-2247'),
      ),
      transition(
        'pick-up-valor-armor', 'item-picked-up', 'IDI_ARMOFVAL / spawned reward position',
        'Q_BLOOD._qactive==QUEST_ACTIVE; item id or guarded spawn position matches',
        'Set Q_BLOOD._qactive=QUEST_DONE and play the hero pickup speech.',
        ref('inv.cpp', '1034-1040'),
      ),
    ],
    ['Q_BLOOD._qvar2 mirrors pedestal insertions only in multiplayer and is flagged without expanding that branch.'],
  ),

  'd1-Q_ANVIL': ledger(
    'd1-Q_ANVIL',
    'Q_ANVIL: _qactive=QUEST_INIT; _qvar1=0; _qvar2=0; _qlog=false',
    ['pick-up-anvil', 'smith-briefing'],
    ['hand-in-anvil'],
    [
      transition(
        'spawn-anvil', 'level-entered', 'Q_ANVIL._qlevel',
        '!setlevel; Q_ANVIL.IsAvailable()',
        'Spawn IDI_ANVIL in the quest set piece; quest state is unchanged.',
        ref('items.cpp', '2451-2457'),
      ),
      transition(
        'pick-up-anvil', 'item-picked-up', 'IDI_ANVIL',
        'Q_ANVIL._qactive != QUEST_NOTAVAIL',
        'If _qactive==QUEST_INIT, set _qactive=QUEST_ACTIVE; _qlog and _qvar2 are unchanged.',
        ref('inv.cpp', '1010-1018'),
      ),
      transition(
        'smith-briefing', 'talk-to-towner', 'TOWN_SMITH',
        'Q_ANVIL is neither QUEST_NOTAVAIL nor QUEST_DONE; player visited floor 9 or 10; _qvar2==0',
        'Set _qvar2=1 and _qlog=true; QUEST_INIT becomes QUEST_ACTIVE; start TEXT_ANVIL5.',
        ref('towners.cpp', '316-326'),
      ),
      transition(
        'hand-in-anvil', 'item-handed-in', 'IDI_ANVIL -> TOWN_SMITH',
        'Q_ANVIL is neither QUEST_NOTAVAIL nor QUEST_DONE; _qvar2==1; removal succeeds',
        'Remove IDI_ANVIL; set _qactive=QUEST_DONE; spawn UITEM_GRISWOLD; start TEXT_ANVIL7.',
        ref('towners.cpp', '316-335'),
      ),
    ],
  ),

  'd1-Q_WARLORD': ledger(
    'd1-Q_WARLORD',
    'Q_WARLORD: _qactive=QUEST_INIT; _qvar1=QS_WARLORD_INIT; _qlog=false',
    ['operate-steel-tome'],
    ['kill-warlord'],
    [
      transition(
        'operate-steel-tome', 'object-operated', 'OBJ_STEELTOME',
        'object is interactable; qtextflag is false; ActiveItemCount<MAXITEMS; _qvar1==QS_WARLORD_INIT',
        'Set _qactive=QUEST_ACTIVE, _qlog=true, and _qvar1=QS_WARLORD_STEELTOME_READ; open the armory map region and start the class-specific TEXT_* line.',
        ref('objects.cpp', '1924-1966'),
      ),
      transition(
        'warlord-talks', 'monster-became-visible', 'UniqueMonsterType::WarlordOfBlood',
        'talkMsg==TEXT_WARLRD9; goal==MonsterGoal::Inquiring; Warlord is visible',
        'Enter MonsterMode::Talk; MonsterTalk sets _qvar1=QS_WARLORD_TALKING and starts TEXT_WARLRD9.',
        ref('monster.cpp', '1427-1461'), ref('monster.cpp', '2984-2999'),
      ),
      transition(
        'warlord-hostile', 'speech-finished', 'TEXT_WARLRD9',
        'Warlord is visible; goal==MonsterGoal::Talking; SfxID::Warlord is not playing',
        'Clear talkMsg; set goal=MonsterGoal::Normal, activeForTicks=UINT8_MAX, and _qvar1=QS_WARLORD_ATTACKING.',
        ref('monster.cpp', '2991-3000'),
      ),
      transition(
        'kill-warlord', 'monster-killed', 'UniqueMonsterType::WarlordOfBlood',
        'Warlord is killed',
        'Set Q_WARLORD._qactive=QUEST_DONE and play the hero kill speech.',
        ref('quests.cpp', '282-285'), ref('monster.cpp', '3996-4028'),
      ),
    ],
    ['Multiplayer hostility resynchronization is flagged but not expanded.'],
  ),

  'd1-Q_SKELKING': ledger(
    'd1-Q_SKELKING',
    'Q_SKELKING: _qactive=QUEST_INIT; _qvar1=0; _qvar2=0; _qlog=false',
    ['ogden-briefing', 'enter-king-set-level'],
    ['kill-skeleton-king'],
    [
      transition(
        'ogden-briefing', 'talk-to-towner', 'TOWN_TAVERN',
        'Q_SKELKING is available; player visited floor 2 or 4; _qvar2==0',
        'Set _qvar2=1 and _qlog=true; if QUEST_INIT, set _qactive=QUEST_ACTIVE and _qvar1=1; start TEXT_KING2.',
        ref('towners.cpp', '219-232'),
      ),
      transition(
        'enter-king-set-level', 'level-entered', 'SL_SKELKING',
        'Q_SKELKING._qactive==QUEST_INIT',
        'Set _qactive=QUEST_ACTIVE and _qvar1=1; leave _qlog=false and _qvar2=0.',
        ref('levels/setmaps.cpp', '112-127'),
      ),
      transition(
        'kill-skeleton-king', 'monster-killed', 'MT_SKING',
        'Skeleton King is killed; prior briefing is not required',
        'Set Q_SKELKING._qactive=QUEST_DONE and play the hero kill speech.',
        ref('quests.cpp', '234-240'), ref('monster.cpp', '3996-4028'),
      ),
      transition(
        'ogden-epilogue', 'talk-to-towner', 'TOWN_TAVERN',
        'Q_SKELKING._qactive==QUEST_DONE; player visited floor 2 or 4; _qvar2==1',
        'Set _qvar2=2 and _qvar1=2; start TEXT_KING4.',
        ref('towners.cpp', '233-239'),
      ),
    ],
    ['Multiplayer proximity activation is flagged but not expanded.'],
  ),

  'd1-Q_PWATER': ledger(
    'd1-Q_PWATER',
    'Q_PWATER: _qactive=QUEST_INIT; _qvar1=0; _qvar2=0; _qlog=false',
    ['pepin-briefing', 'enter-poison-water'],
    ['purify-water'],
    [
      transition(
        'pepin-briefing', 'talk-to-towner', 'TOWN_HEALER',
        'Q_PWATER is available; (_qactive==QUEST_INIT and floor 1 or 5 visited) or (_qactive==QUEST_ACTIVE and !_qlog)',
        'Set _qactive=QUEST_ACTIVE, _qlog=true, and _qmsg=TEXT_POISON3; start TEXT_POISON3.',
        ref('towners.cpp', '413-426'),
      ),
      transition(
        'enter-poison-water', 'level-entered', 'SL_POISONWATER',
        'Q_PWATER._qactive==QUEST_INIT',
        'Set _qactive=QUEST_ACTIVE; leave _qlog=false.',
        ref('levels/setmaps.cpp', '138-144'),
      ),
      transition(
        'purify-water', 'quest-condition', 'SL_POISONWATER survivor check',
        'setlevel; setlvlnum==Q_PWATER._qslvl; _qactive!=QUEST_INIT and !=QUEST_DONE; matching level type; ActiveMonsterCount==4',
        'Set _qactive=QUEST_DONE and _qlog=true; start the water-purification palette transition and quest-done sound.',
        ref('quests.cpp', '175-186'), ref('quests.cpp', '50-56'),
      ),
      transition(
        'pepin-reward', 'talk-to-towner', 'TOWN_HEALER',
        'Q_PWATER._qactive==QUEST_DONE; _qvar1!=2',
        'Set _qvar1=2; spawn UITEM_TRING; start TEXT_POISON5.',
        ref('towners.cpp', '427-433'),
      ),
    ],
    ['The multiplayer town-fountain cleanup and proximity activation branches are flagged but not expanded.'],
  ),

  'd1-Q_SCHAMB': ledger(
    'd1-Q_SCHAMB',
    'Q_SCHAMB: _qactive=QUEST_INIT; _qvar1=0; _qvar2=0; _qlog=false',
    ['operate-entrance-book'],
    ['operate-final-book'],
    [
      transition(
        'operate-entrance-book', 'object-operated', 'OBJ_BOOK2R',
        'object is interactable; qtextflag is false',
        'Open the entrance map region; if QUEST_INIT, set _qactive=QUEST_ACTIVE and _qlog=true; set _qmsg to the class-specific TEXT_* id and start it.',
        ref('objects.cpp', '1969-2015'),
      ),
      transition(
        'enter-bone-chamber', 'level-entered', 'SL_BONECHAMB',
        'player stands on the Q_SCHAMB entrance while Q_SCHAMB is available',
        'Load SL_BONECHAMB and its final book; quest state is unchanged.',
        ref('quests.cpp', '187-199'), ref('levels/setmaps.cpp', '128-135'),
      ),
      transition(
        'operate-final-book', 'object-operated', 'OBJ_BOOK2L in SL_BONECHAMB',
        'book is interactable; local operation is sent',
        'Set Q_SCHAMB._qactive=QUEST_DONE; increment SpellID::Guardian when the new level is within MaxSpellLevel; play quest-done effects.',
        ref('objects.cpp', '1842-1912'),
      ),
    ],
  ),

  'd1-Q_BETRAYER': ledger(
    'd1-Q_BETRAYER',
    'Q_BETRAYER: _qactive=QUEST_INIT; _qvar1=0; _qvar2=0; _qlog=false',
    ['hand-in-lazarus-staff'],
    ['kill-lazarus'],
    [
      transition(
        'operate-vile-stand', 'object-operated', 'OBJ_LAZSTAND',
        '!UseMultiplayerQuests(); Q_BETRAYER.IsAvailable(); stand is interactable; qtextflag is false; item capacity remains',
        'Disable the stand and spawn IDI_LAZSTAFF; quest state is unchanged.',
        ref('objects.cpp', '871-889'), ref('objects.cpp', '3397-3412'), ref('objects.cpp', '3948-3949'),
      ),
      transition(
        'hand-in-lazarus-staff', 'item-handed-in', 'IDI_LAZSTAFF -> TOWN_STORY',
        '!UseMultiplayerQuests(); _qactive==QUEST_INIT; removal succeeds',
        'Remove IDI_LAZSTAFF; set _qactive=QUEST_ACTIVE, _qlog=true, and _qvar1=2; start TEXT_VILE1.',
        ref('towners.cpp', '457-468'),
      ),
      transition(
        'spawn-entry-portal', 'level-entered', 'Q_BETRAYER._qlevel',
        '!UseMultiplayerQuests(); !setlevel; _qvar1>=2; _qactive is QUEST_ACTIVE or QUEST_DONE; _qvar2 is 0 or 2',
        'Spawn the entry RedPortal; set _qvar2=1; when active with _qvar1==2, set _qvar1=3.',
        ref('quests.cpp', '153-164'),
      ),
      transition(
        'enter-vile-betrayer', 'level-entered', 'SL_VILEBETRAYER',
        'Q_BETRAYER._qactive==QUEST_ACTIVE',
        'Set _qvar2=3 and load the set level, its books, circles, and monsters.',
        ref('levels/setmaps.cpp', '145-156'),
      ),
      transition(
        'operate-vileness-books', 'object-operated', 'the two OBJ_BOOK2L books in SL_VILEBETRAYER',
        'each book is interactable; local player stands on its paired circle',
        'Disable each book, increment the central circle progress, phase the player, and open each linked map region.',
        ref('objects.cpp', '1842-1875'), ref('objects.cpp', '1913-1921'),
      ),
      transition(
        'activate-central-circle', 'object-operated', 'central OBJ_MCIRCLE2',
        'player stands on the central circle; both books were operated; Q_BETRAYER._qvar1<=4',
        'Open the inner map region; set _qvar1=4; phase and stop the player on the Lazarus side.',
        ref('objects.cpp', '1492-1532'),
      ),
      transition(
        'start-lazarus-greeting', 'monster-became-visible', 'UniqueMonsterType::Lazarus / TEXT_VILE13',
        '!UseMultiplayerQuests(); Lazarus is visible; goal==MonsterGoal::Inquiring; player is on the scripted trigger tile',
        'Start the in-game movie and MonsterMode::Talk; set Q_BETRAYER._qvar1=5.',
        ref('monster.cpp', '2879-2897'),
      ),
      transition(
        'finish-lazarus-greeting', 'speech-finished', 'TEXT_VILE13',
        '!UseMultiplayerQuests(); Lazarus is visible; goal==MonsterGoal::Talking; SfxID::LazarusGreeting is not playing',
        'Open the combat map region; set Q_BETRAYER._qvar1=6; clear Lazarus talkMsg and set him hostile. LazarusMinionAi then clears Black Jade and Red Vex talkMsg and sets both to MonsterGoal::Normal because _qvar1>5.',
        ref('monster.cpp', '2899-2907'), ref('monster.cpp', '2928-2950'),
      ),
      transition(
        'kill-lazarus', 'monster-killed', 'UniqueMonsterType::Lazarus',
        'Lazarus is killed',
        'Set Q_BETRAYER._qactive=QUEST_DONE and _qvar1=7; set Q_DIABLO._qactive=QUEST_ACTIVE; initialize onward triggers; set _qvar2=4 and spawn the set-level exit RedPortal.',
        ref('quests.cpp', '255-281'),
      ),
      transition(
        'spawn-exit-portal', 'other-quest-state', 'Q_BETRAYER completion on SL_VILEBETRAYER',
        '_qactive==QUEST_DONE; setlevel; setlvlnum==SL_VILEBETRAYER; _qvar2==4',
        'Spawn the exit RedPortal and set _qvar2=3.',
        ref('quests.cpp', '166-173'),
      ),
      transition(
        'return-from-set-level', 'level-entered', 'Q_BETRAYER._qlevel',
        '!setlevel; _qvar2==1 or _qvar2>=3; _qactive is QUEST_ACTIVE or QUEST_DONE',
        'Set _qvar2=2.',
        ref('quests.cpp', '489-495'),
      ),
      transition(
        'cain-epilogue', 'talk-to-towner', 'TOWN_STORY',
        'Q_BETRAYER._qactive==QUEST_DONE; _qvar1==7',
        'Set Q_BETRAYER._qvar1=8 and Q_DIABLO._qlog=true; start TEXT_VILE3.',
        ref('towners.cpp', '477-486'),
      ),
    ],
    ['The alternate multiplayer activation, altar, direct-floor encounter, and trigger branches are flagged but not expanded.'],
  ),
};

export const D1_QUEST_CAUSALITY_DEPENDENCIES: readonly QuestCausalityDependency[] = [
  {
    id: 'betrayer-completion-activates-diablo',
    from: { kind: 'quest', id: 'd1-Q_BETRAYER', transitionId: 'kill-lazarus' },
    to: { kind: 'quest', id: 'd1-Q_DIABLO', transitionId: 'lazarus-kill-activates' },
    guard: 'UniqueMonsterType::Lazarus is killed',
    effect: 'Q_BETRAYER becomes QUEST_DONE while Q_DIABLO becomes QUEST_ACTIVE in the same kill dispatch.',
    refs: [ref('quests.cpp', '255-281')],
  },
  {
    id: 'betrayer-epilogue-logs-diablo',
    from: { kind: 'quest', id: 'd1-Q_BETRAYER', transitionId: 'cain-epilogue' },
    to: { kind: 'quest', id: 'd1-Q_DIABLO', transitionId: 'cain-reveals-journal' },
    guard: 'Q_BETRAYER is QUEST_DONE with _qvar1==7 when TOWN_STORY is addressed',
    effect: 'Q_BETRAYER._qvar1 becomes 8 and Q_DIABLO._qlog becomes true.',
    refs: [ref('towners.cpp', '477-486')],
  },
  {
    id: 'lazarus-progression-releases-black-jade',
    from: { kind: 'quest', id: 'd1-Q_BETRAYER', transitionId: 'finish-lazarus-greeting' },
    to: { kind: 'monster', id: 'UniqueMonsterType::BlackJade' },
    guard: 'Q_BETRAYER._qvar1>5 when LazarusMinionAi processes the visible monster',
    effect: 'Clear Black Jade talkMsg and set goal=MonsterGoal::Normal; no Black Jade speech completion causes the release.',
    refs: [ref('monster.cpp', '2899-2907'), ref('monster.cpp', '2928-2950')],
  },
  {
    id: 'lazarus-progression-releases-red-vex',
    from: { kind: 'quest', id: 'd1-Q_BETRAYER', transitionId: 'finish-lazarus-greeting' },
    to: { kind: 'monster', id: 'UniqueMonsterType::RedVex' },
    guard: 'Q_BETRAYER._qvar1>5 when LazarusMinionAi processes the visible monster',
    effect: 'Clear Red Vex talkMsg and set goal=MonsterGoal::Normal; no Red Vex speech completion causes the release.',
    refs: [ref('monster.cpp', '2899-2907'), ref('monster.cpp', '2928-2950')],
  },
];

export const D1_QUEST_CAUSALITY_SCOPE_FLAGS = [
  'Hellfire quest ids are outside this ledger and receive no data.causality attachment.',
  'Multiplayer-only activation, spawn, resynchronization, and map branches are named in per-quest flags but are not expanded into transitions.',
] as const;

/** Findings only: W17 questSpecs remains unchanged. */
export const D1_QUEST_SPEC_CAUSALITY_FINDINGS: readonly QuestSpecCausalityFinding[] = [
  {
    questId: 'd1-Q_VEIL',
    finding: 'The item-spawned stage conflates two events: UITEM_STEELVEIL spawns during the IDI_GLDNELIX hand-in; TEXT_VEIL11 finishing only completes Q_VEIL and removes Lachdan.',
    refs: [ref('monster.cpp', '4761-4771'), ref('monster.cpp', '2968-2977')],
  },
  {
    questId: 'd1-Q_LTBANNER',
    finding: 'The Snotspill completion stage conflates the exchange with its later speech: handing in IDI_BANNER immediately sets Q_LTBANNER to QUEST_DONE, while TEXT_BANNER12 finishing later opens the room, sets _qvar1=3, and makes Snotspill hostile.',
    refs: [ref('monster.cpp', '4747-4759'), ref('monster.cpp', '2648-2663')],
  },
  {
    questId: 'd1-Q_BETRAYER',
    finding: 'The combat stage omits the dependent release: Lazarus finishing TEXT_VILE13 sets Q_BETRAYER._qvar1=6, and LazarusMinionAi uses that state to release Black Jade and Red Vex; neither minion is released by its own speech ending.',
    refs: [ref('monster.cpp', '2899-2907'), ref('monster.cpp', '2928-2950')],
  },
  {
    questId: 'd1-Q_ZHAR',
    finding: 'The linear stage summary omits the bookcase branch: operating a qualifying library bookcase can force TEXT_ZHAR2 and Zhar attack behavior without activating/logging Q_ZHAR or spawning the first-talk item.',
    refs: [ref('objects.cpp', '3128-3154'), ref('monster.cpp', '2800-2808')],
  },
];
