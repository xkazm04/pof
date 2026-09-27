/** Engine-derived Diablo I named encounters. Authored DUN cell values stay external. */
import type { EncounterSpecData, EncounterLawData } from '@/lib/catalog/reference/encounterSpecs';
import type { ProjectRule } from '@/lib/catalog/canon/types';

const source = (path: string): string => {
  const match = /^(.*):(\d+)(?:-(\d+))?$/.exec(path);
  if (!match) return `https://github.com/diasurgical/devilutionX/blob/4138a82/Source/${path}`;
  return `https://github.com/diasurgical/devilutionX/blob/4138a82/Source/${match[1]}#L${match[2]}${match[3] ? `-L${match[3]}` : ''}`;
};
const refs = (...paths: string[]) => paths.map(source);

export const ENCOUNTER_SPECS_DATA = [
  {
    id: 'd1-encounter-butcher', name: 'The Butcher', location: 'd1-level-02', expectedDepth: 2,
    boss: 'd1-uniq-the-butcher', quest: 'd1-Q_BUTCHER', combat: true, minions: [],
    trigger: 'Sight: opening the room door can expose the Butcher; first visibility wakes him and plays his greeting.',
    arena: 'A Cathedral quest set piece receives its own transparency sector and torture-body objects. Its door uses ordinary player-operated door logic; there is no boss-specific door trigger. The unique receives the coded radius-3 light.',
    win: "The Butcher's death marks Q_BUTCHER done and runs ordinary monster loot.",
    loss: 'No encounter-specific failure state; ordinary hero death applies.',
    special: 'The Butcher always approaches or melees once alert. Door opening is data-flag-dependent for monster pathing; his base row lacks the door-opening flag, so a closed door blocks him.',
    refs: refs('levels/drlg_quests.cpp:18-21', 'objects.cpp:340-359', 'objects.cpp:1748-1779', 'monster.cpp:426-427', 'monster.cpp:531-536', 'monster.cpp:1804-1812', 'monster.cpp:4278-4317', 'quests.cpp:241-246'),
  },
  {
    id: 'd1-encounter-skeleton-king', name: 'The Skeleton King', location: 'd1-set-skeleton-king', expectedDepth: 3,
    boss: 'd1-uniq-skeleton-king', quest: 'd1-Q_SKELKING', combat: true,
    minions: [
      { type: 'd1-${MonstConvTbl[monsterLayerId-1]}', count: 'one per nonzero monster-layer cell in sklkng2.dun, excluding the separately placed King', relation: 'scripted' },
      { type: 'd1-${a registered skeleton _monster_id}', count: 'one per successful single-player summon while a front tile and monster slot are available', relation: 'scripted' },
    ],
    trigger: 'Sight: the King wakes under ordinary visibility/alert logic; set-level entry itself activates the quest but does not start combat.',
    arena: "Fixed authored Skeleton King's Lair with transparency data, a dedicated palette, a return trigger, three secret-room map-change ranges, and a gate. The unique receives the coded radius-3 light.",
    win: "The King's death marks Q_SKELKING done.",
    loss: 'No encounter-specific failure state; ordinary hero death applies.',
    special: 'The pinned AI spawns new random registered skeletons; it does not resurrect corpses. Summoning is disabled with multiplayer quests. That multiplayer variant instead places the King on level 3 with a requested 30-member Independent skeleton pack, subject to capacity and placement success.',
    refs: refs('levels/setmaps.cpp:41-54', 'levels/setmaps.cpp:112-127', 'monster.cpp:538-545', 'monster.cpp:600-601', 'monster.cpp:2374-2427', 'monster.cpp:3750-3775', 'quests.cpp:234-239'),
  },
  {
    id: 'd1-encounter-gharbad', name: 'Gharbad the Weak', location: 'd1-level-04', expectedDepth: 4,
    boss: 'd1-uniq-gharbad-the-weak', quest: 'd1-Q_GARBUD', combat: true, minions: [],
    trigger: 'Talk end: three earlier conversations advance only after Gharbad leaves visibility; combat begins when the fourth line finishes while he remains visible.',
    arena: 'No fixed arena: ordinary unique placement chooses a legal random tile with surrounding placement room. The unique receives the coded radius-3 light.',
    win: "Gharbad's death marks Q_GARBUD done and gives his scripted death reward through loot handling.",
    loss: 'No encounter-specific failure state; ordinary hero death applies.',
    special: 'Gharbad cannot fight during his dialogue goals. Earlier talks activate the quest and produce staged rewards; only the final line clears the pending talk, selects the normal goal, and makes him hostile.',
    refs: refs('monster.cpp:439-460', 'monster.cpp:504-527', 'monster.cpp:2578-2627', 'monster.cpp:4789-4802', 'quests.cpp:247-250'),
  },
  {
    id: 'd1-encounter-zhar', name: 'Zhar the Mad', location: 'd1-level-08', expectedDepth: 8,
    boss: 'd1-uniq-zhar-the-mad', quest: 'd1-Q_ZHAR', combat: true, minions: [],
    trigger: 'Talk or bookcase: leaving sight after the first talk selects the angry line; operating a bookcase while Zhar is alert can select it immediately. Combat starts when that second line finishes.',
    arena: 'Zhar is fixed inside the selected procedural library theme room rather than at a general random tile. The unique receives the coded radius-3 light.',
    win: "Zhar's death marks Q_ZHAR done.",
    loss: 'No encounter-specific failure state; ordinary hero death applies.',
    special: 'Dialogue prevents combat until hostility. Once released, Zhar delegates to Counselor spell, fade, retreat, and circling behavior.',
    refs: refs('monster.cpp:413-418', 'monster.cpp:2786-2815', 'monster.cpp:4774-4786', 'objects.cpp:3128-3155', 'quests.cpp:251-254'),
  },
  {
    id: 'd1-encounter-snotspill', name: 'Snotspill', location: 'd1-level-04', expectedDepth: 4,
    boss: 'd1-uniq-snotspill', quest: 'd1-Q_LTBANNER', combat: true,
    minions: [{ type: 'd1-${MonstConvTbl[monsterLayerId-1]}', count: 'one per nonzero monster-layer cell in banner1.dun', relation: 'scripted' }],
    trigger: 'Banner hand-in and talk end: handing over IDI_BANNER marks the quest done and selects the final line; its completion opens the full map piece and makes Snotspill hostile.',
    arena: "Authored Ogden's Sign map piece with a fixed monster layer. The initial talk opens one section; the final talk opens the whole set piece and refreshes vision. The unique receives the coded radius-3 light.",
    win: "Snotspill's death clears the combat entity, but Q_LTBANNER is already done before combat and death unlocks nothing further.",
    loss: 'No encounter-specific failure state; ordinary hero death applies.',
    special: 'While his dialogue is pending, attack actions become talk interactions. After activation he delegates to Fallen behavior.',
    refs: refs('monster.cpp:409-410', 'monster.cpp:547-550', 'monster.cpp:1427-1446', 'monster.cpp:2630-2667', 'monster.cpp:4747-4759'),
  },
  {
    id: 'd1-encounter-warlord-of-blood', name: 'Warlord of Blood', location: 'd1-level-13', expectedDepth: 13,
    boss: 'd1-uniq-warlord-of-blood', quest: 'd1-Q_WARLORD', combat: true,
    minions: [{ type: 'd1-${MonstConvTbl[monsterLayerId-1]}', count: 'one per nonzero monster-layer cell in warlord.dun', relation: 'scripted' }],
    trigger: 'Book then sight/talk end: the Steel Tome changes the armory map and activates the quest; once visible, the Warlord automatically begins his speech and becomes hostile when its audio finishes.',
    arena: 'Authored Hell set piece loaded from the Warlord maps. A Steel Tome acts as the map-changing lever. The unique receives the coded radius-3 light.',
    win: "The Warlord's death marks Q_WARLORD done.",
    loss: 'No encounter-specific failure state; ordinary hero death applies.',
    special: 'He is noncombatant during the confrontation speech, then delegates to SkeletonMelee behavior.',
    refs: refs('levels/drlg_quests.cpp:29-35', 'monster.cpp:411-412', 'monster.cpp:563-567', 'monster.cpp:2984-3006', 'objects.cpp:1924-1967', 'quests.cpp:282-285'),
  },
  {
    id: 'd1-encounter-lachdanan', name: 'Lachdanan', location: 'd1-level-14', expectedDepth: 14,
    boss: 'd1-uniq-lachdanan', quest: 'd1-Q_VEIL', combat: false, minions: [],
    trigger: 'Item hand-in and talk end: giving Lachdanan IDI_GLDNELIX selects his final line; its completion resolves the encounter.',
    arena: 'No fixed arena: he uses ordinary legal unique placement on level 14. The unique receives the coded radius-3 light.',
    win: "The final speech marks Q_VEIL done and invokes Lachdanan's scripted death/removal; the Steel Veil reward is spawned when the elixir is handed over.",
    loss: 'None; this encounter has no combat or scripted failure state.',
    special: 'NON-COMBAT scripted encounter. Lachdanan never delegates to a combat routine; no hostile wave or boss duel exists.',
    refs: refs('monster.cpp:504-527', 'monster.cpp:2953-2981', 'monster.cpp:4761-4772'),
  },
  {
    id: 'd1-encounter-lazarus', name: 'Archbishop Lazarus', location: 'd1-set-lazarus', expectedDepth: 15,
    boss: 'd1-uniq-arch-bishop-lazarus', quest: 'd1-Q_BETRAYER', combat: true,
    minions: [
      { type: 'd1-uniq-red-vex', count: '1', relation: 'scripted' },
      { type: 'd1-uniq-black-jade', count: '1', relation: 'scripted' },
      { type: 'd1-${MonstConvTbl[monsterLayerId-1]}', count: 'one per nonzero ordinary-monster cell in vile2.dun', relation: 'scripted' },
    ],
    trigger: 'Single player: complete the two Book of Vileness/circle transitions, step on the enabled center circle, then reach Lazarus visibly at the scripted arrival tile; his cinematic speech starts automatically and its end opens the room and releases all three uniques. Multiplayer uses visibility-driven automatic talk on level 15.',
    arena: 'Fixed authored lair with three map-change objects, two side book/circle routes, a center Phasing-circle transfer, and a central room opened by quest state. Lazarus, Red Vex, and Black Jade each receive the coded radius-3 unique light.',
    win: "Lazarus's death alone marks Q_BETRAYER done and activates Q_DIABLO. Single player creates the return red portal; multiplayer enables the level-16 trigger. Red Vex and Black Jade need not die first.",
    loss: 'No encounter-specific failure state; ordinary hero death applies.',
    special: 'Lazarus delegates to Counselor fade/circle behavior and ignores requested AI delays. The pinned code does not tile-teleport Lazarus: explicit Phasing transfers move the hero, and monster Teleport is called only for Blink monsters after a hard hit.',
    refs: refs('levels/setmaps.cpp:62-67', 'levels/setmaps.cpp:145-157', 'objects.cpp:1492-1532', 'objects.cpp:1842-1869', 'monster.cpp:391-425', 'monster.cpp:602-609', 'monster.cpp:2879-2950', 'monster.cpp:3964-3970', 'quests.cpp:255-281'),
  },
  {
    id: 'd1-encounter-diablo', name: 'Diablo', location: 'd1-level-16', expectedDepth: 16,
    boss: 'd1-MT_DIABLO', quest: 'd1-Q_DIABLO', combat: true,
    minions: [{ type: 'd1-MT_ADVOCATE | d1-MT_RBLACK', count: 'authored cells in diab1/diab2a/diab3a/diab4a plus independent random packs of 3..5 until the fixed count plus floor(open non-solid tiles/30) is reached; multiplayer adds half that random allowance', relation: 'scripted' }],
    trigger: 'Sight: levers open successive authored quadrants, but combat itself begins through ordinary visibility/alert logic when Diablo is exposed.',
    arena: 'Level 16 uses a generated mirrored shell with four authored quadrants. Object layers from the first three quadrants wire lever groups to open the next quadrant. The fixed roster registers Advocates, Black Knights, and Diablo; no ordinary random type draw runs.',
    win: "Diablo's death marks Q_DIABLO done, starts death animations for active non-Diablo monsters, stops normal player processing, and enters the ending sequence after 140 death ticks.",
    loss: 'No encounter-specific alternate failure state; ordinary hero death applies.',
    special: 'Diablo never loses alertness offscreen and attacks with DiabloApocalypse. The pinned immunity function has no Diablo-specific Apocalypse case and the player Apocalypse scan does not skip him. Diablo is explicitly excluded from Stone Curse instead.',
    refs: refs('levels/drlg_l4.cpp:964-985', 'objects.cpp:589-594', 'objects.cpp:1800-1820', 'monster.cpp:613-630', 'monster.cpp:875-909', 'monster.cpp:2013-2067', 'monster.cpp:3432-3439', 'monster.cpp:3686-3737', 'monster.cpp:4313-4318', 'missiles.cpp:2368-2384', 'missiles.cpp:3853-3869', 'monster.cpp:4935-4943'),
  },
] as const satisfies readonly EncounterSpecData[];

export const ENCOUNTER_LAWS_DATA = [
  {
    id: 'd1-encounter-pack-placement', title: 'Unique pack placement',
    body: 'Unique pack placement, derived from the engine: an ordinary unique requests eight minions of its own base type; scripted calls may override that number. Capacity and legal placement can reduce the result. Every placed minion gets double HP and leader Intelligence. Independent packs have no leader link; leashed packs copy leader AI and enforce four-tile cohesion.',
    refs: refs('monster.cpp:308-380', 'monster.cpp:504-527', 'monster.cpp:3402-3404', 'monster.cpp:4887-4899'),
  },
  {
    id: 'd1-encounter-pack-leash', title: 'Leashed pack behavior',
    body: 'Leashed pack behavior, derived from the engine: a minion inherits alertness from its leader. It becomes separated when solid geometry breaks their line, rejoins with a clear line inside four walking tiles, and may not move to four or more tiles from the leader. A dead leader releases its leashed minions.',
    refs: refs('monster.cpp:1481-1495', 'monster.cpp:1674-1729', 'monster.cpp:4357-4381'),
  },
  {
    id: 'd1-encounter-activation', title: 'Boss encounter activation',
    body: 'Boss encounter activation, derived from the engine: ordinary bosses wake on visibility. Talking uniques remain noncombatant until dialogue, quest state, or item hand-in clears their line and selects a combat goal; Lazarus and the Warlord can begin speech automatically when their tile becomes visible to a player. Books, circles, doors, and levers may gate access without themselves being the aggro event.',
    refs: refs('monster.cpp:1427-1467', 'monster.cpp:2879-3006', 'monster.cpp:4278-4317', 'monster.cpp:4747-4804'),
  },
  {
    id: 'd1-authored-monster-layers', title: 'Authored encounter rosters',
    body: 'Authored encounter rosters, derived from the engine: a DUN monster layer is read at doubled tile scale; each nonzero cell maps through the monster conversion table and places one monster at that authored offset. Quest pieces and Diablo’s four quadrants load these layers before ordinary scatter placement, so exact fixed counts belong to external DUN files, not a source-code constant.',
    refs: refs('monster.cpp:547-629', 'monster.cpp:3750-3775'),
  },
  {
    id: 'd1-unique-global-rules', title: 'Unique monster preparation',
    body: 'Unique monster preparation, derived from the engine: a unique receives its unique AI, dialogue, resistance, damage and fixed maximum HP, is halved in vanilla single player before difficulty scaling, and normally emits radius-3 light. A pending talk line selects a noncombatant goal; pack placement follows afterward. The engine has no universal encounter win or failure evaluator.',
    refs: refs('monster.cpp:3325-3412', 'quests.cpp:227-287'),
  },
] as const satisfies readonly EncounterLawData[];

export const DIABLO1_ENCOUNTER_LAWS: readonly ProjectRule[] = ENCOUNTER_LAWS_DATA.map((law) => ({
  ...law,
  profile: 'diablo1',
  category: 'game' as const,
  scope: 'combat-map',
  refs: [...law.refs],
}));
