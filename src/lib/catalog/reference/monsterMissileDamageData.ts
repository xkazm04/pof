/** Pin-verified monster-owned missile damage formulas; no monster or missile table row values live here. */
import type {
  MonsterMissileDamageSource,
  MonsterMissileSelectionPolicy,
} from '@/lib/catalog/reference/monsterMissileDamage';

const missile = (line: number): string => `.reference/devilutionX/Source/missiles.cpp:${line}`;
const monster = (line: number): string => `.reference/devilutionX/Source/monster.cpp:${line}`;
const misdat = (line: number): string => `.reference/devilutionX/assets/txtdata/missiles/misdat.tsv:${line}`;

export const MONSTER_MISSILE_DAMAGE_SOURCES_DATA = [
  {
    missile: 'Arrow', routines: ['SkeletonRanged', 'GoatRanged'], formula: { kind: 'monster-normal' },
    projectilesPerAttack: 1, collision: 'ordinary-range', hitCount: { kind: 'fixed', hits: 1 },
    omittedEffects: [], refs: [monster(1307), monster(1943), monster(1999), monster(2173), missile(2945), missile(2961), missile(2970), misdat(2)],
  },
  {
    missile: 'Rhino', routines: ['Rhino', 'Snake'], formula: { kind: 'monster-special' },
    projectilesPerAttack: 1, collision: 'monster-attack', hitCount: { kind: 'fixed', hits: 1 },
    omittedEffects: [], refs: [monster(2287), monster(2679), missile(2264), missile(3738), monster(4580), monster(4600), misdat(22)],
  },
  {
    missile: 'Rhino', routines: ['Bat'], formula: { kind: 'none' },
    projectilesPerAttack: 1, collision: 'monster-attack', hitCount: { kind: 'fixed', hits: 0 },
    omittedEffects: [], refs: [monster(2453), monster(2457), missile(3738), monster(4592), misdat(22)],
  },
  {
    missile: 'MagmaBall', routines: ['Magma'], formula: { kind: 'monster-normal' },
    projectilesPerAttack: 1, collision: 'ordinary-fixed', hitCount: { kind: 'fixed', hits: 1 },
    omittedEffects: [], refs: [monster(1963), monster(2023), monster(2038), missile(267), missile(1903), missile(1922), missile(2976), missile(2980), misdat(23)],
  },
  {
    missile: 'Lightning', routines: ['Bat'], formula: { kind: 'fixed-range', min: 1, max: 10 },
    projectilesPerAttack: 1, collision: 'already-shifted',
    hitCount: { kind: 'unresolved', modeledHits: 1, reason: 'Movement and occupancy determine how many of the eight segment ticks collide.' },
    omittedEffects: ['The Familiar lightning segment persists for eight ticks; the duel models one hit per exchange.'],
    refs: [monster(2472), monster(2473), missile(2008), missile(2016), missile(3378), missile(3383), misdat(10)],
  },
  {
    missile: 'BloodStar', routines: ['Succubus', 'LazarusSuccubus'], formula: { kind: 'monster-normal' },
    projectilesPerAttack: 1, collision: 'ordinary-fixed', hitCount: { kind: 'fixed', hits: 1 },
    omittedEffects: [], refs: [monster(1945), monster(1999), monster(2948), missile(2284), missile(2311), missile(2319), missile(2976), missile(2980), misdat(26)],
  },
  {
    missile: 'ThinLightningControl', routines: ['Storm'], formula: { kind: 'monster-normal', multiplier: 2 },
    projectilesPerAttack: 1, collision: 'already-shifted',
    hitCount: { kind: 'unresolved', modeledHits: 1, reason: 'Movement and occupancy determine how many segment ticks collide.' },
    omittedEffects: ['A stationary player can be checked on every tick of an eight- or ten-tick ThinLightning segment; the duel models one segment hit per exchange.'],
    refs: [monster(1965), monster(2024), monster(2038), missile(808), missile(831), missile(3359), missile(3371), missile(3375), missile(3383), misdat(24)],
  },
  {
    missile: 'Acid', routines: ['Acid', 'AcidUnique'], formula: { kind: 'monster-normal' },
    projectilesPerAttack: 1, collision: 'ordinary-fixed', hitCount: { kind: 'fixed', hits: 1 },
    omittedEffects: ['The AcidSplat child and persistent AcidPuddle ticks are omitted.'],
    refs: [monster(1948), monster(1996), missile(2328), missile(2339), missile(2345), missile(2976), missile(2980), missile(2993), missile(3644), missile(3654), missile(3048), missile(3052), misdat(59)],
  },
  {
    missile: 'Firebolt', routines: ['Counselor', 'Zhar', 'Lazarus'], formula: { kind: 'monster-normal' },
    projectilesPerAttack: 1, collision: 'ordinary-fixed', hitCount: { kind: 'fixed', hits: 1 },
    omittedEffects: [], refs: [monster(2756), monster(2757), monster(2813), monster(2922), missile(1867), missile(1886), missile(2976), missile(2980), misdat(3)],
  },
  {
    missile: 'ChargedBolt', routines: ['Counselor', 'Zhar', 'Lazarus'], formula: { kind: 'fixed', value: 15 },
    projectilesPerAttack: 3, collision: 'ordinary-fixed', hitCount: { kind: 'fixed', hits: 3 },
    omittedEffects: [], refs: [monster(1303), monster(1307), monster(2756), monster(2757), missile(2702), missile(2706), missile(3992), missile(4015), misdat(54)],
  },
  {
    missile: 'LightningControl', routines: ['Counselor', 'Zhar', 'Lazarus'], formula: { kind: 'monster-normal', multiplier: 2 },
    projectilesPerAttack: 1, collision: 'already-shifted',
    hitCount: { kind: 'unresolved', modeledHits: 1, reason: 'Movement and occupancy determine how many segment ticks collide.' },
    omittedEffects: ['A stationary player can be checked on every tick of an eight- or ten-tick Lightning segment; the duel models one segment hit per exchange.'],
    refs: [monster(2756), monster(2757), missile(1999), missile(808), missile(3359), missile(3371), missile(3375), missile(3383), misdat(9)],
  },
  {
    missile: 'Fireball', routines: ['Counselor', 'Zhar', 'Lazarus'], formula: { kind: 'monster-normal' },
    projectilesPerAttack: 1, collision: 'ordinary-fixed', hitCount: { kind: 'fixed', hits: 1 },
    omittedEffects: ['The line-visible 3x3 termination blast and any second hit after the flight collision are omitted.'],
    refs: [monster(2756), monster(2757), missile(1977), missile(3099), missile(3112), missile(3118), missile(3123), missile(3136), misdat(8)],
  },
  {
    missile: 'FlashBottom', routines: ['Counselor', 'Zhar', 'Lazarus'], formula: { kind: 'monster-level', multiplier: 2 },
    projectilesPerAttack: 1, collision: 'already-shifted',
    hitCount: { kind: 'unresolved', modeledHits: 1, reason: 'Movement and occupancy determine how many of the 19 area ticks collide.' },
    omittedEffects: ['The six-tile area is checked for 19 ticks; the duel models one hit when this missile is selected directly.'],
    refs: [monster(2774), missile(2125), missile(2134), missile(2135), missile(3425), missile(3441), missile(3442), misdat(13)],
  },
  {
    missile: 'FlashTop', routines: ['Counselor', 'Zhar', 'Lazarus'], formula: { kind: 'fixed', value: 4 },
    projectilesPerAttack: 1, collision: 'already-shifted',
    hitCount: { kind: 'unresolved', modeledHits: 1, reason: 'Movement and occupancy determine how many of the 19 area ticks collide.' },
    omittedEffects: ['The three-tile area is checked for 19 ticks; the duel models one hit when this missile is selected directly.'],
    refs: [monster(2775), missile(2145), missile(2147), missile(3454), missile(3462), missile(3468), misdat(14)],
  },
  {
    missile: 'InfernoControl', routines: ['Mega'], formula: { kind: 'monster-normal' },
    projectilesPerAttack: 1, collision: 'already-shifted',
    hitCount: { kind: 'unresolved', modeledHits: 1, reason: 'Path geometry, movement, and occupancy determine how many segment ticks collide.' },
    omittedEffects: ['Up to three persistent Inferno path segments and their repeated per-tick checks are omitted; the duel models one segment hit per exchange.'],
    refs: [monster(2854), monster(2867), missile(2672), missile(2684), missile(2686), missile(2690), missile(3940), missile(3945), missile(3964), missile(3971), misdat(51)],
  },
  {
    missile: 'DiabloApocalypse', routines: ['Diablo'], formula: { kind: 'fixed', value: 40 },
    projectilesPerAttack: 1, collision: 'ordinary-fixed', hitCount: { kind: 'fixed', hits: 1 },
    omittedEffects: ['Multiplayer fan-out is omitted; a single-player duel has one line-clear player and therefore one boom.'],
    refs: [monster(1967), monster(2023), monster(2038), missile(2793), missile(2801), missile(3726), missile(3730), misdat(68), misdat(69)],
  },
  {
    missile: 'HorkSpawn', routines: ['HorkDemon'], formula: { kind: 'none' },
    projectilesPerAttack: 1, collision: 'none', hitCount: { kind: 'fixed', hits: 0 },
    omittedEffects: ['The summoned monster is outside the duel exchange.'],
    elementGap: 'Hellfire-only HorkSpawn is absent from the pinned checked-in misdat.tsv, so its element is unresolved.',
    refs: [monster(3043), missile(1351), missile(3168), missile(3171), missile(3181), missile(1067), missile(1154), missile(1169)],
  },
] as const satisfies readonly MonsterMissileDamageSource[];

/** Multi-missile routine choices that the engine resolves from monster subtype/intelligence. */
export const MONSTER_MISSILE_SELECTION_POLICIES_DATA = [
  {
    routines: ['Counselor', 'Zhar', 'Lazarus'],
    kind: 'intelligence-index',
    missiles: ['Firebolt', 'ChargedBolt', 'LightningControl', 'Fireball'],
    refs: [monster(2753), monster(2756), monster(2757)],
    rationale: 'CounselorAi indexes this four-missile array directly by intelligence; adjacent Flash is not the primary ranged exchange.',
  },
  {
    routines: ['Bat'],
    kind: 'bat-subtype',
    gloomMonsterType: 'MT_GLOOM',
    familiarMonsterType: 'MT_FAMILIAR',
    gloomMissile: 'Rhino',
    familiarMissile: 'Lightning',
    refs: [monster(2453), monster(2457), monster(2472), monster(2473)],
    rationale: 'Only the MT_GLOOM subtype charges and only MT_FAMILIAR creates Lightning; other Bat families use melee.',
  },
] as const satisfies readonly MonsterMissileSelectionPolicy[];
