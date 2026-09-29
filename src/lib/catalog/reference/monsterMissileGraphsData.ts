/** Pin-verified state-machine ownership and damage branches for monster-fired missiles. */
import type {
  MissileBehaviourGraphData,
  MissileFormulaData,
  MonsterMissileBehaviourGraphSpecData,
  MonsterMissileDamageBranchData,
  MonsterMissileGraphExclusionData,
  MonsterMissileKineticsBranchData,
  MonsterMissileLifetimeEvaluation,
  MonsterMissileSpeedEvaluation,
} from '@/lib/catalog/reference/missileBehaviourGraphs';

const missiles = (lines: string): string => `.reference/devilutionX/Source/missiles.cpp:${lines}`;
const monster = (lines: string): string => `.reference/devilutionX/Source/monster.cpp:${lines}`;
const displacement = (lines: string): string => `.reference/devilutionX/Source/engine/displacement.hpp:${lines}`;

const SpeedSymbols = {
  S: 'executed spell level (_mispllvl)',
  P: 'engine velocityInPixels; 16 is one normalized tile-speed unit',
} as const;
const LifetimeSymbols = {
  S: 'executed spell level (_mispllvl)',
  I: 'source monster intelligence',
  A: 'selected missile sprite animation length',
  k: 'zero-based spawned segment index',
  R15: 'GenerateRnd(15), uniformly 0 through 14',
} as const;

const speed = (
  evaluation: MonsterMissileSpeedEvaluation,
  formula: string,
  refs: readonly string[],
): MissileFormulaData<MonsterMissileSpeedEvaluation> => ({
  evaluation, formula, symbols: SpeedSymbols, refs: [...refs, displacement('190-206')],
});

const lifetime = (
  evaluation: MonsterMissileLifetimeEvaluation,
  formula: string,
  refs: readonly string[],
  animationGraphic?: string,
): MissileFormulaData<MonsterMissileLifetimeEvaluation> => ({
  evaluation, formula, symbols: LifetimeSymbols, refs,
  ...(animationGraphic ? { animationGraphic } : {}),
});

const kinetics = (
  source: MonsterMissileKineticsBranchData['source'],
  speedRule: MissileFormulaData<MonsterMissileSpeedEvaluation>,
  lifetimeRule: MissileFormulaData<MonsterMissileLifetimeEvaluation>,
  refs: readonly string[],
  routines?: readonly string[],
): MonsterMissileKineticsBranchData => ({
  source, ...(routines ? { routines } : {}), speed: speedRule, lifetime: lifetimeRule, refs,
});

const damage = (
  source: MonsterMissileDamageBranchData['source'],
  target: string,
  formula: string,
  units: MonsterMissileDamageBranchData['units'],
  isDamageShifted: boolean | null,
  landedFloor: string | null,
  refs: readonly string[],
  routines?: readonly string[],
): MonsterMissileDamageBranchData => ({
  source, ...(routines ? { routines } : {}), target, formula, units, isDamageShifted, landedFloor, refs,
});

const playerFloor = 'max(damage + playerGetHit adjustment, 64 internal units) after a landed PlayerMHit check';
const noDamage = (target: string, refs: readonly string[]): MonsterMissileDamageBranchData =>
  damage('none', target, 'none', 'none', null, null, refs);

const arrowGraph: MissileBehaviourGraphData = {
  missile: 'Arrow', addFn: 'AddArrow', processFn: 'ProcessArrow', initialState: 'flight',
  states: [
    { id: 'flight', label: 'Blockable straight arrow flight checks newly traversed tiles', refs: [missiles('1779-1823'), missiles('2945-2974')] },
    { id: 'deleted', label: 'Arrow stopped by a hit, blocking terrain, or lifetime expiry', terminal: true, refs: [missiles('2945-2974')] },
  ],
  transitions: [
    { from: 'flight', nextState: 'flight', trigger: 'tick-counter', guard: 'no successful actor hit, blocking tile, or lifetime expiry', effect: 'Decrement duration, increase missile distance, move, and check each newly traversed tile.', refs: [missiles('643-672'), missiles('2945-2974')] },
    { from: 'flight', nextState: 'deleted', trigger: 'collision', guard: 'an eligible actor hit sets duration to zero', effect: 'PlayerMHit uses the monster ordinary damage columns and the arrow to-hit branch; the arrow does not pierce.', refs: [missiles('486-555'), missiles('1067-1170'), missiles('2945-2974')] },
    { from: 'flight', nextState: 'deleted', trigger: 'wall', guard: 'a traversed tile blocks missiles', effect: 'Stop at the blocking path boundary and delete.', refs: [missiles('543-672'), missiles('2945-2974')] },
    { from: 'flight', nextState: 'deleted', trigger: 'lifetime', guard: 'the 256-tick counter reaches zero', effect: 'Delete the arrow.', refs: [missiles('2945-2974')] },
  ],
  geometryChecks: [{ check: 'Swept actor and missile-blocking terrain collision', origin: 'current-position', target: 'newly traversed tiles, ignoring the start tile', refs: [missiles('562-672'), missiles('2945-2974')] }],
  speed: speed('constant-32', '32/16 for monster sources', [missiles('1779-1823')]),
  lifetime: lifetime('exact-256', '256 flight ticks maximum', [missiles('1779-1823'), missiles('2945-2974')]),
  ends: [{ cause: 'First eligible actor hit, missile-blocking terrain, or the flight counter.', refs: [missiles('2945-2974')] }],
  spawns: [], refs: [missiles('1779-1823'), missiles('2945-2974')],
};

const magmaBallGraph: MissileBehaviourGraphData = {
  missile: 'MagmaBall', addFn: 'AddMagmaBall', processFn: 'ProcessGenericProjectile', initialState: 'advanced-flight',
  states: [
    { id: 'advanced-flight', label: 'Add* advances three velocity steps before blockable straight flight begins', refs: [missiles('1903-1929'), missiles('2976-3026')] },
    { id: 'deleted', label: 'Flight ended after spawning its visual explosion', terminal: true, refs: [missiles('2976-3026')] },
  ],
  transitions: [
    { from: 'advanced-flight', nextState: 'advanced-flight', trigger: 'tick-counter', guard: 'no stopping hit, wall, or lifetime expiry', effect: 'Decrement duration, move, and collision-check newly traversed tiles.', refs: [missiles('643-672'), missiles('2976-3026')] },
    { from: 'advanced-flight', nextState: 'deleted', trigger: 'collision', guard: 'an eligible actor hit sets duration to zero', effect: 'Use monster normal damage in whole-HP units, then spawn MagmaBallExplosion as a visual-only child.', refs: [missiles('267-271'), missiles('486-555'), missiles('2976-3026')] },
    { from: 'advanced-flight', nextState: 'deleted', trigger: 'wall', guard: 'a traversed tile blocks missiles', effect: 'Stop and spawn MagmaBallExplosion.', refs: [missiles('543-672'), missiles('2976-3026')] },
    { from: 'advanced-flight', nextState: 'deleted', trigger: 'lifetime', guard: 'the vanilla 256-tick counter reaches zero', effect: 'Spawn MagmaBallExplosion and delete the parent.', refs: [missiles('1903-1929'), missiles('2976-3026')] },
  ],
  geometryChecks: [{ check: 'Swept actor and missile-blocking terrain collision after the add-time three-step advance', origin: 'current-position', target: 'newly traversed tiles, ignoring the stored start tile', refs: [missiles('643-672'), missiles('1903-1929'), missiles('2976-3026')] }],
  speed: speed('constant-16', '16/16, with three velocity steps applied during Add*', [missiles('1903-1929')]),
  lifetime: lifetime('exact-256', '256 flight ticks in vanilla', [missiles('1903-1929'), missiles('2976-3026')]),
  ends: [{ cause: 'First eligible actor hit, missile-blocking terrain, or flight counter expiry.', refs: [missiles('2976-3026')] }],
  spawns: [{ missile: 'MagmaBallExplosion', trigger: 'whenever flight ends', refs: [missiles('2976-3026')] }],
  refs: [missiles('1903-1929'), missiles('2976-3026')],
};

const rhinoGraph: MissileBehaviourGraphData = {
  missile: 'Rhino', addFn: 'AddRhino', processFn: 'ProcessRhino', initialState: 'charge',
  states: [
    { id: 'charge', label: 'Missile movement owns and relocates the charging monster', refs: [missiles('2264-2282'), missiles('3738-3773')] },
    { id: 'deleted', label: 'Charge mode or route ended', terminal: true, refs: [missiles('3738-3773'), monster('4580-4623')] },
  ],
  transitions: [
    { from: 'charge', nextState: 'charge', trigger: 'tick-counter', guard: 'source remains in Charge mode and the next route tile is available', effect: 'Advance at velocity 18, move the monster occupancy, and move its unique light when present.', refs: [missiles('3738-3773')] },
    { from: 'charge', nextState: 'deleted', trigger: 'external', guard: 'the source monster is no longer in Charge mode', effect: 'Delete the missile immediately.', refs: [missiles('3738-3745')] },
    { from: 'charge', nextState: 'deleted', trigger: 'wall', guard: 'the next monster tile is unavailable, or the Snake look-ahead/animation guard ends', effect: 'Call MissToMonst at the previous tile; non-Gloom collisions use the monster special damage channel.', refs: [missiles('3746-3760'), monster('4580-4623')] },
  ],
  geometryChecks: [
    { check: 'IsTileAvailable route check', origin: 'current-position', target: 'next velocity tile', refs: [missiles('3746-3760')] },
    { check: 'Snake two-velocity-step look-ahead', origin: 'current-position', target: 'the additional Snake route tile', refs: [missiles('3748-3760')] },
  ],
  speed: speed('constant-18', '18/16', [missiles('2264-2282')]),
  lifetime: lifetime('charge-runtime', 'no decrementing lifetime; source Charge mode, route availability, or Snake animation ends it', [missiles('2264-2282'), missiles('3738-3773')]),
  ends: [{ cause: 'Source leaves Charge mode or route/animation termination calls MissToMonst.', refs: [missiles('3738-3773')] }],
  spawns: [], refs: [missiles('2264-2282'), missiles('3738-3773'), monster('4580-4623')],
};

const thinLightningControlGraph: MissileBehaviourGraphData = {
  missile: 'ThinLightningControl', addFn: 'AddLightningControl', processFn: 'ProcessLightningControl', initialState: 'laying-path',
  states: [
    { id: 'laying-path', label: 'Moving Storm controller advances and lays one ThinLightning segment per new tile', refs: [missiles('808-850'), missiles('1999-2006'), missiles('3359-3376')] },
    { id: 'deleted', label: 'Path controller stopped', terminal: true, refs: [missiles('808-850')] },
  ],
  transitions: [
    { from: 'laying-path', nextState: 'laying-path', trigger: 'tick-counter', guard: 'duration remains and the current tile is not missile-blocking', effect: 'Roll twice the monster normal damage value in internal units and spawn ThinLightning when the tile changed.', refs: [missiles('808-850'), missiles('3359-3376')] },
    { from: 'laying-path', nextState: 'deleted', trigger: 'wall', guard: 'the traversed/current tile blocks missiles', effect: 'Set duration zero and do not lay a segment on the blocked tile.', refs: [missiles('808-850')] },
    { from: 'laying-path', nextState: 'deleted', trigger: 'lifetime', guard: 'the 256-tick controller duration reaches zero', effect: 'Delete the controller.', refs: [missiles('808-850'), missiles('3359-3376')] },
  ],
  geometryChecks: [{ check: 'Controller terrain path', origin: 'current-position', target: 'each newly traversed tile', refs: [missiles('808-850')] }],
  speed: speed('constant-32', '32/16', [missiles('1999-2006')]),
  lifetime: lifetime('exact-256', '256 controller ticks maximum', [missiles('1999-2006'), missiles('808-850')]),
  ends: [{ cause: 'Missile-blocking terrain or controller lifetime expiry.', refs: [missiles('808-850')] }],
  spawns: [{ missile: 'ThinLightning', trigger: 'each distinct unblocked path tile for a Storm-family source monster', refs: [missiles('808-850'), missiles('3359-3376')] }],
  refs: [missiles('808-850'), missiles('1999-2006'), missiles('3359-3376')],
};

const acidGraph: MissileBehaviourGraphData = {
  missile: 'Acid', addFn: 'AddAcid', processFn: 'ProcessGenericProjectile', initialState: 'flight',
  states: [
    { id: 'flight', label: 'Blockable acid flight uses an intelligence-scaled counter', refs: [missiles('2328-2361'), missiles('2976-3026')] },
    { id: 'deleted', label: 'Acid parent ended after spawning AcidSplat', terminal: true, refs: [missiles('2976-3026')] },
  ],
  transitions: [
    { from: 'flight', nextState: 'flight', trigger: 'tick-counter', guard: 'no stopping actor hit, wall, or lifetime expiry', effect: 'Decrement duration, move, and collision-check newly traversed tiles.', refs: [missiles('643-672'), missiles('2976-3026')] },
    { from: 'flight', nextState: 'deleted', trigger: 'collision', guard: 'an eligible actor hit sets duration to zero', effect: 'Apply monster normal damage in whole-HP units, then create AcidSplat.', refs: [missiles('267-271'), missiles('486-555'), missiles('2976-3026')] },
    { from: 'flight', nextState: 'deleted', trigger: 'wall', guard: 'a traversed tile blocks missiles', effect: 'Stop and create AcidSplat.', refs: [missiles('543-672'), missiles('2976-3026')] },
    { from: 'flight', nextState: 'deleted', trigger: 'lifetime', guard: 'the 5*(I+4) vanilla counter reaches zero', effect: 'Create AcidSplat.', refs: [missiles('2328-2361'), missiles('2976-3026')] },
  ],
  geometryChecks: [{ check: 'Swept actor and missile-blocking terrain collision', origin: 'current-position', target: 'newly traversed tiles, ignoring the start tile', refs: [missiles('562-672'), missiles('2976-3026')] }],
  speed: speed('constant-16', '16/16', [missiles('2328-2361')]),
  lifetime: lifetime('acid-flight', '5*(I+4) flight ticks in vanilla', [missiles('2328-2361')]),
  ends: [{ cause: 'First eligible actor hit, missile-blocking terrain, or intelligence-scaled flight expiry.', refs: [missiles('2976-3026')] }],
  spawns: [{ missile: 'AcidSplat', trigger: 'whenever flight ends', refs: [missiles('2976-3026')] }],
  refs: [missiles('2328-2361'), missiles('2976-3026')],
};

const acidSplatGraph: MissileBehaviourGraphData = {
  missile: 'AcidSplat', addFn: 'AddMissileExplosion', processFn: 'ProcessAcidSplate', initialState: 'impact-animation',
  states: [
    { id: 'impact-animation', label: 'Stationary non-damaging impact animation shifted southeast on its first tick', refs: [missiles('2027-2055'), missiles('3644-3658')] },
    { id: 'deleted', label: 'Impact animation ended after creating the puddle', terminal: true, refs: [missiles('3644-3658')] },
  ],
  transitions: [
    { from: 'impact-animation', nextState: 'impact-animation', trigger: 'animation', guard: 'animation duration remains above zero', effect: 'On the first tick shift the logical tile by Displacement{1,1}, adjust the render offset, and continue the visual.', refs: [missiles('3644-3651')] },
    { from: 'impact-animation', nextState: 'deleted', trigger: 'lifetime', guard: 'animation duration reaches zero', effect: 'Choose puddle damage from the source monster base-level threshold, spawn AcidPuddle on the shifted tile, and delete the splat.', refs: [missiles('3650-3658')] },
  ],
  geometryChecks: [{ check: 'First-tick fixed impact displacement', origin: 'current-position', target: 'current tile plus Displacement{1,1}', refs: [missiles('3644-3649')] }],
  speed: speed('stationary', '0', [missiles('2027-2055')]),
  lifetime: lifetime('animation', 'A', [missiles('2027-2055'), missiles('3644-3658')], 'AcidSplat'),
  ends: [{ cause: 'The splat animation reaches zero after spawning AcidPuddle.', refs: [missiles('3644-3658')] }],
  spawns: [{ missile: 'AcidPuddle', trigger: 'splat animation expiry', refs: [missiles('3650-3658')] }],
  refs: [missiles('2027-2055'), missiles('3644-3658')],
};

const acidPuddleGraph: MissileBehaviourGraphData = {
  missile: 'AcidPuddle', addFn: 'AddAcidPuddle', processFn: 'ProcessAcidPuddle', initialState: 'idle-damage',
  states: [
    { id: 'idle-damage', label: 'Stationary idle puddle repeatedly checks its shifted impact tile', refs: [missiles('2355-2361'), missiles('3048-3063')] },
    { id: 'ending-damage', label: 'Ending animation continues the same repeated tile checks', refs: [missiles('3048-3063')] },
    { id: 'deleted', label: 'Ending animation and its final collision check completed', terminal: true, refs: [missiles('3048-3063')] },
  ],
  transitions: [
    { from: 'idle-damage', nextState: 'idle-damage', trigger: 'collision', guard: 'a player occupies the puddle tile while the randomized idle counter remains', effect: `Call PlayerMHit with isDamageShifted=true; a landed check is floored to 64 internal units, and restoring the post-decrement counter keeps the puddle active.`, refs: [missiles('486-555'), missiles('1067-1170'), missiles('3048-3054')] },
    { from: 'idle-damage', nextState: 'ending-damage', trigger: 'lifetime', guard: 'R15+40*(I+1) idle ticks reach zero', effect: 'Switch to the End frame group and reset duration to A; collision checking continues.', refs: [missiles('3048-3060')] },
    { from: 'ending-damage', nextState: 'ending-damage', trigger: 'collision', guard: 'a player occupies the puddle tile and ending duration remains', effect: `Repeat the shifted PlayerMHit check with the same 64-internal-unit landed floor; restore the post-decrement ending counter after a hit.`, refs: [missiles('486-555'), missiles('1067-1170'), missiles('3048-3054')] },
    { from: 'ending-damage', nextState: 'deleted', trigger: 'lifetime', guard: 'the A-tick ending duration reaches zero', effect: 'The zero-duration tick still performs its collision check, then marks the puddle for deletion.', refs: [missiles('3048-3063')] },
  ],
  geometryChecks: [{ check: 'Repeated stationary actor collision', origin: 'current-position', target: 'the AcidSplat-shifted puddle tile on every idle and ending tick', refs: [missiles('3048-3063'), missiles('3644-3658')] }],
  speed: speed('stationary', '0', [missiles('2355-2361')]),
  lifetime: lifetime('acid-puddle-phases', 'R15+40*(I+1) idle checks, followed by A ending-animation checks', [missiles('2355-2361'), missiles('3048-3063')], 'AcidPuddle'),
  ends: [{ cause: 'The randomized intelligence-scaled idle phase and ending animation both expire; actor hits never end it.', refs: [missiles('3048-3063')] }],
  spawns: [], refs: [missiles('2355-2361'), missiles('3048-3063'), missiles('3644-3658')],
};

const diabloApocalypseGraph: MissileBehaviourGraphData = {
  missile: 'DiabloApocalypse', addFn: 'AddDiabloApocalypse', processFn: null, initialState: 'fan-out',
  states: [
    { id: 'fan-out', label: 'Add* scans active players and creates a boom at each line-clear future tile', refs: [missiles('2793-2806')] },
    { id: 'deleted', label: 'Immediate fan-out controller deleted', terminal: true, refs: [missiles('2793-2806')] },
  ],
  transitions: [{ from: 'fan-out', nextState: 'deleted', trigger: 'add', guard: 'active-player scan completes', effect: 'For every active player passing LineClearMissile, spawn DiabloApocalypseBoom with the caller damage argument; then set _miDelFlag.', refs: [missiles('2793-2806')] }],
  geometryChecks: [{ check: 'LineClearMissile active-player fan-out', origin: 'caster', target: 'each active player future tile', refs: [missiles('2793-2806')] }],
  speed: speed('stationary', '0', [missiles('2793-2806')]),
  lifetime: lifetime('immediate', '0 (deleted during Add*)', [missiles('2793-2806')]),
  ends: [{ cause: 'Add* always deletes the controller after the active-player scan.', refs: [missiles('2793-2806')] }],
  spawns: [{ missile: 'DiabloApocalypseBoom', trigger: 'once for each active line-clear player', refs: [missiles('2793-2806')] }],
  refs: [missiles('2793-2806')],
};

const diabloApocalypseBoomGraph: MissileBehaviourGraphData = {
  missile: 'DiabloApocalypseBoom', addFn: 'AddApocalypseBoom', processFn: 'ProcessApocalypseBoom', initialState: 'damage-until-hit',
  states: [
    { id: 'damage-until-hit', label: 'Stationary boom retries its selected player tile until first successful hit', refs: [missiles('2455-2460'), missiles('3726-3736')] },
    { id: 'visual-only', label: 'After first successful hit, only the remaining animation runs', refs: [missiles('3726-3736')] },
    { id: 'deleted', label: 'Boom animation exhausted', terminal: true, refs: [missiles('3726-3736')] },
  ],
  transitions: [
    { from: 'damage-until-hit', nextState: 'damage-until-hit', trigger: 'tick-counter', guard: 'PlayerMHit misses and animation duration remains', effect: 'Retry the same player future tile on the next tick.', refs: [missiles('3726-3736')] },
    { from: 'damage-until-hit', nextState: 'visual-only', trigger: 'collision', guard: '_miHitFlag becomes true', effect: 'Apply the fixed whole-HP caller value through PlayerMHit and set var1 so later ticks skip collision.', refs: [missiles('486-555'), missiles('1067-1170'), missiles('3726-3736')] },
    { from: 'damage-until-hit', nextState: 'deleted', trigger: 'lifetime', guard: 'animation expires without a successful hit', effect: 'Delete the boom.', refs: [missiles('3726-3736')] },
    { from: 'visual-only', nextState: 'deleted', trigger: 'lifetime', guard: 'animation duration reaches zero', effect: 'Delete the visual.', refs: [missiles('3726-3736')] },
  ],
  geometryChecks: [{ check: 'Repeated stationary actor collision until first landed hit', origin: 'current-position', target: 'the active player future tile selected by DiabloApocalypse', refs: [missiles('2793-2806'), missiles('3726-3736')] }],
  speed: speed('stationary', '0', [missiles('2455-2460')]),
  lifetime: lifetime('animation', 'A', [missiles('2455-2460'), missiles('3726-3736')], 'DiabloApocalypseBoom'),
  ends: [{ cause: 'The animation expires; collision attempts stop after the first successful hit.', refs: [missiles('3726-3736')] }],
  spawns: [], refs: [missiles('2455-2460'), missiles('2793-2806'), missiles('3726-3736')],
};

const counselors = ['Counselor', 'Zhar', 'Lazarus'] as const;
const acidRoutines = ['Acid', 'AcidUnique'] as const;

export const MONSTER_MISSILE_BEHAVIOUR_GRAPHS_DATA: readonly MonsterMissileBehaviourGraphSpecData[] = [
  {
    missile: 'Arrow', graph: arrowGraph, directRoutines: ['SkeletonRanged', 'GoatRanged'], spawnedBy: [], projectilesPerAttack: 1,
    kinetics: [kinetics('monster', arrowGraph.speed, arrowGraph.lifetime, [monster('1303-1316'), missiles('1779-1823'), missiles('2945-2974')], ['SkeletonRanged', 'GoatRanged'])],
    damage: [
      damage('player', 'Arrow', 'source player weapon physical bounds', 'whole-hit-points', false, playerFloor, [missiles('2945-2974')]),
      damage('monster', 'Arrow', 'RandomIntBetween(monster.minDamage, monster.maxDamage)', 'whole-hit-points', false, playerFloor, [missiles('2945-2974'), missiles('1067-1170')], ['SkeletonRanged', 'GoatRanged']),
    ], refs: [monster('1303-1316'), missiles('1779-1823'), missiles('2945-2974')],
  },
  {
    missile: 'Rhino', graph: rhinoGraph, directRoutines: ['Rhino', 'Snake', 'Bat'], spawnedBy: [], projectilesPerAttack: 1,
    kinetics: [kinetics('monster', rhinoGraph.speed, rhinoGraph.lifetime, [missiles('2264-2282'), missiles('3738-3773')], ['Rhino', 'Snake', 'Bat'])],
    damage: [
      damage('monster', 'Rhino', 'RandomIntBetween(monster.minDamageSpecial<<6, monster.maxDamageSpecial<<6)', 'fixed-point-1/64-hit-point', null, playerFloor, [monster('4580-4623')], ['Rhino', 'Snake']),
      damage('none', 'Rhino', 'Gloom charge skips MonsterAttackPlayer', 'none', null, null, [monster('4592-4615')], ['Bat']),
    ], refs: [missiles('2264-2282'), missiles('3738-3773'), monster('4580-4623')],
  },
  {
    missile: 'MagmaBall', graph: magmaBallGraph, directRoutines: ['Magma'], spawnedBy: [], projectilesPerAttack: 1,
    kinetics: [kinetics('monster', magmaBallGraph.speed, magmaBallGraph.lifetime, [missiles('1903-1929'), missiles('2976-3026')], ['Magma'])],
    damage: [damage('monster', 'MagmaBall', 'ProjectileMonsterDamage = RandomIntBetween(monster.minDamage, monster.maxDamage)', 'whole-hit-points', false, playerFloor, [missiles('267-271'), missiles('1903-1929'), missiles('2976-3026'), missiles('1067-1170')], ['Magma'])],
    refs: [monster('1963-1968'), monster('2013-2067'), missiles('1903-1929'), missiles('2976-3026')],
  },
  {
    missile: 'MagmaBallExplosion', baseMissile: 'MagmaBallExplosion', directRoutines: [],
    spawnedBy: [
      { missile: 'MagmaBall', routines: ['Magma'], refs: [missiles('2976-3026')] },
      { missile: 'Firebolt', routines: counselors, refs: [missiles('2976-3026')] },
    ], projectilesPerAttack: 1,
    kinetics: [kinetics('monster', speed('stationary', '0', [missiles('2027-2055')]), lifetime('animation', 'A', [missiles('2027-2055'), missiles('3626-3642')], 'MagmaBallExplosion'), [missiles('2027-2055'), missiles('3626-3642')])],
    damage: [noDamage('MagmaBallExplosion', [missiles('3626-3642')])], refs: [missiles('2027-2055'), missiles('2976-3026'), missiles('3626-3642')],
  },
  {
    missile: 'Lightning', baseMissile: 'Lightning', directRoutines: ['Bat'],
    spawnedBy: [{ missile: 'LightningControl', routines: counselors, refs: [missiles('808-850'), missiles('3359-3376')] }], projectilesPerAttack: 1,
    kinetics: [
      kinetics('player', speed('stationary', '0', [missiles('2008-2025')]), lifetime('lightning-segment', 'floor(S/2)+6', [missiles('2008-2025')]), [missiles('2008-2025')]),
      kinetics('monster', speed('stationary', '0', [missiles('2008-2025')]), lifetime('monster-lightning-segment', '8 for Familiar direct placement; 10 for Counselor-family controller children', [missiles('2008-2025')]), [missiles('2008-2025')], ['Bat', ...counselors]),
    ],
    damage: [
      damage('player', 'Lightning', '(GenerateRnd(2)+GenerateRnd(characterLevel)+2)<<6 per segment', 'fixed-point-1/64-hit-point', true, playerFloor, [missiles('3359-3391')]),
      damage('monster', 'Lightning', 'Familiar direct: GenerateRnd(10)+1; controller child: 2*RandomIntBetween(monster.minDamage, monster.maxDamage)', 'fixed-point-1/64-hit-point', true, playerFloor, [monster('2469-2474'), missiles('3359-3391'), missiles('1067-1170')], ['Bat', ...counselors]),
    ], refs: [monster('2469-2474'), missiles('2008-2025'), missiles('3359-3391')],
  },
  {
    missile: 'BloodStar', baseMissile: 'BloodStar', directRoutines: ['Succubus', 'LazarusSuccubus'], spawnedBy: [], projectilesPerAttack: 1,
    kinetics: [
      kinetics('player', speed('constant-16', '16/16', [missiles('2284-2326')]), lifetime('exact-256', '256 flight ticks maximum', [missiles('2284-2326'), missiles('2976-3026')]), [missiles('2284-2326'), missiles('2976-3026')]),
      kinetics('monster', speed('constant-16', '16/16', [missiles('2284-2326')]), lifetime('exact-256', '256 flight ticks maximum', [missiles('2284-2326'), missiles('2976-3026')]), [missiles('2284-2326'), missiles('2976-3026')], ['Succubus', 'LazarusSuccubus']),
    ],
    damage: [
      damage('player', 'BloodStar', '3*S-playerMagic/8+playerMagic/2', 'whole-hit-points', false, playerFloor, [missiles('2284-2326'), missiles('2976-3026')]),
      damage('monster', 'BloodStar', 'ProjectileMonsterDamage = RandomIntBetween(monster.minDamage, monster.maxDamage)', 'whole-hit-points', false, playerFloor, [missiles('267-271'), missiles('2284-2326'), missiles('2976-3026'), missiles('1067-1170')], ['Succubus', 'LazarusSuccubus']),
    ], refs: [monster('1940-1950'), missiles('2284-2326'), missiles('2976-3026')],
  },
  {
    missile: 'BloodStarExplosion', baseMissile: 'BloodStarExplosion', directRoutines: [],
    spawnedBy: [{ missile: 'BloodStar', routines: ['Succubus', 'LazarusSuccubus'], refs: [missiles('2976-3026')] }], projectilesPerAttack: 1,
    kinetics: [kinetics('monster', speed('stationary', '0', [missiles('2027-2055')]), lifetime('animation', 'A', [missiles('2027-2055'), missiles('3626-3642')], 'BloodStarExplosion'), [missiles('2027-2055'), missiles('3626-3642')])],
    damage: [noDamage('BloodStarExplosion', [missiles('3626-3642')])], refs: [missiles('2027-2055'), missiles('2976-3026'), missiles('3626-3642')],
  },
  {
    missile: 'ThinLightningControl', graph: thinLightningControlGraph, directRoutines: ['Storm'], spawnedBy: [], projectilesPerAttack: 1,
    kinetics: [kinetics('monster', thinLightningControlGraph.speed, thinLightningControlGraph.lifetime, [missiles('1999-2006'), missiles('3359-3376')], ['Storm'])],
    damage: [damage('monster', 'ThinLightning', '2*RandomIntBetween(monster.minDamage, monster.maxDamage)', 'fixed-point-1/64-hit-point', true, playerFloor, [missiles('3359-3391'), missiles('1067-1170')], ['Storm'])],
    refs: [monster('1963-1968'), monster('2013-2067'), missiles('808-850'), missiles('3359-3376')],
  },
  {
    missile: 'ThinLightning', baseMissile: 'Lightning', directRoutines: [],
    spawnedBy: [{ missile: 'ThinLightningControl', routines: ['Storm'], refs: [missiles('808-850'), missiles('3359-3376')] }], projectilesPerAttack: 1,
    kinetics: [kinetics('monster', speed('stationary', '0', [missiles('2008-2025')]), lifetime('monster-lightning-segment', '10', [missiles('2008-2025')]), [missiles('2008-2025')], ['Storm'])],
    damage: [damage('monster', 'ThinLightning', '2*RandomIntBetween(monster.minDamage, monster.maxDamage)', 'fixed-point-1/64-hit-point', true, playerFloor, [missiles('3359-3391'), missiles('1067-1170')], ['Storm'])],
    refs: [missiles('808-850'), missiles('2008-2025'), missiles('3359-3391')],
  },
  {
    missile: 'Acid', graph: acidGraph, directRoutines: acidRoutines, spawnedBy: [], projectilesPerAttack: 1,
    kinetics: [kinetics('monster', acidGraph.speed, acidGraph.lifetime, [missiles('2328-2361'), missiles('2976-3026')], acidRoutines)],
    damage: [damage('monster', 'Acid', 'ProjectileMonsterDamage = RandomIntBetween(monster.minDamage, monster.maxDamage)', 'whole-hit-points', false, playerFloor, [missiles('267-271'), missiles('2328-2361'), missiles('2976-3026'), missiles('1067-1170')], acidRoutines)],
    refs: [monster('1940-1950'), monster('2013-2067'), missiles('2328-2361'), missiles('2976-3026')],
  },
  {
    missile: 'AcidSplat', graph: acidSplatGraph, directRoutines: [],
    spawnedBy: [{ missile: 'Acid', routines: acidRoutines, refs: [missiles('2976-3026')] }], projectilesPerAttack: 1,
    kinetics: [kinetics('monster', acidSplatGraph.speed, acidSplatGraph.lifetime, [missiles('2027-2055'), missiles('3644-3658')], acidRoutines)],
    damage: [noDamage('AcidSplat', [missiles('3644-3658')])], refs: [missiles('2027-2055'), missiles('2976-3026'), missiles('3644-3658')],
  },
  {
    missile: 'AcidPuddle', graph: acidPuddleGraph, directRoutines: [],
    spawnedBy: [{ missile: 'AcidSplat', routines: acidRoutines, refs: [missiles('3644-3658')] }], projectilesPerAttack: 1,
    kinetics: [kinetics('monster', acidPuddleGraph.speed, acidPuddleGraph.lifetime, [missiles('2355-2361'), missiles('3048-3063')], acidRoutines)],
    damage: [damage('monster', 'AcidPuddle', 'monster.data().level>=2 ? 2 : 1', 'fixed-point-1/64-hit-point', true, playerFloor, [missiles('3048-3063'), missiles('3644-3658'), missiles('1067-1170')], acidRoutines)],
    refs: [missiles('2355-2361'), missiles('3048-3063'), missiles('3644-3658')],
  },
  {
    missile: 'Firebolt', baseMissile: 'Firebolt', directRoutines: counselors, spawnedBy: [], projectilesPerAttack: 1,
    kinetics: [
      kinetics('player', speed('firebolt', '(16+min(2*S,47))/16', [missiles('1867-1900')]), lifetime('exact-256', '256 flight ticks maximum', [missiles('1867-1900'), missiles('2976-3026')]), [missiles('1867-1900'), missiles('2976-3026')]),
      kinetics('monster', speed('constant-26', '26/16', [missiles('1867-1900')]), lifetime('exact-256', '256 flight ticks maximum', [missiles('1867-1900'), missiles('2976-3026')]), [missiles('1867-1900'), missiles('2976-3026')], counselors),
    ],
    damage: [
      damage('player', 'Firebolt', 'GenerateRnd(10)+playerMagic/8+S+1', 'whole-hit-points', false, playerFloor, [missiles('1867-1900'), missiles('2976-3026')]),
      damage('monster', 'Firebolt', 'caller RandomIntBetween(monster.minDamage, monster.maxDamage), or ProjectileMonsterDamage when caller value is zero', 'whole-hit-points', false, playerFloor, [monster('2753-2758'), missiles('267-271'), missiles('1867-1900'), missiles('2976-3026'), missiles('1067-1170')], counselors),
    ], refs: [monster('2753-2758'), missiles('1867-1900'), missiles('2976-3026')],
  },
  {
    missile: 'ChargedBolt', baseMissile: 'ChargedBolt', directRoutines: counselors, spawnedBy: [], projectilesPerAttack: 3,
    kinetics: [
      kinetics('player', speed('constant-8', '8/16', [missiles('2702-2718')]), lifetime('charged-bolt-phases', '<=256 flight ticks; actor hit can add A Lightning-animation ticks', [missiles('2702-2718'), missiles('3992-4031')], 'Lightning'), [missiles('2702-2718'), missiles('3992-4031')]),
      kinetics('monster', speed('constant-8', '8/16', [missiles('2702-2718')]), lifetime('charged-bolt-phases', '<=256 flight ticks; actor hit can add A Lightning-animation ticks', [missiles('2702-2718'), missiles('3992-4031')], 'Lightning'), [monster('1298-1317'), missiles('2702-2718'), missiles('3992-4031')], counselors),
    ],
    damage: [
      damage('player', 'ChargedBolt', 'GenerateRnd(playerMagic/4)+1', 'whole-hit-points', false, playerFloor, [missiles('2702-2718'), missiles('3992-4031')]),
      damage('monster', 'ChargedBolt', '15 for each of three MonsterRangedAttack missiles', 'whole-hit-points', false, playerFloor, [monster('1298-1317'), missiles('2702-2718'), missiles('3992-4031'), missiles('1067-1170')], counselors),
    ], refs: [monster('1298-1317'), monster('2753-2758'), missiles('2702-2718'), missiles('3992-4031')],
  },
  {
    missile: 'LightningControl', baseMissile: 'LightningControl', directRoutines: counselors, spawnedBy: [], projectilesPerAttack: 1,
    kinetics: [
      kinetics('player', speed('constant-32', '32/16', [missiles('1999-2006')]), lifetime('exact-256', '256 controller ticks maximum', [missiles('1999-2006'), missiles('3359-3376')]), [missiles('1999-2006'), missiles('3359-3376')]),
      kinetics('monster', speed('constant-32', '32/16', [missiles('1999-2006')]), lifetime('exact-256', '256 controller ticks maximum', [missiles('1999-2006'), missiles('3359-3376')]), [missiles('1999-2006'), missiles('3359-3376')], counselors),
    ],
    damage: [
      damage('player', 'Lightning', '(GenerateRnd(2)+GenerateRnd(characterLevel)+2)<<6 per child segment', 'fixed-point-1/64-hit-point', true, playerFloor, [missiles('3359-3391')]),
      damage('monster', 'Lightning', '2*RandomIntBetween(monster.minDamage, monster.maxDamage) per child segment', 'fixed-point-1/64-hit-point', true, playerFloor, [missiles('3359-3391'), missiles('1067-1170')], counselors),
    ], refs: [monster('2753-2758'), missiles('1999-2006'), missiles('3359-3391')],
  },
  {
    missile: 'Fireball', baseMissile: 'Fireball', directRoutines: counselors, spawnedBy: [], projectilesPerAttack: 1,
    kinetics: [
      kinetics('player', speed('fireball', '(16+min(2*S,34))/16', [missiles('1977-1997')]), lifetime('fireball-phases', '<=256 flight ticks+(A-1) BigExplosion ticks', [missiles('1977-1997'), missiles('3099-3166')], 'BigExplosion'), [missiles('1977-1997'), missiles('3099-3166')]),
      kinetics('monster', speed('constant-16', '16/16', [missiles('1977-1997')]), lifetime('fireball-phases', '<=256 flight ticks+(A-1) BigExplosion ticks', [missiles('1977-1997'), missiles('3099-3166')], 'BigExplosion'), [missiles('1977-1997'), missiles('3099-3166')], counselors),
    ],
    damage: [
      damage('player', 'Fireball', 'ScaleSpellEffect(2*(characterLevel+GenerateRndSum(10,2))+4,S)', 'whole-hit-points', false, playerFloor, [missiles('1977-1997'), missiles('3099-3166')]),
      damage('monster', 'Fireball flight and one-time 3x3 blast checks', 'RandomIntBetween(monster.minDamage, monster.maxDamage)', 'whole-hit-points', false, playerFloor, [missiles('3099-3166'), missiles('1067-1170')], counselors),
    ], refs: [monster('2753-2758'), missiles('1977-1997'), missiles('3099-3166')],
  },
  {
    missile: 'FlashBottom', baseMissile: 'FlashBottom', directRoutines: counselors, spawnedBy: [], projectilesPerAttack: 1,
    kinetics: [
      kinetics('player', speed('stationary', '0', [missiles('2125-2143')]), lifetime('exact-19', '19', [missiles('2125-2143')]), [missiles('2125-2143'), missiles('3425-3452')]),
      kinetics('monster', speed('stationary', '0', [missiles('2125-2143')]), lifetime('exact-19', '19', [missiles('2125-2143')]), [missiles('2125-2143'), missiles('3425-3452')], counselors),
    ],
    damage: [
      damage('player', 'FlashBottom', 'ScaleSpellEffect(player roll,S)*3/2', 'fixed-point-1/64-hit-point', true, playerFloor, [missiles('2125-2143'), missiles('3425-3452')]),
      damage('monster', 'FlashBottom', '2*monster.level(difficulty)', 'fixed-point-1/64-hit-point', true, playerFloor, [missiles('2125-2143'), missiles('3425-3452'), missiles('1067-1170')], counselors),
    ], refs: [monster('2771-2775'), missiles('2125-2143'), missiles('3425-3452')],
  },
  {
    missile: 'FlashTop', baseMissile: 'FlashTop', directRoutines: counselors, spawnedBy: [], projectilesPerAttack: 1,
    kinetics: [
      kinetics('player', speed('stationary', '0', [missiles('2145-2159')]), lifetime('exact-19', '19', [missiles('2145-2159')]), [missiles('2145-2159'), missiles('3454-3478')]),
      kinetics('monster', speed('stationary', '0', [missiles('2145-2159')]), lifetime('exact-19', '19', [missiles('2145-2159')]), [missiles('2145-2159'), missiles('3454-3478')], counselors),
    ],
    damage: [
      damage('player', 'FlashTop', 'ScaleSpellEffect(player roll,S)*3/2', 'fixed-point-1/64-hit-point', true, playerFloor, [missiles('2145-2159'), missiles('3454-3478')]),
      damage('monster', 'FlashTop', 'caller value 4', 'fixed-point-1/64-hit-point', true, playerFloor, [monster('2771-2775'), missiles('2145-2159'), missiles('3454-3478'), missiles('1067-1170')], counselors),
    ], refs: [monster('2771-2775'), missiles('2145-2159'), missiles('3454-3478')],
  },
  {
    missile: 'InfernoControl', baseMissile: 'InfernoControl', directRoutines: ['Mega'], spawnedBy: [], projectilesPerAttack: 1,
    kinetics: [
      kinetics('player', speed('constant-32', '32/16', [missiles('2690-2700')]), lifetime('exact-256', '<=256 ticks and at most three distinct child segments', [missiles('2690-2700'), missiles('3964-3990')]), [missiles('2690-2700'), missiles('3964-3990')]),
      kinetics('monster', speed('constant-32', '32/16', [missiles('2690-2700')]), lifetime('exact-256', '<=256 ticks and at most three distinct child segments', [missiles('2690-2700'), missiles('3964-3990')]), [missiles('2690-2700'), missiles('3964-3990')], ['Mega']),
    ],
    damage: [
      damage('player', 'Inferno', '16+12*(GenerateRnd(characterLevel)+GenerateRnd(2)) per child', 'fixed-point-1/64-hit-point', true, playerFloor, [missiles('2672-2688'), missiles('3940-3962')]),
      damage('monster', 'Inferno', 'RandomIntBetween(monster.minDamage, monster.maxDamage) per child', 'fixed-point-1/64-hit-point', true, playerFloor, [missiles('2672-2688'), missiles('3940-3962'), missiles('1067-1170')], ['Mega']),
    ], refs: [monster('2818-2877'), missiles('2672-2700'), missiles('3940-3990')],
  },
  {
    missile: 'Inferno', baseMissile: 'Inferno', directRoutines: [],
    spawnedBy: [{ missile: 'InfernoControl', routines: ['Mega'], refs: [missiles('3964-3990')] }], projectilesPerAttack: 1,
    kinetics: [
      kinetics('player', speed('stationary', '0', [missiles('2672-2688')]), lifetime('inferno-segment', '20+5*k', [missiles('2672-2688')]), [missiles('2672-2688'), missiles('3940-3962')]),
      kinetics('monster', speed('stationary', '0', [missiles('2672-2688')]), lifetime('inferno-segment', '20+5*k for k in {0,1,2}', [missiles('2672-2688')]), [missiles('2672-2688'), missiles('3940-3962')], ['Mega']),
    ],
    damage: [
      damage('player', 'Inferno', '16+12*(GenerateRnd(characterLevel)+GenerateRnd(2))', 'fixed-point-1/64-hit-point', true, playerFloor, [missiles('2672-2688'), missiles('3940-3962')]),
      damage('monster', 'Inferno', 'RandomIntBetween(monster.minDamage, monster.maxDamage)', 'fixed-point-1/64-hit-point', true, playerFloor, [missiles('2672-2688'), missiles('3940-3962'), missiles('1067-1170')], ['Mega']),
    ], refs: [missiles('2672-2688'), missiles('3940-3990')],
  },
  {
    missile: 'DiabloApocalypse', graph: diabloApocalypseGraph, directRoutines: ['Diablo'], spawnedBy: [], projectilesPerAttack: 1,
    kinetics: [kinetics('monster', diabloApocalypseGraph.speed, diabloApocalypseGraph.lifetime, [missiles('2793-2806')], ['Diablo'])],
    damage: [damage('monster', 'DiabloApocalypseBoom', 'caller value 40', 'whole-hit-points', false, playerFloor, [monster('2013-2067'), missiles('2793-2806'), missiles('3726-3736'), missiles('1067-1170')], ['Diablo'])],
    refs: [monster('1963-1968'), monster('2013-2067'), missiles('2793-2806')],
  },
  {
    missile: 'DiabloApocalypseBoom', graph: diabloApocalypseBoomGraph, directRoutines: [],
    spawnedBy: [{ missile: 'DiabloApocalypse', routines: ['Diablo'], refs: [missiles('2793-2806')] }], projectilesPerAttack: 1,
    kinetics: [kinetics('monster', diabloApocalypseBoomGraph.speed, diabloApocalypseBoomGraph.lifetime, [missiles('2455-2460'), missiles('3726-3736')], ['Diablo'])],
    damage: [damage('monster', 'DiabloApocalypseBoom', 'caller value 40', 'whole-hit-points', false, playerFloor, [monster('2013-2067'), missiles('2793-2806'), missiles('3726-3736'), missiles('1067-1170')], ['Diablo'])],
    refs: [monster('2013-2067'), missiles('2455-2460'), missiles('2793-2806'), missiles('3726-3736')],
  },
];

export const MONSTER_MISSILE_GRAPH_EXCLUSIONS_DATA: readonly MonsterMissileGraphExclusionData[] = [
  {
    routine: 'HorkDemon', missile: 'HorkSpawn',
    reason: 'Hellfire-only monster attack; W103 vanilla coverage records the exclusion without promoting a vanilla graph.',
    refs: [monster('3009-3064'), missiles('1351-1357'), missiles('3168-3191')],
  },
];
