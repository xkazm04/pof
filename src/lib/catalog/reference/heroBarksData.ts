/** Engine-derived Diablo I hero bark events. IDs, trigger conditions, and pinned file lines only. */

export interface HeroBarkSpec {
  id: string;
  trigger: string;
  speechId: string;
  playback: 'Say' | 'SaySpecific' | 'delayed Say';
  effect: string;
  refs: string[];
}

export const D1_HERO_BARK_SPECS: readonly HeroBarkSpec[] = [
  {
    id: 'struck',
    trigger: 'StartPlrHit is called after the hero is struck, including damage below the hit-recovery threshold.',
    speechId: 'ArghClang',
    playback: 'Say',
    effect: 'Request the class sound before the hit-recovery threshold can return.',
    refs: ['.reference/devilutionX/Source/player.cpp:2639-2655'],
  },
  {
    id: 'death',
    trigger: 'The hero enters the death sequence.',
    speechId: 'AuughUh',
    playback: 'Say',
    effect: 'Request the class death speech before the death animation is selected.',
    refs: ['.reference/devilutionX/Source/player.cpp:2688-2705'],
  },
  {
    id: 'spell-not-readied',
    trigger: 'A cast is attempted with no valid readied SpellID.',
    speechId: 'IDontHaveASpellReady',
    playback: 'Say',
    effect: 'Request the class sound and reject the cast.',
    refs: ['.reference/devilutionX/Source/player.cpp:3133-3143'],
  },
  {
    id: 'spell-disallowed-in-town',
    trigger: 'A spell whose data disallows town use is attempted in town.',
    speechId: 'ICantCastThatHere',
    playback: 'Say',
    effect: 'Request the class sound and reject the cast.',
    refs: ['.reference/devilutionX/Source/player.cpp:3165-3168'],
  },
  {
    id: 'learned-spell-no-mana',
    trigger: 'An ordinary learned-spell check fails for insufficient mana or the NoMana item state.',
    speechId: 'NotEnoughMana',
    playback: 'Say',
    effect: 'Request the class sound and clear the pending player action.',
    refs: [
      '.reference/devilutionX/Source/player.cpp:3187-3192',
      '.reference/devilutionX/Source/spells.cpp:200-208',
    ],
  },
  {
    id: 'learned-spell-level-zero',
    trigger: 'An ordinary learned-spell check fails because its learned spell level is zero.',
    speechId: 'ICantCastThatYet',
    playback: 'Say',
    effect: 'Request the class sound and clear the pending player action.',
    refs: ['.reference/devilutionX/Source/player.cpp:3187-3195'],
  },
  {
    id: 'learned-spell-other-failure',
    trigger: 'An ordinary learned-spell check fails for another reason, such as the hero being busy.',
    speechId: 'ICantDoThat',
    playback: 'Say',
    effect: 'Request the class sound and clear the pending player action.',
    refs: [
      '.reference/devilutionX/Source/player.cpp:3187-3199',
      '.reference/devilutionX/Source/spells.cpp:188-208',
    ],
  },
  {
    id: 'first-cathedral-entry',
    trigger: 'First eligible entry to non-set dungeon level 1, guarded by its visited and message bits.',
    speechId: 'TheSanctityOfThisPlaceHasBeenFouled',
    playback: 'delayed Say',
    effect: 'Queue the class sound with delay 40 and set the Cathedral message bit.',
    refs: ['.reference/devilutionX/Source/player.cpp:3441-3449'],
  },
  {
    id: 'first-catacombs-entry',
    trigger: 'First eligible entry to non-set dungeon level 5, guarded by its visited and message bits.',
    speechId: 'TheSmellOfDeathSurroundsMe',
    playback: 'delayed Say',
    effect: 'Queue the class sound with delay 40 and set the Catacombs message bit.',
    refs: ['.reference/devilutionX/Source/player.cpp:3449-3452'],
  },
  {
    id: 'first-caves-entry',
    trigger: 'First eligible entry to non-set dungeon level 9, guarded by its visited and message bits.',
    speechId: 'ItsHotDownHere',
    playback: 'delayed Say',
    effect: 'Queue the class sound with delay 40 and set the Caves message bit.',
    refs: ['.reference/devilutionX/Source/player.cpp:3452-3455'],
  },
  {
    id: 'first-hell-entry',
    trigger: 'First eligible entry to non-set dungeon level 13, guarded by its visited and message bits.',
    speechId: 'IMustBeGettingClose',
    playback: 'delayed Say',
    effect: 'Queue the class sound with delay 40 and set the Hell message bit.',
    refs: ['.reference/devilutionX/Source/player.cpp:3455-3457'],
  },
  {
    id: 'first-level-21-entry',
    trigger: 'First eligible entry to non-set dungeon level 21 in the Hellfire-level branch, guarded by its visited and message bits.',
    speechId: 'ThisIsAPlaceOfGreatPower',
    playback: 'delayed Say',
    effect: 'Queue the class sound with delay 30 and set the level-21 message bit.',
    refs: ['.reference/devilutionX/Source/player.cpp:3468-3482'],
  },
  {
    id: 'automatic-inventory-no-room',
    trigger: 'An automatic inventory move or equip has no destination space; stash withdrawal can produce the same result.',
    speechId: 'IHaveNoRoom',
    playback: 'SaySpecific',
    effect: 'Request the class sound unless it is missing or already playing.',
    refs: [
      '.reference/devilutionX/Source/inv.cpp:775-809',
      '.reference/devilutionX/Source/inv.cpp:915-957',
      '.reference/devilutionX/Source/qol/stash.cpp:288-301',
    ],
  },
  {
    id: 'automatic-inventory-invalid',
    trigger: 'An automatic inventory move is invalid rather than out of space, or a QoL vendor rejects a sale.',
    speechId: 'ICantDoThat',
    playback: 'SaySpecific',
    effect: 'Request the class sound unless it is missing or already playing.',
    refs: [
      '.reference/devilutionX/Source/inv.cpp:770-773',
      '.reference/devilutionX/Source/inv.cpp:879-957',
      '.reference/devilutionX/Source/qol/visual_store.cpp:700-712',
    ],
  },
  {
    id: 'stash-placement-failed',
    trigger: 'An item transfer to the stash fails because the stash cannot place it.',
    speechId: 'WhereWouldIPutThis',
    playback: 'SaySpecific',
    effect: 'Request the class sound unless it is missing or already playing.',
    refs: ['.reference/devilutionX/Source/inv.cpp:1624-1634'],
  },
  {
    id: 'wounded-townsman-repeat',
    trigger: 'The hero talks again to the wounded townsman after the Butcher conversation set its first state.',
    speechId: 'YourDeathWillBeAvenged',
    playback: 'SaySpecific',
    effect: 'Request the class sound unless it is missing or already playing.',
    refs: ['.reference/devilutionX/Source/towners.cpp:273-288'],
  },
  {
    id: 'cow-repeat-first',
    trigger: 'Repeated cow interaction reaches the first hero-line slot in the rotating cow-click sequence.',
    speechId: 'YepThatsACowAlright',
    playback: 'SaySpecific',
    effect: 'Request the class sound unless it is missing or already playing, then advance the cow-line slot.',
    refs: ['.reference/devilutionX/Source/towners.cpp:495-517'],
  },
  {
    id: 'cow-repeat-second',
    trigger: 'Repeated cow interaction reaches the second hero-line slot in the rotating cow-click sequence.',
    speechId: 'ImNotThirsty',
    playback: 'SaySpecific',
    effect: 'Request the class sound unless it is missing or already playing, then advance the cow-line slot.',
    refs: ['.reference/devilutionX/Source/towners.cpp:495-517'],
  },
  {
    id: 'cow-repeat-third',
    trigger: 'Repeated cow interaction reaches the third hero-line slot in the rotating cow-click sequence.',
    speechId: 'ImNoMilkmaid',
    playback: 'SaySpecific',
    effect: 'Request the class sound unless it is missing or already playing, then wrap the cow-line slot.',
    refs: ['.reference/devilutionX/Source/towners.cpp:495-517'],
  },
];

/** The census IDs classified as hero speech; text may only be joined through this allow-list. */
export const D1_HERO_SPEECH_LINE_IDS: readonly string[] = [
  'TEXT_BONER',
  'TEXT_BLOODY',
  'TEXT_BLINDING',
  'TEXT_BLOODWAR',
  'TEXT_MBONER',
  'TEXT_MBLOODY',
  'TEXT_MBLINDING',
  'TEXT_MBLOODWAR',
  'TEXT_RBONER',
  'TEXT_RBLOODY',
  'TEXT_RBLINDING',
  'TEXT_RBLOODWAR',
];

export const D1_HERO_SOUND_RESOLUTION_REFS: readonly string[] = [
  '.reference/devilutionX/Source/player.cpp:1701-1725',
  '.reference/devilutionX/Source/tables/playerdat.cpp:281-292',
  '.reference/devilutionX/Source/tables/playerdat.cpp:385-395',
];
