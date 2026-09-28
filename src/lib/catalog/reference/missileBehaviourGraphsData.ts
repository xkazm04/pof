/** Pin-verified state-machine data for every missile in a vanilla player-spell chain. */
import type {
  MissileBehaviourGraphData,
  MissileFormulaData,
  MissileGeometryCheckData,
  MissileLifetimeEvaluation,
  MissileSpeedEvaluation,
} from '@/lib/catalog/reference/missileBehaviourGraphs';

const missiles = (lines: string): string => `.reference/devilutionX/Source/missiles.cpp:${lines}`;
const monster = (lines: string): string => `.reference/devilutionX/Source/monster.cpp:${lines}`;
const spells = (lines: string): string => `.reference/devilutionX/Source/spells.cpp:${lines}`;
const displacement = (lines: string): string => `.reference/devilutionX/Source/engine/displacement.hpp:${lines}`;

const SpeedSymbols = {
  S: 'executed spell level (_mispllvl)',
  P: 'engine velocityInPixels; 16 is one normalized tile-speed unit',
} as const;
const LifetimeSymbols = {
  S: 'executed spell level (_mispllvl)',
  C: 'source player character level',
  A: 'selected missile sprite animation length',
  k: 'zero-based child segment index',
} as const;

const speed = (
  evaluation: MissileSpeedEvaluation,
  formula: string,
  refs: readonly string[],
): MissileFormulaData<MissileSpeedEvaluation> => ({
  evaluation, formula, symbols: SpeedSymbols, refs: [...refs, displacement('190-206')],
});

const lifetime = (
  evaluation: MissileLifetimeEvaluation,
  formula: string,
  refs: readonly string[],
  animationGraphic?: string,
): MissileFormulaData<MissileLifetimeEvaluation> => ({
  evaluation, formula, symbols: LifetimeSymbols, refs,
  ...(animationGraphic ? { animationGraphic } : {}),
});

const collisionEffect = 'Apply the source-specific collision branch: player-owned hits use MonsterMHit, while monster-owned hits use PlayerMHit and its 64-internal-unit landed floor; monster hit recovery starts only when IsHardHit succeeds and never while Petrified.';
const collisionRefs = [missiles('278-351'), monster('3963-3998')];

const immediate = (
  missile: string,
  addFn: string,
  effect: string,
  addRef: string,
  geometryChecks: readonly MissileGeometryCheckData[] = [],
  spawns: MissileBehaviourGraphData['spawns'] = [],
): MissileBehaviourGraphData => ({
  missile,
  addFn,
  processFn: null,
  initialState: 'add-effect',
  states: [
    { id: 'add-effect', label: 'Add* performs the complete gameplay effect', refs: [addRef] },
    { id: 'deleted', label: 'Transient missile flagged for deletion', terminal: true, refs: [addRef, missiles('4197-4246')] },
  ],
  transitions: [{
    from: 'add-effect', nextState: 'deleted', trigger: 'add', guard: 'Add* returns after its immediate side effect',
    effect, refs: [addRef],
  }],
  geometryChecks,
  speed: speed('stationary', '0', [addRef]),
  lifetime: lifetime('immediate', '0 (deleted during Add*)', [addRef]),
  ends: [{ cause: 'Add* sets _miDelFlag; DeleteMissiles removes the transient object.', refs: [addRef, missiles('4197-4246')] }],
  spawns,
  refs: [addRef],
});

const stationaryTimer = (
  missile: string,
  addFn: string,
  processFn: string,
  lifetimeRule: MissileFormulaData<MissileLifetimeEvaluation>,
  addRef: string,
  processRef: string,
  tickEffect: string,
  geometryChecks: readonly MissileGeometryCheckData[] = [],
): MissileBehaviourGraphData => ({
  missile, addFn, processFn, initialState: 'active',
  states: [
    { id: 'active', label: 'Stationary timed effect is active', refs: [addRef, processRef] },
    { id: 'deleted', label: 'Duration exhausted and missile deleted', terminal: true, refs: [processRef] },
  ],
  transitions: [
    { from: 'active', nextState: 'active', trigger: 'tick-counter', guard: 'duration remains above zero after this tick', effect: tickEffect, refs: [processRef] },
    { from: 'active', nextState: 'deleted', trigger: 'lifetime', guard: 'duration reaches zero', effect: 'Set _miDelFlag and perform any effect-specific teardown.', refs: [processRef] },
  ],
  geometryChecks,
  speed: speed('stationary', '0', [addRef]), lifetime: lifetimeRule,
  ends: [{ cause: 'The process duration reaches zero.', refs: [processRef] }],
  spawns: [], refs: [addRef, processRef],
});

const visualExplosion = (
  missile: string,
  animationGraphic: string,
  addRef = missiles('2027-2055'),
): MissileBehaviourGraphData => ({
  missile, addFn: 'AddMissileExplosion', processFn: 'ProcessMissileExplosion', initialState: 'visual',
  states: [
    { id: 'visual', label: 'Stationary visual explosion copied from parent position', refs: [addRef, missiles('3626-3642')] },
    { id: 'deleted', label: 'Animation duration exhausted', terminal: true, refs: [missiles('3626-3642')] },
  ],
  transitions: [
    { from: 'visual', nextState: 'visual', trigger: 'animation', guard: 'duration after decrement is above zero', effect: 'Advance explosion light and animation.', refs: [missiles('3626-3642')] },
    { from: 'visual', nextState: 'deleted', trigger: 'lifetime', guard: 'duration reaches zero', effect: 'Delete the visual and remove its light.', refs: [missiles('3626-3642')] },
  ],
  geometryChecks: [], speed: speed('stationary', '0', [addRef]),
  lifetime: lifetime('animation', 'A', [addRef], animationGraphic),
  ends: [{ cause: 'The inherited sprite animation length reaches zero.', refs: [addRef, missiles('3626-3642')] }],
  spawns: [], refs: [addRef, missiles('3626-3642')],
});

const genericProjectile = (
  missile: 'Firebolt' | 'BloodStar',
  addFn: 'AddFirebolt' | 'AddGenericMagicMissile',
  addRef: string,
  speedRule: MissileFormulaData<MissileSpeedEvaluation>,
  child: 'MagmaBallExplosion' | 'BloodStarExplosion',
): MissileBehaviourGraphData => ({
  missile, addFn, processFn: 'ProcessGenericProjectile', initialState: 'flight',
  states: [
    { id: 'flight', label: 'Blockable straight flight checks traversed tiles', refs: [addRef, missiles('643-672'), missiles('2976-3026')] },
    { id: 'deleted', label: 'Flight ended; parent deleted after spawning its visual child', terminal: true, refs: [missiles('2976-3026')] },
  ],
  transitions: [
    { from: 'flight', nextState: 'flight', trigger: 'tick-counter', guard: 'no stopping hit, wall, or lifetime expiry', effect: 'Decrement duration, move, and collision-check each newly traversed tile.', refs: [missiles('643-672'), missiles('2976-3026')] },
    { from: 'flight', nextState: 'deleted', trigger: 'collision', guard: 'an eligible actor hit sets duration to zero for this blockable missile', effect: `${collisionEffect} Spawn ${child}.`, refs: [...collisionRefs, missiles('486-555'), missiles('2976-3026')] },
    { from: 'flight', nextState: 'deleted', trigger: 'wall', guard: 'the traversed tile has TileProperties::BlockMissile', effect: `Stop before the blocked tile and spawn ${child}.`, refs: [missiles('543-555'), missiles('643-672'), missiles('2976-3026')] },
    { from: 'flight', nextState: 'deleted', trigger: 'lifetime', guard: 'the 256-tick flight counter reaches zero', effect: `Spawn ${child}.`, refs: [missiles('2976-3026')] },
  ],
  geometryChecks: [{ check: 'Swept actor and missile-blocking terrain collision', origin: 'current-position', target: 'every newly traversed tile; the start tile is ignored', refs: [missiles('562-672'), missiles('2976-3026')] }],
  speed: speedRule, lifetime: lifetime('exact-256', '256 flight ticks maximum', [addRef, missiles('2976-3026')]),
  ends: [{ cause: 'First eligible actor collision, missile-blocking terrain, or flight counter expiry.', refs: [missiles('2976-3026')] }],
  spawns: [{ missile: child, trigger: 'whenever flight ends', refs: [missiles('2976-3026')] }],
  refs: [addRef, missiles('2976-3026')],
});

const areaCollision = (processRef: string, target: string): MissileGeometryCheckData => ({
  check: 'Actor collision', origin: 'current-position', target, refs: [processRef, missiles('486-555')],
});

const instantRows: MissileBehaviourGraphData[] = [
  immediate('Healing', 'AddHealing', 'Apply capped self-healing and redraw health.', missiles('2462-2482')),
  immediate('Identify', 'AddIdentify', 'Open the identify inventory cursor for the local player.', missiles('2518-2533')),
  immediate('ManaShield', 'AddManaShield', 'Enable pManaShield unless it was already active; the player flag, not the missile, owns the later lifetime.', missiles('2161-2175')),
  immediate('Golem', 'AddGolem', 'Dismiss the existing golem or request/spawn a golem at the corrected point.', missiles('2418-2453'), [{ check: 'FindClosestValidPosition: unoccupied and line-clear', origin: 'caster', target: 'corrected point within radius 5 of clicked point', refs: [missiles('2418-2453')] }]),
  immediate('ItemRepair', 'AddItemRepair', 'Open the repair inventory cursor for the local player.', missiles('2607-2622')),
  immediate('StaffRecharge', 'AddStaffRecharge', 'Open the staff-recharge inventory cursor for the local player.', missiles('2624-2639')),
  immediate('TrapDisarm', 'AddTrapDisarm', 'Open or immediately execute the disarm interaction cursor path.', missiles('2641-2655')),
  immediate('Resurrect', 'AddResurrect', 'Open the resurrect target cursor; a later target action spawns ResurrectBeam.', missiles('2742-2752'), [], [{ missile: 'ResurrectBeam', trigger: 'later successful target action', refs: [spells('235-246')] }]),
  immediate('Telekinesis', 'AddTelekinesis', 'Open the telekinesis interaction cursor for the local player.', missiles('2761-2768')),
  immediate('HealOther', 'AddHealOther', 'Open the heal-other target cursor; healing occurs in the later player action.', missiles('2484-2494')),
];

const phasing: MissileBehaviourGraphData = {
  missile: 'Phasing', addFn: 'AddPhasing', processFn: 'ProcessTeleport', initialState: 'placed',
  states: [
    { id: 'placed', label: 'Random legal destination selected from the outer 13x13 corners', refs: [missiles('1829-1865')] },
    { id: 'relocated', label: 'Player relocation attempted on the first process tick', refs: [missiles('3661-3696')] },
    { id: 'deleted', label: 'Two-tick controller deleted', terminal: true, refs: [missiles('3661-3696')] },
  ],
  transitions: [
    { from: 'placed', nextState: 'relocated', trigger: 'placement', guard: 'at least one PosOkPlayer candidate exists', effect: 'Store a random candidate; revalidate within radius 5 and move the player if possible.', refs: [missiles('1829-1865'), missiles('3661-3696')] },
    { from: 'placed', nextState: 'deleted', trigger: 'target-none', guard: 'no legal outer-corner candidate exists', effect: 'Set _miDelFlag without spellFizzled.', refs: [missiles('1829-1865')] },
    { from: 'relocated', nextState: 'deleted', trigger: 'lifetime', guard: 'the second tick decrements duration to zero', effect: 'Delete whether relocation succeeded or not.', refs: [missiles('3661-3696')] },
  ],
  geometryChecks: [
    { check: 'PosOkPlayer candidate scan', origin: 'caster', target: 'outer cells of a 13x13 square, excluding the central bands', refs: [missiles('1829-1865')] },
    { check: 'FindClosestValidPosition revalidation', origin: 'corrected-point', target: 'legal player tile within radius 5', refs: [missiles('3661-3696')] },
  ],
  speed: speed('stationary', '0 (relocation, not missile travel)', [missiles('1829-1865')]),
  lifetime: lifetime('exact-2', '2', [missiles('1829-1865'), missiles('3661-3696')]),
  ends: [{ cause: 'No candidate during Add*, or the two-tick relocation controller expires.', refs: [missiles('1829-1865'), missiles('3661-3696')] }],
  spawns: [], refs: [missiles('1829-1865'), missiles('3661-3696')],
};

const teleport: MissileBehaviourGraphData = {
  ...phasing,
  missile: 'Teleport', addFn: 'AddTeleport',
  states: [
    { id: 'placed', label: 'Closest legal tile selected around clicked point', refs: [missiles('1931-1949')] },
    { id: 'relocated', label: 'Player relocation attempted on the first process tick', refs: [missiles('3661-3696')] },
    { id: 'deleted', label: 'Two-tick controller deleted', terminal: true, refs: [missiles('3661-3696')] },
  ],
  transitions: [
    { from: 'placed', nextState: 'relocated', trigger: 'placement', guard: 'FindClosestValidPosition returns a legal tile', effect: 'Store the corrected tile; process revalidates and moves the player.', refs: [missiles('1931-1949'), missiles('3661-3696')] },
    { from: 'placed', nextState: 'deleted', trigger: 'target-none', guard: 'no legal tile exists within radius 5', effect: 'Set _miDelFlag and spellFizzled.', refs: [missiles('1931-1949')] },
    { from: 'relocated', nextState: 'deleted', trigger: 'lifetime', guard: 'the second tick decrements duration to zero', effect: 'Delete whether relocation succeeded or not.', refs: [missiles('3661-3696')] },
  ],
  geometryChecks: [
    { check: 'FindClosestValidPosition with PosOkPlayer', origin: 'clicked-point', target: 'corrected point within radius 5', refs: [missiles('1931-1949')] },
    { check: 'FindClosestValidPosition revalidation', origin: 'corrected-point', target: 'legal player tile within radius 5', refs: [missiles('3661-3696')] },
  ],
  refs: [missiles('1931-1949'), missiles('3661-3696')],
};

const lightningControl: MissileBehaviourGraphData = {
  missile: 'LightningControl', addFn: 'AddLightningControl', processFn: 'ProcessLightningControl', initialState: 'laying-path',
  states: [
    { id: 'laying-path', label: 'Moving controller advances and lays one stationary segment per new tile', refs: [missiles('808-850'), missiles('1999-2006'), missiles('3359-3376')] },
    { id: 'deleted', label: 'Path controller stopped', terminal: true, refs: [missiles('808-850')] },
  ],
  transitions: [
    { from: 'laying-path', nextState: 'laying-path', trigger: 'tick-counter', guard: 'duration remains and the current tile is not missile-blocking', effect: 'Roll damage once for this newly laid segment and spawn Lightning if the tile changed.', refs: [missiles('808-850'), missiles('3359-3376')] },
    { from: 'laying-path', nextState: 'deleted', trigger: 'wall', guard: 'the traversed/current tile has TileProperties::BlockMissile', effect: 'Set controller duration to zero and delete it; do not lay a segment on the blocked tile.', refs: [missiles('808-850')] },
    { from: 'laying-path', nextState: 'deleted', trigger: 'lifetime', guard: 'the 256-tick controller duration reaches zero', effect: 'Delete the controller.', refs: [missiles('808-850'), missiles('3359-3376')] },
  ],
  geometryChecks: [{ check: 'Controller terrain path', origin: 'current-position', target: 'each newly traversed tile', refs: [missiles('808-850')] }],
  speed: speed('constant-32', '32/16', [missiles('1999-2006')]),
  lifetime: lifetime('exact-256', '256 controller ticks maximum', [missiles('1999-2006'), missiles('808-850')]),
  ends: [{ cause: 'Missile-blocking terrain or controller lifetime expiry.', refs: [missiles('808-850')] }],
  spawns: [{ missile: 'Lightning', trigger: 'each distinct unblocked path tile', refs: [missiles('808-850'), missiles('3359-3376')] }],
  refs: [missiles('808-850'), missiles('1999-2006'), missiles('3359-3376')],
};

const lightning: MissileBehaviourGraphData = {
  missile: 'Lightning', addFn: 'AddLightning', processFn: 'ProcessLightning', initialState: 'segment-active',
  states: [
    { id: 'segment-active', label: 'Stationary segment owns one damage roll and checks its tile each tick', refs: [missiles('2008-2025'), missiles('3378-3391')] },
    { id: 'deleted', label: 'Segment lifetime exhausted', terminal: true, refs: [missiles('3378-3391')] },
  ],
  transitions: [
    { from: 'segment-active', nextState: 'segment-active', trigger: 'collision', guard: 'an eligible actor occupies the segment tile and it is not the controller start tile', effect: `${collisionEffect} Restore the post-decrement duration so the successful hit does not consume an extra tick; the segment rechecks on later ticks.`, refs: [...collisionRefs, missiles('3378-3391')] },
    { from: 'segment-active', nextState: 'segment-active', trigger: 'tick-counter', guard: 'post-decrement duration remains above zero', effect: 'Keep the original per-segment damage roll and remain stationary.', refs: [missiles('2008-2025'), missiles('3378-3391')] },
    { from: 'segment-active', nextState: 'deleted', trigger: 'lifetime', guard: 'post-decrement duration reaches zero', effect: 'Delete the segment and remove its light.', refs: [missiles('3378-3391')] },
  ],
  geometryChecks: [areaCollision(missiles('3378-3391'), 'the stationary segment tile, except when it equals position.start')],
  speed: speed('stationary', '0', [missiles('2008-2025')]),
  lifetime: lifetime('lightning-segment', 'floor(S/2)+6', [missiles('2008-2025')]),
  ends: [{ cause: 'Its level-scaled segment duration reaches zero; actor hits do not end it.', refs: [missiles('3378-3391')] }],
  spawns: [], refs: [missiles('2008-2025'), missiles('3378-3391')],
};

const flash = (
  missile: 'FlashBottom' | 'FlashTop', addFn: 'AddFlashBottom' | 'AddFlashTop', addRef: string, processFn: 'ProcessFlashBottom' | 'ProcessFlashTop', processRef: string, target: string,
): MissileBehaviourGraphData => stationaryTimer(
  missile, addFn, processFn, lifetime('exact-19', '19', [addRef]), addRef, processRef,
  `Apply the source branch's caster-invincibility rule (player sources only), check ${target}, and preserve the missile after hits.`,
  [areaCollision(processRef, target)],
);

const fireWallControl: MissileBehaviourGraphData = {
  missile: 'FireWallControl', addFn: 'AddWallControl', processFn: 'ProcessWallControl', initialState: 'spread-search',
  states: [
    { id: 'spread-search', label: 'Correct clicked point to a distinct missile-clear, caster-line-clear spread point', refs: [missiles('2535-2557')] },
    { id: 'center', label: 'Place the center anchor at the corrected point', refs: [missiles('3775-3840')] },
    { id: 'grow-both-sides', label: 'Grow one anchor on each side per tick', refs: [missiles('742-810'), missiles('3775-3840')] },
    { id: 'deleted', label: 'Controller stopped after its seven-tick schedule or blocked center', terminal: true, refs: [missiles('3775-3840')] },
  ],
  transitions: [
    { from: 'spread-search', nextState: 'center', trigger: 'placement', guard: 'a corrected point exists within radius 5', effect: 'Store corrected point twice and store perpendicular left/right growth directions.', refs: [missiles('2535-2557')] },
    { from: 'spread-search', nextState: 'deleted', trigger: 'target-none', guard: 'no distinct missile-clear, caster-line-clear point exists', effect: 'Set _miDelFlag and spellFizzled.', refs: [missiles('2535-2557')] },
    { from: 'center', nextState: 'grow-both-sides', trigger: 'tick-counter', guard: 'corrected center still passes CanPlaceWall', effect: 'Place center FireWall, then advance both growth cursors.', refs: [missiles('742-810'), missiles('3775-3840')] },
    { from: 'center', nextState: 'deleted', trigger: 'wall', guard: 'corrected center now fails CanPlaceWall', effect: 'Delete controller without placing a wall.', refs: [missiles('3775-3840')] },
    { from: 'grow-both-sides', nextState: 'grow-both-sides', trigger: 'tick-counter', guard: 'one or both sides can grow and duration remains above zero', effect: 'TryGrowWall on each side; gap-fill anchors use their own checked positions. Six placement ticks yield the center plus five anchors per side (11 ordinary anchors before optional gap fills).', refs: [missiles('742-810'), missiles('3775-3840')] },
    { from: 'grow-both-sides', nextState: 'deleted', trigger: 'lifetime', guard: 'the seven-tick controller duration reaches zero before placement work', effect: 'Delete the controller; existing wall children persist independently.', refs: [missiles('3775-3840')] },
  ],
  geometryChecks: [
    { check: 'FindClosestValidPosition search area', origin: 'clicked-point', target: 'corrected point within radius 5', refs: [missiles('2535-2557')] },
    { check: 'LineClearMissile', origin: 'caster', target: 'each candidate corrected point', refs: [missiles('2535-2557')] },
    { check: 'CanPlaceWall for center and side/gap anchors', origin: 'corrected-point', target: 'the 11-anchor transverse growth sequence and optional gap-fill cells', refs: [missiles('742-810'), missiles('3775-3840')] },
  ],
  speed: speed('stationary', '0', [missiles('2535-2557')]),
  lifetime: lifetime('exact-7', '7 controller ticks (placement occurs only while post-decrement duration is nonzero)', [missiles('2535-2557'), missiles('3775-3840')]),
  ends: [{ cause: 'Placement correction failure, center becomes blocked, or the controller duration reaches zero.', refs: [missiles('2535-2557'), missiles('3775-3840')] }],
  spawns: [{ missile: 'FireWall', trigger: 'center tick and each successful left/right growth tick', refs: [missiles('742-810'), missiles('3775-3840')] }],
  refs: [missiles('742-810'), missiles('2535-2557'), missiles('3775-3840')],
};

const fireWall: MissileBehaviourGraphData = {
  missile: 'FireWall', addFn: 'AddFireWall', processFn: 'ProcessFireWall', initialState: 'start-animation',
  states: [
    { id: 'start-animation', label: 'Stationary wall starts and checks its tile', refs: [missiles('1961-1975'), missiles('3065-3097')] },
    { id: 'idle-damage', label: 'Stationary wall repeatedly checks its tile', refs: [missiles('3065-3097')] },
    { id: 'ending-animation', label: 'Wall reverses its start animation near expiry', refs: [missiles('3065-3097')] },
    { id: 'deleted', label: 'Wall duration exhausted', terminal: true, refs: [missiles('3065-3097')] },
  ],
  transitions: [
    { from: 'start-animation', nextState: 'idle-damage', trigger: 'tick-counter', guard: 'duration reaches duration-at-add minus animation length', effect: 'Select Idle frame group; keep checking the tile.', refs: [missiles('1961-1975'), missiles('3065-3097')] },
    { from: 'start-animation', nextState: 'start-animation', trigger: 'collision', guard: 'an eligible actor occupies an ordinary anchor, or a walking actor crosses a gap-fill anchor', effect: `${collisionEffect} TARGET_BOTH wall anchors bypass the player friendly-fire gate; dontDeleteOnCollision preserves the wall.`, refs: [...collisionRefs, missiles('486-530'), missiles('753-755'), missiles('3065-3097')] },
    { from: 'idle-damage', nextState: 'idle-damage', trigger: 'collision', guard: 'the same ordinary/gap-fill actor rule succeeds', effect: `${collisionEffect} Keep the wall active and recheck on later ticks.`, refs: [...collisionRefs, missiles('3065-3097')] },
    { from: 'idle-damage', nextState: 'ending-animation', trigger: 'animation', guard: 'duration equals animation length minus one', effect: 'Switch to reversed Start frames while collision checks continue.', refs: [missiles('3065-3097')] },
    { from: 'ending-animation', nextState: 'deleted', trigger: 'lifetime', guard: 'duration reaches zero', effect: 'Delete and remove light.', refs: [missiles('3065-3097')] },
  ],
  geometryChecks: [areaCollision(missiles('3065-3097'), 'ordinary anchor tile; gap-fill anchors only match actors walking across the stored edge')],
  speed: speed('stationary', '0 (Add* initializes velocity 16 only for orientation/placement)', [missiles('1961-1975')]),
  lifetime: lifetime('fire-wall', 'S>0 ? 160*(S+1) : 160; instantiated player levels use 160*(S+1)', [missiles('1961-1975')]),
  ends: [{ cause: 'Its independently level-scaled wall duration reaches zero.', refs: [missiles('3065-3097')] }],
  spawns: [], refs: [missiles('1961-1975'), missiles('3065-3097')],
};

const fireball: MissileBehaviourGraphData = {
  missile: 'Fireball', addFn: 'AddFireball', processFn: 'ProcessFireball', initialState: 'flight',
  states: [
    { id: 'flight', label: 'Blockable projectile flight', refs: [missiles('1977-1997'), missiles('3099-3166')] },
    { id: 'blast-check', label: 'One line-visible 3x3 blast check from the original start origin', refs: [missiles('3122-3140')] },
    { id: 'blast-animation', label: 'Stationary BigExplosion visual', refs: [missiles('3141-3163')] },
    { id: 'deleted', label: 'Blast animation duration exhausted', terminal: true, refs: [missiles('3103-3107')] },
  ],
  transitions: [
    { from: 'flight', nextState: 'flight', trigger: 'tick-counter', guard: 'no actor collision, blocking tile, or lifetime expiry', effect: 'Decrement duration, move, and collision-check swept tiles.', refs: [missiles('3099-3166')] },
    { from: 'flight', nextState: 'blast-check', trigger: 'collision', guard: 'an eligible actor collision sets duration to zero', effect: collisionEffect, refs: [...collisionRefs, missiles('3099-3166')] },
    { from: 'flight', nextState: 'blast-check', trigger: 'wall', guard: 'a traversed tile blocks missiles', effect: 'End flight at the terminal collision position.', refs: [missiles('543-672'), missiles('3099-3166')] },
    { from: 'flight', nextState: 'blast-check', trigger: 'lifetime', guard: 'the 256-tick flight counter reaches zero', effect: 'End flight at the current position.', refs: [missiles('3099-3166')] },
    { from: 'blast-check', nextState: 'blast-animation', trigger: 'collision', guard: 'for each center/neighbor cell, CheckBlock(position.start, cell) is false', effect: `${collisionEffect} Use dontDeleteOnCollision so every visible cell gets its independent check, then transform this same missile to BigExplosion.`, refs: [...collisionRefs, missiles('3122-3163')] },
    { from: 'blast-animation', nextState: 'blast-animation', trigger: 'animation', guard: 'animation-derived duration remains above zero', effect: 'Remain stationary; do not repeat blast collision.', refs: [missiles('3099-3166')] },
    { from: 'blast-animation', nextState: 'deleted', trigger: 'lifetime', guard: 'BigExplosion animation duration reaches zero', effect: 'Delete and remove light.', refs: [missiles('3103-3107')] },
  ],
  geometryChecks: [
    { check: 'Swept flight collision', origin: 'current-position', target: 'newly traversed tiles, ignoring the start tile', refs: [missiles('562-672'), missiles('3099-3166')] },
    { check: 'CheckBlock blast visibility', origin: 'start-position', target: 'impact center plus all eight neighboring offsets', refs: [missiles('3122-3140')] },
  ],
  speed: speed('fireball', '(16+min(2*S,34))/16', [missiles('1977-1997')]),
  lifetime: lifetime('fireball-phases', '<=256 flight ticks + (A-1) BigExplosion ticks', [missiles('1977-1997'), missiles('3099-3166')], 'BigExplosion'),
  ends: [{ cause: 'Flight transforms on actor collision, wall, or flight expiry; the transformed missile ends after BigExplosion animation.', refs: [missiles('3099-3166')] }],
  spawns: [], refs: [missiles('1977-1997'), missiles('3099-3166')],
};

const townPortal: MissileBehaviourGraphData = {
  missile: 'TownPortal', addFn: 'AddTownPortal', processFn: 'ProcessTownPortal', initialState: 'opening',
  states: [
    { id: 'opening', label: 'Corrected portal placement opens and counts down', refs: [missiles('2073-2123'), missiles('3393-3423')] },
    { id: 'idle', label: 'Duration one is a persistent idle sentinel', refs: [missiles('3393-3423')] },
    { id: 'deleted', label: 'Portal replaced or externally set to duration zero', terminal: true, refs: [missiles('2073-2123'), missiles('3393-3423')] },
  ],
  transitions: [
    { from: 'opening', nextState: 'opening', trigger: 'tick-counter', guard: 'duration is greater than one', effect: 'Decrement duration, animate/light, and warp eligible standing players on the portal tile.', refs: [missiles('3393-3423')] },
    { from: 'opening', nextState: 'idle', trigger: 'animation', guard: 'opening reaches the idle frame threshold', effect: 'Switch to Idle; duration eventually stops decrementing at one.', refs: [missiles('3393-3423')] },
    { from: 'idle', nextState: 'idle', trigger: 'external', guard: 'an eligible standing player occupies the tile', effect: 'Clear its path and issue the level-warp transition.', refs: [missiles('3393-3423')] },
    { from: 'opening', nextState: 'deleted', trigger: 'external', guard: 'a same-source portal replacement sets duration to zero', effect: 'Delete and remove light.', refs: [missiles('2073-2123'), missiles('3393-3423')] },
    { from: 'idle', nextState: 'deleted', trigger: 'external', guard: 'a same-source portal replacement sets duration to zero', effect: 'Delete and remove light.', refs: [missiles('2073-2123'), missiles('3393-3423')] },
  ],
  geometryChecks: [
    { check: 'FindClosestValidPosition: bounds, object/player/missile, solid/blocking, trigger exclusions', origin: 'clicked-point', target: 'corrected portal point within radius 5', refs: [missiles('2073-2123')] },
    { check: 'Standing player occupancy', origin: 'current-position', target: 'portal tile', refs: [missiles('3393-3423')] },
  ],
  speed: speed('stationary', '0', [missiles('2073-2123')]),
  lifetime: lifetime('exact-100-sentinel', '100 decrements to persistent sentinel 1; external replacement sets 0', [missiles('2073-2123'), missiles('3393-3423')]),
  ends: [{ cause: 'A later same-source portal replaces it; otherwise the idle sentinel persists.', refs: [missiles('2073-2123'), missiles('3393-3423')] }],
  spawns: [], refs: [missiles('2073-2123'), missiles('3393-3423')],
};

const stoneCurse: MissileBehaviourGraphData = {
  missile: 'StoneCurse', addFn: 'AddStoneCurse', processFn: 'ProcessStoneCurse', initialState: 'petrified-owner',
  states: [
    { id: 'petrified-owner', label: 'Timer owns and follows one Petrified monster', refs: [missiles('2363-2416'), missiles('3698-3724')] },
    { id: 'shatter', label: 'Dead target plays an eleven-tick shatter lifecycle', refs: [missiles('3698-3724')] },
    { id: 'deleted', label: 'Petrification owner deleted', terminal: true, refs: [missiles('3698-3724')] },
  ],
  transitions: [
    { from: 'petrified-owner', nextState: 'petrified-owner', trigger: 'tick-counter', guard: 'target remains living and Petrified; duration remains', effect: 'Decrement the petrification duration.', refs: [missiles('3698-3724')] },
    { from: 'petrified-owner', nextState: 'shatter', trigger: 'external', guard: 'target hit points reach zero before shatter mode begins', effect: 'Switch animation and reset duration to 11.', refs: [missiles('3698-3724')] },
    { from: 'petrified-owner', nextState: 'deleted', trigger: 'external', guard: 'target is no longer in Petrified mode', effect: 'Delete immediately without restoring the saved mode.', refs: [missiles('3698-3724')] },
    { from: 'petrified-owner', nextState: 'deleted', trigger: 'lifetime', guard: 'duration reaches zero while target is alive', effect: 'Restore the saved monster mode and clear isPetrified.', refs: [missiles('3698-3724')] },
    { from: 'shatter', nextState: 'deleted', trigger: 'lifetime', guard: 'eleven shatter ticks expire', effect: 'Add the stone corpse and delete.', refs: [missiles('3698-3724')] },
  ],
  geometryChecks: [{ check: 'FindClosestValidPosition over eligible monster occupants', origin: 'clicked-point', target: 'eligible monster within radius 5', refs: [missiles('2363-2416')] }],
  speed: speed('stationary', '0', [missiles('2363-2416')]),
  lifetime: lifetime('stone-curse', '16*min(S+6,15), or reset to 11 shatter ticks on target death', [missiles('2363-2416'), missiles('3698-3724')]),
  ends: [{ cause: 'Living expiry, target leaving Petrified mode, or completion of the death shatter.', refs: [missiles('3698-3724')] }],
  spawns: [], refs: [missiles('2363-2416'), missiles('3698-3724')],
};

const guardian: MissileBehaviourGraphData = {
  missile: 'Guardian', addFn: 'AddGuardian', processFn: 'ProcessGuardian', initialState: 'turret-idle',
  states: [
    { id: 'turret-idle', label: 'Stationary turret waits for each 16-tick firing opportunity', refs: [missiles('2188-2234'), missiles('3514-3583')] },
    { id: 'turret-attack', label: 'First eligible arc target produced one Firebolt', refs: [missiles('715-740'), missiles('3514-3583')] },
    { id: 'deleted', label: 'Guardian duration exhausted', terminal: true, refs: [missiles('3514-3583')] },
  ],
  transitions: [
    { from: 'turret-idle', nextState: 'turret-attack', trigger: 'target-found', guard: 'duration%16==0 and the first ordered arc candidate is line-clear, hostile, and alive', effect: 'Roll one shot damage, spawn one Firebolt, and enter Attack frames.', refs: [missiles('715-740'), missiles('3514-3583')] },
    { from: 'turret-idle', nextState: 'turret-idle', trigger: 'target-none', guard: 'no ordered arc candidate passes GuardianTryFireAt', effect: 'Do not fire this opportunity.', refs: [missiles('715-740'), missiles('3514-3583')] },
    { from: 'turret-attack', nextState: 'turret-idle', trigger: 'animation', guard: 'the attack hold counter reaches zero', effect: 'Return to Idle frames.', refs: [missiles('3514-3583')] },
    { from: 'turret-idle', nextState: 'deleted', trigger: 'lifetime', guard: 'duration reaches zero', effect: 'Delete and remove light.', refs: [missiles('3514-3583')] },
    { from: 'turret-attack', nextState: 'deleted', trigger: 'lifetime', guard: 'duration reaches zero', effect: 'Delete and remove light.', refs: [missiles('3514-3583')] },
  ],
  geometryChecks: [
    { check: 'Placement occupancy, solid/blocking tile, and LineClearMissile', origin: 'caster', target: 'corrected placement within radius 5 of clicked point', refs: [missiles('2188-2234')] },
    { check: 'GuardianTryFireAt LineClearMovingMissile and occupant eligibility', origin: 'current-position', target: 'ordered radius-6 arc candidate', refs: [missiles('715-740'), missiles('3514-3583')] },
  ],
  speed: speed('stationary', '0', [missiles('2188-2234')]),
  lifetime: lifetime('guardian', 'max(30,16*min(S+floor(C/2),30))', [missiles('2188-2234')]),
  ends: [{ cause: 'The level/character-scaled turret duration reaches zero.', refs: [missiles('3514-3583')] }],
  spawns: [{ missile: 'Firebolt', trigger: 'at most once per 16-tick opportunity when a target is found', refs: [missiles('715-740'), missiles('3514-3583')] }],
  refs: [missiles('715-740'), missiles('2188-2234'), missiles('3514-3583')],
};

const chainLightning: MissileBehaviourGraphData = {
  missile: 'ChainLightning', addFn: 'AddChainLightning', processFn: 'ProcessChainLightning', initialState: 'fan-out',
  states: [
    { id: 'fan-out', label: 'One-tick controller emits direct and radius-selected paths', refs: [missiles('2236-2241'), missiles('3585-3604')] },
    { id: 'deleted', label: 'Fan-out controller consumed', terminal: true, refs: [missiles('3585-3604')] },
  ],
  transitions: [{ from: 'fan-out', nextState: 'deleted', trigger: 'scan', guard: 'first process tick', effect: 'Spawn one LightningControl at the clicked target and one more at every positive monster occupant in radius min(S+3,MaxCrawlRadius); then delete.', refs: [missiles('3585-3604')] }],
  geometryChecks: [
    { check: 'Direct target aim', origin: 'current-position', target: 'clicked-point stored by Add*', refs: [missiles('2236-2241'), missiles('3585-3604')] },
    { check: 'Crawl monster occupancy scan (no line-clear test here)', origin: 'current-position', target: 'monster tiles within min(S+3,MaxCrawlRadius)', refs: [missiles('3585-3604')] },
  ],
  speed: speed('stationary', '0', [missiles('2236-2241')]), lifetime: lifetime('exact-1', '1', [missiles('2236-2241'), missiles('3585-3604')]),
  ends: [{ cause: 'Always deletes after its single fan-out process tick.', refs: [missiles('3585-3604')] }],
  spawns: [{ missile: 'LightningControl', trigger: 'one direct path plus one path per monster found in the radius scan', refs: [missiles('3585-3604')] }],
  refs: [missiles('2236-2241'), missiles('3585-3604')],
};

const flameWaveControl: MissileBehaviourGraphData = {
  missile: 'FlameWaveControl', addFn: 'AddFlameWaveControl', processFn: 'ProcessFlameWaveControl', initialState: 'emit-wave',
  states: [
    { id: 'emit-wave', label: 'One-tick transverse-wave placement controller', refs: [missiles('2564-2570'), missiles('3878-3907')] },
    { id: 'deleted', label: 'Controller consumed', terminal: true, refs: [missiles('3878-3907')] },
  ],
  transitions: [{ from: 'emit-wave', nextState: 'deleted', trigger: 'tick-counter', guard: 'first process tick', effect: 'If the forward center is placeable, create it and up to floor(S/2)+2 anchors on each side, stopping each side independently at a wall; then delete controller.', refs: [missiles('742-810'), missiles('3878-3907')] }],
  geometryChecks: [
    { check: 'CanPlaceWall for forward center', origin: 'caster', target: 'one tile toward clicked-point', refs: [missiles('3878-3907')] },
    { check: 'TryGrowWall side placement', origin: 'corrected-point', target: 'level-scaled transverse anchors to left and right', refs: [missiles('742-810'), missiles('3878-3907')] },
  ],
  speed: speed('stationary', '0', [missiles('2564-2570')]), lifetime: lifetime('exact-1', '1', [missiles('2564-2570')]),
  ends: [{ cause: 'Always deletes after the one placement tick.', refs: [missiles('3878-3907')] }],
  spawns: [{ missile: 'FlameWave', trigger: 'center and every successful side-anchor placement', refs: [missiles('742-810'), missiles('3878-3907')] }],
  refs: [missiles('742-810'), missiles('2564-2570'), missiles('3878-3907')],
};

const flameWave: MissileBehaviourGraphData = {
  missile: 'FlameWave', addFn: 'AddFlameWave', processFn: 'ProcessFlameWave', initialState: 'moving-wave',
  states: [
    { id: 'moving-wave', label: 'Moving wave segment; duration 255 is a non-decrementing sentinel', refs: [missiles('2177-2186'), missiles('3480-3512')] },
    { id: 'deleted', label: 'Blocking terrain stopped the segment', terminal: true, refs: [missiles('3480-3512')] },
  ],
  transitions: [
    { from: 'moving-wave', nextState: 'moving-wave', trigger: 'tick-counter', guard: 'current path is not missile-blocking', effect: 'Move without decrementing duration; animate/light the segment.', refs: [missiles('3480-3512')] },
    { from: 'moving-wave', nextState: 'moving-wave', trigger: 'collision', guard: 'an eligible actor occupies a newly traversed tile', effect: `${collisionEffect} TARGET_BOTH wave anchors bypass the player friendly-fire gate. Restore sentinel 255 after collision sets duration zero, so the segment pierces and does not recheck a stationary target after leaving its tile.`, refs: [...collisionRefs, missiles('486-530'), missiles('753-755'), missiles('3480-3512')] },
    { from: 'moving-wave', nextState: 'deleted', trigger: 'wall', guard: 'a traversed tile has TileProperties::BlockMissile', effect: 'Terrain clears _miHitFlag and leaves duration zero; delete and remove light.', refs: [missiles('543-555'), missiles('3480-3512')] },
  ],
  geometryChecks: [{ check: 'Swept actor and terrain collision after correcting the render-only south offset', origin: 'current-position', target: 'newly traversed path tiles', refs: [missiles('3480-3512')] }],
  speed: speed('constant-16', '16/16', [missiles('2177-2186')]),
  lifetime: lifetime('flame-wave-sentinel', '255 is never decremented; runtime ends only at missile-blocking terrain', [missiles('2177-2186'), missiles('3480-3512')]),
  ends: [{ cause: 'Only missile-blocking terrain (or external teardown/out-of-bounds), not lifetime expiry or actor hits.', refs: [missiles('3480-3512'), missiles('4211-4246')] }],
  spawns: [], refs: [missiles('2177-2186'), missiles('3480-3512')],
};

const nova: MissileBehaviourGraphData = {
  missile: 'Nova', addFn: 'AddNova', processFn: 'ProcessNova', initialState: 'emit-ring',
  states: [
    { id: 'emit-ring', label: 'One-tick controller emits 36 rays around caster', refs: [missiles('2572-2586'), missiles('3285-3317')] },
    { id: 'deleted', label: 'Ring controller consumed', terminal: true, refs: [missiles('3285-3317')] },
  ],
  transitions: [{ from: 'emit-ring', nextState: 'deleted', trigger: 'tick-counter', guard: 'first process tick', effect: 'Emit quadrant-offset rays; the four cardinal targets are duplicated, then delete.', refs: [missiles('3285-3317')] }],
  geometryChecks: [{ check: 'Fixed quarter-radius emission geometry', origin: 'caster', target: 'four mirrored radius-4 quadrants (36 rays, including duplicated cardinals)', refs: [missiles('3285-3317')] }],
  speed: speed('stationary', '0', [missiles('2572-2586')]), lifetime: lifetime('exact-1', '1', [missiles('2572-2586'), missiles('3285-3317')]),
  ends: [{ cause: 'Always deletes after emitting its ring.', refs: [missiles('3285-3317')] }],
  spawns: [{ missile: 'NovaBall', trigger: '36 AddMissile calls in the single emission tick', refs: [missiles('3285-3317')] }],
  refs: [missiles('2572-2586'), missiles('3285-3317')],
};

const novaBall: MissileBehaviourGraphData = {
  missile: 'NovaBall', addFn: 'AddNovaBall', processFn: 'ProcessNovaBall', initialState: 'ray-flight',
  states: [
    { id: 'ray-flight', label: 'Unblockable moving ray checks each newly reached tile', refs: [missiles('1951-1959'), missiles('3028-3046')] },
    { id: 'deleted', label: 'Ray stopped by wall or lifetime', terminal: true, refs: [missiles('3028-3046')] },
  ],
  transitions: [
    { from: 'ray-flight', nextState: 'ray-flight', trigger: 'collision', guard: 'an eligible actor is encountered', effect: `${collisionEffect} Restore the post-decrement duration and keep moving; lastCollisionTargetHash prevents another check while the slow ray remains on the same stationary target.`, refs: [...collisionRefs, missiles('643-672'), missiles('3028-3046')] },
    { from: 'ray-flight', nextState: 'ray-flight', trigger: 'tick-counter', guard: 'duration remains and terrain is not blocking', effect: 'Decrement duration and advance along the ray.', refs: [missiles('3028-3046')] },
    { from: 'ray-flight', nextState: 'deleted', trigger: 'wall', guard: 'a traversed tile blocks missiles', effect: 'Terrain clears hit flag, leaves duration zero, and deletes the ray.', refs: [missiles('543-555'), missiles('3028-3046')] },
    { from: 'ray-flight', nextState: 'deleted', trigger: 'lifetime', guard: 'the post-decrement 255 counter reaches zero', effect: 'Delete the ray.', refs: [missiles('3028-3046')] },
  ],
  geometryChecks: [{ check: 'Swept actor and missile-blocking terrain collision', origin: 'current-position', target: 'newly traversed ray tiles', refs: [missiles('562-672'), missiles('3028-3046')] }],
  speed: speed('constant-16', '16/16', [missiles('1951-1959')]), lifetime: lifetime('exact-255', '255 maximum flight ticks', [missiles('1951-1959'), missiles('3028-3046')]),
  ends: [{ cause: 'Missile-blocking terrain or the decrementing 255 flight counter; actor hits do not end it.', refs: [missiles('3028-3046')] }],
  spawns: [], refs: [missiles('1951-1959'), missiles('3028-3046')],
};

const infernoControl: MissileBehaviourGraphData = {
  missile: 'InfernoControl', addFn: 'AddInfernoControl', processFn: 'ProcessInfernoControl', initialState: 'laying-segments',
  states: [
    { id: 'laying-segments', label: 'Moving controller lays at most three distinct stationary segments', refs: [missiles('2690-2700'), missiles('3964-3990')] },
    { id: 'deleted', label: 'Three segments, wall, or controller lifetime stopped the path', terminal: true, refs: [missiles('3964-3990')] },
  ],
  transitions: [
    { from: 'laying-segments', nextState: 'laying-segments', trigger: 'tick-counter', guard: 'new tile is not blocking and fewer than three segments exist', effect: 'Spawn Inferno with zero-based segment index, then increment the index.', refs: [missiles('3964-3990')] },
    { from: 'laying-segments', nextState: 'deleted', trigger: 'wall', guard: 'new tile has TileProperties::BlockMissile', effect: 'Set duration zero and delete without placing on the blocked tile.', refs: [missiles('3964-3990')] },
    { from: 'laying-segments', nextState: 'deleted', trigger: 'tick-counter', guard: 'segment index reaches three', effect: 'Delete controller.', refs: [missiles('3964-3990')] },
    { from: 'laying-segments', nextState: 'deleted', trigger: 'lifetime', guard: '256-tick guard reaches zero', effect: 'Delete controller.', refs: [missiles('3964-3990')] },
  ],
  geometryChecks: [{ check: 'Distinct-tile terrain check', origin: 'current-position', target: 'each new aimed-line tile before laying a segment', refs: [missiles('3964-3990')] }],
  speed: speed('constant-32', '32/16', [missiles('2690-2700')]), lifetime: lifetime('exact-256', '<=256 ticks, additionally capped when three distinct segments have been laid', [missiles('2690-2700'), missiles('3964-3990')]),
  ends: [{ cause: 'Three segments laid, missile-blocking terrain, or controller guard expiry.', refs: [missiles('3964-3990')] }],
  spawns: [{ missile: 'Inferno', trigger: 'each distinct unblocked path tile until segment index reaches three', refs: [missiles('3964-3990')] }],
  refs: [missiles('2690-2700'), missiles('3964-3990')],
};

const inferno: MissileBehaviourGraphData = {
  missile: 'Inferno', addFn: 'AddInferno', processFn: 'ProcessInferno', initialState: 'burning-segment',
  states: [
    { id: 'burning-segment', label: 'Stationary segment repeatedly checks its tile', refs: [missiles('2672-2688'), missiles('3940-3962')] },
    { id: 'deleted', label: 'Segment-specific lifetime exhausted', terminal: true, refs: [missiles('3940-3962')] },
  ],
  transitions: [
    { from: 'burning-segment', nextState: 'burning-segment', trigger: 'collision', guard: 'an eligible actor occupies the segment tile', effect: `${collisionEffect} Restore post-decrement duration on a successful hit so hits do not prematurely consume the segment.`, refs: [...collisionRefs, missiles('3940-3962')] },
    { from: 'burning-segment', nextState: 'burning-segment', trigger: 'tick-counter', guard: 'duration remains above zero', effect: 'Continue animation/light and recheck on the next tick.', refs: [missiles('3940-3962')] },
    { from: 'burning-segment', nextState: 'deleted', trigger: 'lifetime', guard: '20+5*k duration reaches zero', effect: 'Delete and remove light.', refs: [missiles('3940-3962')] },
  ],
  geometryChecks: [areaCollision(missiles('3940-3962'), 'the stationary segment tile')],
  speed: speed('stationary', '0', [missiles('2672-2688')]), lifetime: lifetime('inferno-segment', '20+5*k for k in {0,1,2}; maximum 30', [missiles('2672-2688')]),
  ends: [{ cause: 'Its per-segment 20/25/30 tick duration reaches zero.', refs: [missiles('3940-3962')] }],
  spawns: [], refs: [missiles('2672-2688'), missiles('3940-3962')],
};

const apocalypse: MissileBehaviourGraphData = {
  missile: 'Apocalypse', addFn: 'AddApocalypse', processFn: 'ProcessApocalypse', initialState: 'scan',
  states: [
    { id: 'scan', label: 'Persistent scanner resumes after the last emitted monster', refs: [missiles('2657-2670'), missiles('3853-3876')] },
    { id: 'deleted', label: 'Bounded scan exhausted', terminal: true, refs: [missiles('3853-3876')] },
  ],
  transitions: [
    { from: 'scan', nextState: 'scan', trigger: 'target-found', guard: 'next scan cell has an eligible non-minion monster and is not solid', effect: 'Spawn one ApocalypseBoom on that monster tile, save the next scan cursor, and return for this tick.', refs: [missiles('3853-3876')] },
    { from: 'scan', nextState: 'deleted', trigger: 'scan', guard: 'all clipped scan cells have been exhausted', effect: 'Set _miDelFlag; the initialized 255 duration was never decremented.', refs: [missiles('2657-2670'), missiles('3853-3876')] },
  ],
  geometryChecks: [{ check: 'Clipped 16x16 monster/solid scan; vanilla has no line-clear guard', origin: 'caster', target: 'each cell in the bounded scan area', refs: [missiles('2657-2670'), missiles('3853-3876')] }],
  speed: speed('stationary', '0', [missiles('2657-2670')]), lifetime: lifetime('runtime-scan', 'runtime scan length; initialized 255 is not decremented', [missiles('2657-2670'), missiles('3853-3876')]),
  ends: [{ cause: 'The bounded cell scan is exhausted, not a duration countdown.', refs: [missiles('3853-3876')] }],
  spawns: [{ missile: 'ApocalypseBoom', trigger: 'at most one eligible monster cell per process tick', refs: [missiles('3853-3876')] }],
  refs: [missiles('2657-2670'), missiles('3853-3876')],
};

const apocalypseBoom: MissileBehaviourGraphData = {
  missile: 'ApocalypseBoom', addFn: 'AddApocalypseBoom', processFn: 'ProcessApocalypseBoom', initialState: 'damage-until-hit',
  states: [
    { id: 'damage-until-hit', label: 'Stationary explosion retries its target tile until first successful hit', refs: [missiles('2455-2460'), missiles('3726-3736')] },
    { id: 'visual-only', label: 'After first successful hit, only animation remains', refs: [missiles('3726-3736')] },
    { id: 'deleted', label: 'Animation duration exhausted', terminal: true, refs: [missiles('3726-3736')] },
  ],
  transitions: [
    { from: 'damage-until-hit', nextState: 'damage-until-hit', trigger: 'tick-counter', guard: 'collision attempt misses and animation duration remains', effect: 'Retry the same tile next tick.', refs: [missiles('3726-3736')] },
    { from: 'damage-until-hit', nextState: 'visual-only', trigger: 'collision', guard: '_miHitFlag becomes true', effect: `${collisionEffect} Set var1 so later ticks skip collision.`, refs: [...collisionRefs, missiles('3726-3736')] },
    { from: 'damage-until-hit', nextState: 'deleted', trigger: 'lifetime', guard: 'animation expires without a successful hit', effect: 'Delete.', refs: [missiles('3726-3736')] },
    { from: 'visual-only', nextState: 'deleted', trigger: 'lifetime', guard: 'animation duration reaches zero', effect: 'Delete.', refs: [missiles('3726-3736')] },
  ],
  geometryChecks: [areaCollision(missiles('3726-3736'), 'the monster tile selected by the scanner')],
  speed: speed('stationary', '0', [missiles('2455-2460')]), lifetime: lifetime('animation', 'A', [missiles('2455-2460')]),
  ends: [{ cause: 'Its sprite animation expires; collision attempts stop after the first successful hit.', refs: [missiles('3726-3736')] }],
  spawns: [], refs: [missiles('2455-2460'), missiles('3726-3736')],
};

const chargedBolt: MissileBehaviourGraphData = {
  missile: 'ChargedBolt', addFn: 'AddChargedBolt', processFn: 'ProcessChargedBolt', initialState: 'wobble-flight',
  states: [
    { id: 'wobble-flight', label: 'Blockable projectile updates its wobble direction every 16 ticks', refs: [missiles('2702-2718'), missiles('3992-4031')] },
    { id: 'impact-animation', label: 'Successful actor hit becomes stationary Lightning animation', refs: [missiles('4012-4021')] },
    { id: 'deleted', label: 'Flight or impact animation exhausted', terminal: true, refs: [missiles('3992-4031')] },
  ],
  transitions: [
    { from: 'wobble-flight', nextState: 'wobble-flight', trigger: 'tick-counter', guard: 'no stopping collision and duration remains', effect: 'Update wobble velocity when its 16-tick counter resets, then move/check.', refs: [missiles('3992-4031')] },
    { from: 'wobble-flight', nextState: 'impact-animation', trigger: 'collision', guard: '_miHitFlag is true after an eligible actor hit', effect: `${collisionEffect} Stop velocity and switch to Lightning animation.`, refs: [...collisionRefs, missiles('3992-4031')] },
    { from: 'wobble-flight', nextState: 'deleted', trigger: 'wall', guard: 'terrain ends flight without _miHitFlag', effect: 'Delete and remove light.', refs: [missiles('543-555'), missiles('3992-4031')] },
    { from: 'wobble-flight', nextState: 'deleted', trigger: 'lifetime', guard: '256 flight ticks expire without an actor-hit transform', effect: 'Delete and remove light.', refs: [missiles('3992-4031')] },
    { from: 'impact-animation', nextState: 'deleted', trigger: 'lifetime', guard: 'Lightning animation duration reaches zero', effect: 'Delete and remove light.', refs: [missiles('3992-4031')] },
  ],
  geometryChecks: [{ check: 'Swept actor and terrain collision along the changing wobble path', origin: 'current-position', target: 'newly traversed tiles', refs: [missiles('3992-4031')] }],
  speed: speed('constant-8', '8/16', [missiles('2702-2718')]), lifetime: lifetime('charged-bolt-phases', '<=256 flight ticks; actor hit can add A Lightning-animation ticks', [missiles('2702-2718'), missiles('3992-4031')], 'Lightning'),
  ends: [{ cause: 'Blocking terrain, flight expiry, or completion of the actor-hit Lightning animation.', refs: [missiles('3992-4031')] }],
  spawns: [], refs: [missiles('2702-2718'), missiles('3992-4031')],
};

const holyBolt: MissileBehaviourGraphData = {
  missile: 'HolyBolt', addFn: 'AddHolyBolt', processFn: 'ProcessHolyBolt', initialState: 'flight',
  states: [
    { id: 'flight', label: 'Blockable holy projectile flight', refs: [missiles('2720-2740'), missiles('4033-4059')] },
    { id: 'impact-animation', label: 'Stationary HolyBoltExplosion visual', refs: [missiles('4033-4059')] },
    { id: 'deleted', label: 'Impact animation exhausted', terminal: true, refs: [missiles('4033-4059')] },
  ],
  transitions: [
    { from: 'flight', nextState: 'flight', trigger: 'tick-counter', guard: 'no actor hit, wall, or flight expiry', effect: 'Move and collision-check, ignoring the start tile.', refs: [missiles('4033-4059')] },
    { from: 'flight', nextState: 'impact-animation', trigger: 'collision', guard: 'eligible monster collision ends flight', effect: `${collisionEffect} Switch to HolyBoltExplosion.`, refs: [...collisionRefs, missiles('4033-4059')] },
    { from: 'flight', nextState: 'impact-animation', trigger: 'wall', guard: 'a traversed tile blocks missiles', effect: 'Stop and switch to HolyBoltExplosion.', refs: [missiles('543-672'), missiles('4033-4059')] },
    { from: 'flight', nextState: 'impact-animation', trigger: 'lifetime', guard: '256 flight ticks expire', effect: 'Stop and switch to HolyBoltExplosion.', refs: [missiles('4033-4059')] },
    { from: 'impact-animation', nextState: 'deleted', trigger: 'lifetime', guard: 'A-1 explosion ticks expire', effect: 'Delete and remove light.', refs: [missiles('4033-4059')] },
  ],
  geometryChecks: [{ check: 'Swept eligible-actor and blocking-terrain collision', origin: 'current-position', target: 'newly traversed tiles, ignoring the start tile', refs: [missiles('4033-4059')] }],
  speed: speed('holy-bolt', '(16+min(2*S,47))/16', [missiles('2720-2740')]), lifetime: lifetime('holy-bolt-phases', '<=256 flight ticks + (A-1) HolyBoltExplosion ticks', [missiles('2720-2740'), missiles('4033-4059')], 'HolyBoltExplosion'),
  ends: [{ cause: 'Flight always transforms on actor hit, wall, or expiry; explosion animation completion deletes it.', refs: [missiles('4033-4059')] }],
  spawns: [], refs: [missiles('2720-2740'), missiles('4033-4059')],
};

const elemental: MissileBehaviourGraphData = {
  missile: 'Elemental', addFn: 'AddElemental', processFn: 'ProcessElemental', initialState: 'initial-flight',
  states: [
    { id: 'initial-flight', label: 'Unblockable flight toward the stored clicked destination', refs: [missiles('2496-2516'), missiles('4061-4121')] },
    { id: 'retarget-search', label: 'One retarget is triggered by reaching the clicked destination', refs: [missiles('4089-4107')] },
    { id: 'retargeted-flight', label: 'Second flight toward found monster or caster-facing fallback', refs: [missiles('4093-4107')] },
    { id: 'explosion', label: 'Stationary 3x3 BigExplosion rechecks visible cells every tick', refs: [missiles('4066-4087')] },
    { id: 'deleted', label: 'Explosion animation exhausted', terminal: true, refs: [missiles('4066-4087')] },
  ],
  transitions: [
    { from: 'initial-flight', nextState: 'initial-flight', trigger: 'tick-counter', guard: 'clicked destination has not been reached and no collision/wall/lifetime stop occurred', effect: 'Decrement duration, move, and collision-check.', refs: [missiles('4061-4121')] },
    { from: 'initial-flight', nextState: 'retarget-search', trigger: 'position-reached', guard: 'pre-move missilePosition equals stored clicked destination and retarget marker is zero', effect: 'Arm the one-time retarget marker; this is not a lifetime-expiry trigger.', refs: [missiles('4089-4094')] },
    { from: 'retarget-search', nextState: 'retargeted-flight', trigger: 'target-found', guard: 'FindClosest(current position,19) returns a monster', effect: 'Reset duration to 255 and velocity 16 toward that monster.', refs: [missiles('4093-4102')] },
    { from: 'retarget-search', nextState: 'retargeted-flight', trigger: 'target-none', guard: 'FindClosest(current position,19) returns null', effect: 'Reset duration to 255 and continue at velocity 16 in the caster current facing direction.', refs: [missiles('4102-4107')] },
    { from: 'initial-flight', nextState: 'explosion', trigger: 'collision', guard: 'eligible actor hit sets duration zero before the retarget trigger', effect: `${collisionEffect} Transform to BigExplosion; no retarget occurs.`, refs: [...collisionRefs, missiles('4061-4121')] },
    { from: 'initial-flight', nextState: 'explosion', trigger: 'wall', guard: 'terrain blocks the path', effect: 'Transform to BigExplosion at the terminal position.', refs: [missiles('543-672'), missiles('4061-4121')] },
    { from: 'initial-flight', nextState: 'explosion', trigger: 'lifetime', guard: 'initial 256 counter reaches zero without reaching the clicked destination', effect: 'Transform to BigExplosion.', refs: [missiles('4061-4121')] },
    { from: 'retargeted-flight', nextState: 'retargeted-flight', trigger: 'tick-counter', guard: 'no actor hit, wall, or 255-counter expiry', effect: 'Move/collision-check along the retargeted or fallback direction.', refs: [missiles('4061-4121')] },
    { from: 'retargeted-flight', nextState: 'explosion', trigger: 'collision', guard: 'eligible actor hit sets duration zero', effect: `${collisionEffect} Transform to BigExplosion.`, refs: [...collisionRefs, missiles('4061-4121')] },
    { from: 'retargeted-flight', nextState: 'explosion', trigger: 'wall', guard: 'terrain blocks the path', effect: 'Transform to BigExplosion.', refs: [missiles('543-672'), missiles('4061-4121')] },
    { from: 'retargeted-flight', nextState: 'explosion', trigger: 'lifetime', guard: 'retargeted 255 counter reaches zero', effect: 'Transform to BigExplosion.', refs: [missiles('4061-4121')] },
    { from: 'explosion', nextState: 'explosion', trigger: 'collision', guard: 'CheckBlock(selected origin, center/neighbor) is false and duration remains', effect: `${collisionEffect} dontDeleteOnCollision preserves the explosion, so all nine cells are rechecked each explosion tick.`, refs: [...collisionRefs, missiles('4066-4087')] },
    { from: 'explosion', nextState: 'deleted', trigger: 'lifetime', guard: 'A-1 BigExplosion ticks expire', effect: 'Delete and remove light.', refs: [missiles('4066-4087')] },
  ],
  geometryChecks: [
    { check: 'Swept flight actor/terrain collision', origin: 'current-position', target: 'newly traversed tiles', refs: [missiles('562-672'), missiles('4061-4121')] },
    { check: 'FindClosest monster search', origin: 'current-position', target: 'closest candidate within radius 19', refs: [missiles('4093-4107')] },
    { check: 'CheckBlock explosion visibility before retarget', origin: 'start-position', target: 'explosion center plus eight neighbors', refs: [missiles('4066-4087')] },
    { check: 'CheckBlock explosion visibility after retarget', origin: 'clicked-point', target: 'explosion center plus eight neighbors', refs: [missiles('4066-4087')] },
  ],
  speed: speed('constant-16', '16/16 before and after retarget', [missiles('2496-2516'), missiles('4093-4107')]),
  lifetime: lifetime('elemental-phases', '<=256 initial + <=255 retargeted + (A-1) BigExplosion ticks', [missiles('2496-2516'), missiles('4061-4121')], 'BigExplosion'),
  ends: [{ cause: 'Actor collision, wall, or phase counter transforms flight; BigExplosion animation expiry deletes it.', refs: [missiles('4061-4121')] }],
  spawns: [], refs: [missiles('2496-2516'), missiles('4061-4121')],
};

const boneSpirit: MissileBehaviourGraphData = {
  missile: 'BoneSpirit', addFn: 'AddBoneSpirit', processFn: 'ProcessBoneSpirit', initialState: 'initial-flight',
  states: [
    { id: 'initial-flight', label: 'Blockable flight toward stored clicked destination', refs: [missiles('2770-2784'), missiles('4123-4165')] },
    { id: 'retarget-search', label: 'One retarget triggered by reaching clicked destination', refs: [missiles('4138-4152')] },
    { id: 'retargeted-flight', label: 'Second flight toward found monster or caster-facing fallback', refs: [missiles('4140-4152')] },
    { id: 'fade', label: 'Stationary seven-tick no-direction fade', refs: [missiles('4126-4133'), missiles('4158-4162')] },
    { id: 'deleted', label: 'Fade exhausted', terminal: true, refs: [missiles('4126-4133')] },
  ],
  transitions: [
    { from: 'initial-flight', nextState: 'retarget-search', trigger: 'position-reached', guard: 'current tile reaches stored clicked destination before a stop', effect: 'Arm one retarget and reset duration to 255.', refs: [missiles('4138-4143')] },
    { from: 'retarget-search', nextState: 'retargeted-flight', trigger: 'target-found', guard: 'FindClosest within 19 returns a monster', effect: 'Store target HP-derived damage and aim at its current tile.', refs: [missiles('4140-4148')] },
    { from: 'retarget-search', nextState: 'retargeted-flight', trigger: 'target-none', guard: 'no monster is found', effect: 'Continue in caster current facing direction.', refs: [missiles('4148-4152')] },
    { from: 'initial-flight', nextState: 'fade', trigger: 'collision', guard: 'eligible actor hit ends blockable flight', effect: `${collisionEffect} Stop and enter seven-tick fade.`, refs: [...collisionRefs, missiles('4123-4165')] },
    { from: 'initial-flight', nextState: 'fade', trigger: 'wall', guard: 'terrain blocks flight', effect: 'Stop and enter seven-tick fade.', refs: [missiles('4123-4165')] },
    { from: 'initial-flight', nextState: 'fade', trigger: 'lifetime', guard: 'initial counter expires', effect: 'Stop and enter seven-tick fade.', refs: [missiles('4123-4165')] },
    { from: 'retargeted-flight', nextState: 'fade', trigger: 'collision', guard: 'eligible actor hit ends blockable flight', effect: `${collisionEffect} Stop and enter seven-tick fade.`, refs: [...collisionRefs, missiles('4123-4165')] },
    { from: 'retargeted-flight', nextState: 'fade', trigger: 'wall', guard: 'terrain blocks flight', effect: 'Stop and enter seven-tick fade.', refs: [missiles('4123-4165')] },
    { from: 'retargeted-flight', nextState: 'fade', trigger: 'lifetime', guard: '255 retarget counter expires', effect: 'Stop and enter seven-tick fade.', refs: [missiles('4123-4165')] },
    { from: 'fade', nextState: 'deleted', trigger: 'lifetime', guard: 'seven fade ticks expire', effect: 'Delete and remove light.', refs: [missiles('4126-4133')] },
  ],
  geometryChecks: [
    { check: 'Swept actor and terrain collision', origin: 'current-position', target: 'newly traversed flight tiles', refs: [missiles('562-672'), missiles('4123-4165')] },
    { check: 'FindClosest monster search', origin: 'current-position', target: 'closest candidate within radius 19', refs: [missiles('4140-4152')] },
  ],
  speed: speed('constant-16', '16/16 before and after retarget', [missiles('2770-2784'), missiles('4140-4152')]), lifetime: lifetime('bone-spirit-phases', '<=256 initial + <=255 retargeted + 7 fade ticks', [missiles('2770-2784'), missiles('4123-4165')]),
  ends: [{ cause: 'Collision, wall, or phase expiry enters fade; seven fade ticks delete it.', refs: [missiles('4123-4165')] }],
  spawns: [], refs: [missiles('2770-2784'), missiles('4123-4165')],
};

const resurrectBeam = stationaryTimer(
  'ResurrectBeam', 'AddResurrectBeam', 'ProcessResurrectBeam',
  lifetime('animation', 'A', [missiles('2754-2759')], 'Resurrect'),
  missiles('2754-2759'), missiles('4167-4173'), 'Advance the stationary resurrection visual.',
);

const infravision = stationaryTimer(
  'Infravision', 'AddInfravision', 'ProcessInfravision',
  lifetime('infravision', 'ScaleSpellEffect(1584,S)', [missiles('2559-2562')]),
  missiles('2559-2562'), missiles('3842-3851'), 'Assert the player infravision flag for this tick.',
);

const etherealize: MissileBehaviourGraphData = {
  missile: 'Etherealize', addFn: null, processFn: null, initialState: 'unavailable',
  states: [{ id: 'unavailable', label: 'Vanilla spell-table slot has no Add*/Process* missile dispatch', terminal: true, refs: ['.reference/devilutionX/Source/tables/misdat.h:98', '.reference/devilutionX/Source/tables/spelldat.h:134'] }],
  transitions: [], geometryChecks: [], speed: speed('stationary', '0', ['.reference/devilutionX/Source/tables/misdat.h:98']),
  lifetime: lifetime('unmanaged', 'no managed missile lifetime (null dispatch)', ['.reference/devilutionX/Source/tables/misdat.h:98']),
  ends: [{ cause: 'No runtime missile state machine exists for this vanilla slot.', refs: ['.reference/devilutionX/Source/tables/misdat.h:98'] }],
  spawns: [], refs: ['.reference/devilutionX/Source/tables/misdat.h:98'],
};

export const MISSILE_BEHAVIOUR_GRAPHS_DATA = [
  genericProjectile('Firebolt', 'AddFirebolt', missiles('1867-1900'), speed('firebolt', '(16+min(2*S,47))/16 for player casts', [missiles('1867-1900')]), 'MagmaBallExplosion'),
  visualExplosion('MagmaBallExplosion', 'MagmaBallExplosion'),
  ...instantRows,
  lightningControl,
  lightning,
  flash('FlashBottom', 'AddFlashBottom', missiles('2125-2143'), 'ProcessFlashBottom', missiles('3425-3452'), 'six center/bottom offsets'),
  flash('FlashTop', 'AddFlashTop', missiles('2145-2159'), 'ProcessFlashTop', missiles('3454-3478'), 'three top offsets'),
  fireWallControl,
  fireWall,
  townPortal,
  stoneCurse,
  infravision,
  phasing,
  fireball,
  guardian,
  chainLightning,
  flameWaveControl,
  flameWave,
  nova,
  novaBall,
  infernoControl,
  inferno,
  teleport,
  apocalypse,
  apocalypseBoom,
  etherealize,
  elemental,
  chargedBolt,
  holyBolt,
  resurrectBeam,
  genericProjectile('BloodStar', 'AddGenericMagicMissile', missiles('2284-2326'), speed('constant-16', '16/16', [missiles('2284-2326')]), 'BloodStarExplosion'),
  visualExplosion('BloodStarExplosion', 'BloodStarExplosion'),
  boneSpirit,
] as const satisfies readonly MissileBehaviourGraphData[];
