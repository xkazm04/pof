/** Pin-verified monster attack ledgers. This module imports public types only. */
import type { D1AiRoutineId } from '@/lib/catalog/reference/aiRoutines';
import type {
  MonsterAttackLedgerSpec,
  MonsterAttackSequenceSpec,
  MonsterAttackStep,
} from '@/lib/catalog/reference/monsterAttackLedger';

const monster = (lines: string): string => `.reference/devilutionX/Source/monster.cpp:${lines}`;
const missiles = (lines: string): string => `.reference/devilutionX/Source/missiles.cpp:${lines}`;

const MODE_REFS = [monster('1271-1373'), monster('3165-3207'), monster('4321-4333')] as const;
const TARGET_REFS = [monster('679-747'), monster('4257-4311')] as const;
const MELEE_HIT_REFS = [monster('1160-1258'), monster('1261-1295')] as const;
const MISSILE_HIT_REFS = [missiles('1067-1170')] as const;

const step = (
  phase: MonsterAttackStep['phase'],
  what: string,
  formula: string | undefined,
  refs: readonly string[],
  branches?: MonsterAttackStep['branches'],
): MonsterAttackStep => ({ phase, what, ...(formula ? { formula } : {}), ...(branches ? { branches } : {}), refs });

function melee(id: string, condition: string, decideRef: string): MonsterAttackSequenceSpec {
  return {
    id,
    kind: 'melee',
    condition,
    animation: 'attack',
    damageChannel: 'normal',
    steps: [
      step('decide', 'The AI routine chooses StartAttack while standing and in its melee branch.', 'AI condition -> StartAttack(monster)', [decideRef, ...TARGET_REFS]),
      step('wind-up', 'StartAttack faces enemyPosition and starts MonsterGraphic::Attack with same-tick animation processing pending.', 'frames[6][Attack], rate[6][Attack]', [monster('823-830'), monster('653-659')]),
      step('hit-frame', 'MonsterAttack checks the one-based normal marker before the end-of-tick animation advance. Every delay tick on that frame runs the check unless it is the last frame, which recovers immediately.', 'currentFrame == animFrameNum - 1; first tick offset = (animFrameNum - 1) * rate[6][Attack]', [monster('1271-1292'), monster('4321-4333')]),
      step('to-hit', 'Each check resolves the target, adjacency, armour, difficulty level, floor, and block roll.', 'max(toHit(difficulty) + 2*(monsterLevel-playerLevel) + 30 - playerArmor, GetMinHit())', MELEE_HIT_REFS),
      step('damage', 'A damaging hit rolls the normal channel in fixed-point units and applies the one-HP floor.', 'max(RandomIntBetween(minDamage<<6,maxDamage<<6) + playerGetHit<<6, 64)', [monster('1215-1225')]),
      step('recover', 'When the last attack frame is already active, the mode returns to Stand before animation advance and the AI loop may decide again.', 'recover offset = (frames[6][Attack] - 1) * rate[6][Attack]', [monster('1290-1295'), monster('4321-4333')]),
    ],
    refs: [decideRef, ...MODE_REFS],
  };
}

function specialMelee(id: string, condition: string, decideRef: string): MonsterAttackSequenceSpec {
  return {
    id,
    kind: 'special-melee',
    condition,
    animation: 'special',
    damageChannel: 'special',
    steps: [
      step('decide', 'The AI branch chooses StartSpecialAttack.', 'AI condition -> StartSpecialAttack(monster)', [decideRef]),
      step('special', 'The sequence exists only when the row marker is positive; marker zero can never equal a current frame plus one.', 'animFrameNumSpecial > 0', [monster('858-865'), monster('1362-1373')], [
        { condition: 'animFrameNumSpecial == 0', outcome: 'No special hit is present in the instantiated ledger.' },
        { condition: 'animFrameNumSpecial > 0', outcome: 'Use the special animation marker and special combat channel.' },
      ]),
      step('wind-up', 'StartSpecialAttack starts MonsterGraphic::Special.', 'frames[6][Special], rate[6][Special]', [monster('858-865')]),
      step('hit-frame', 'MonsterSpecialAttack checks the one-based marker on every delay tick of the marked frame unless it is the last frame, which recovers immediately.', 'currentFrame == animFrameNumSpecial - 1; first tick offset = (animFrameNumSpecial - 1) * rate[6][Special]', [monster('1362-1370')]),
      step('to-hit', 'The ordinary monster-to-player hit law runs with the special to-hit channel and its dungeon-floor rule.', 'max(toHitSpecial(difficulty) + 2*(monsterLevel-playerLevel) + 30 - playerArmor, GetMinHit())', MELEE_HIT_REFS),
      step('damage', 'A damaging hit uses the special row channel; even a zero range is floored to one HP.', 'max(RandomIntBetween(minDamageSpecial<<6,maxDamageSpecial<<6) + playerGetHit<<6, 64)', [monster('1217-1225'), monster('1362-1366')]),
      step('recover', 'The last Special frame returns the monster to Stand.', 'recover offset = (frames[6][Special] - 1) * rate[6][Special]', [monster('1368-1373')]),
    ],
    refs: [decideRef, ...MODE_REFS],
  };
}

interface ProjectileOptions {
  readonly id: string;
  readonly missile: string;
  readonly condition: string;
  readonly decideRef: string;
  readonly specialAnimation?: boolean;
  readonly channel?: MonsterAttackSequenceSpec['damageChannel'];
  readonly damageFormula: string;
  readonly collision: string;
  readonly refs: readonly string[];
}

function projectile(options: ProjectileOptions): MonsterAttackSequenceSpec {
  const special = options.specialAnimation === true;
  const marker = special ? 'animFrameNumSpecial' : 'animFrameNum';
  const animation = special ? 'Special' : 'Attack';
  const rate = `rate[6][${animation}]`;
  return {
    id: options.id,
    kind: 'missile',
    missile: options.missile,
    condition: options.condition,
    animation: special ? 'special' : 'attack',
    damageChannel: options.channel ?? 'normal',
    steps: [
      step('decide', `The AI routine selects ${options.missile} after its distance, roll, and line-clear gates.`, `AI condition -> ${special ? 'StartRangedSpecialAttack' : 'StartRangedAttack'}`, [options.decideRef]),
      step('wind-up', `The start helper selects MonsterGraphic::${animation} and stores the missile arguments.`, `frames[6][${animation}], ${rate}`, [special ? monster('843-856') : monster('832-841')]),
      step('hit-frame', `The mode emits ${options.missile} at the row marker. ${special ? 'Special ranged emission is restricted to tickCounterOfCurrentFrame == 0.' : 'Normal ranged emission repeats on every delay tick of the marked frame unless it is the immediately recovering last frame.'}`, `currentFrame == ${marker} - 1; first tick offset = (${marker} - 1) * ${rate}`, [special ? monster('1329-1359') : monster('1298-1327')]),
      step('to-hit', 'At collision PlayerMHit rolls missile to-hit; arrows use monster toHit and armour, while non-arrows use the magic-projectile formula.', 'arrow: max(toHit(difficulty)+2*(monsterLevel-playerLevel)+30-2*distance-playerArmor, missileFloor); magic: max(40+2*monsterLevel-2*playerLevel-2*distance, missileFloor)', MISSILE_HIT_REFS),
      step('damage', 'The missile process selects its damage unit channel before PlayerMHit applies resistance and the one-HP floor.', options.damageFormula, [missiles('1067-1170'), ...options.refs]),
      step('missile', options.collision, undefined, options.refs),
      step('recover', `The last ${animation} frame returns the monster to Stand; an emitted missile continues independently.`, `recover offset = (frames[6][${animation}] - 1) * ${rate}`, [special ? monster('1354-1359') : monster('1321-1327')]),
    ],
    refs: [options.decideRef, ...options.refs, ...MODE_REFS],
  };
}

const movingProjectile = (
  id: string,
  missileId: string,
  condition: string,
  decideRef: string,
  specialAnimation = false,
): MonsterAttackSequenceSpec => projectile({
  id,
  missile: missileId,
  condition,
  decideRef,
  specialAnimation,
  channel: 'normal',
  damageFormula: 'ProjectileMonsterDamage = RandomIntBetween(minDamage,maxDamage); isDamageShifted=false converts the whole-HP roll to 1/64 HP inside PlayerMHit',
  collision: 'A generic moving projectile stops on a successful actor hit, blocking terrain, or duration expiry; its visual impact child does no second damage.',
  refs: [missiles('267-271'), missiles('643-672'), missiles('2945-3025')],
});

function charge(id: string, condition: string, decideRef: string): MonsterAttackSequenceSpec {
  return {
    id,
    kind: 'charge',
    missile: 'Rhino',
    condition,
    animation: 'immediate',
    damageChannel: 'special',
    steps: [
      step('decide', 'The AI creates a Rhino missile when the route gate succeeds; the monster itself becomes the moving projectile.', 'AI condition -> AddMissile(..., MissileID::Rhino, ...)', [decideRef]),
      step('special', 'There is no attack animation marker. A collision moves the monster and calls the special channel with an engine to-hit argument.', 'MissToMonst -> MonsterAttackPlayer(hit=500,minDamageSpecial,maxDamageSpecial)', [monster('4580-4623')]),
      step('to-hit', 'Player adjacency, immunity, block, and the ordinary monster hit law still run; the engine hit argument dominates the percentage threshold.', 'max(500 + 2*(monsterLevel-playerLevel) + 30 - playerArmor, GetMinHit())', [monster('1174-1213'), monster('4580-4623')]),
      step('damage', 'A landed collision uses the special damage range and the one-HP floor.', 'max(RandomIntBetween(minDamageSpecial<<6,maxDamageSpecial<<6) + playerGetHit<<6, 64)', [monster('1217-1225'), monster('4600-4623')]),
      step('missile', 'Rhino processing ends at its collision/route terminal state; Gloom skips damage, and Snake skips the shove after damage.', undefined, [monster('4592-4615'), missiles('3738-3772')]),
      step('recover', 'MissToMonst restores Stand and starts the monster hit reaction at the collision tile.', 'M_StartStand; M_StartHit', [monster('4580-4590')]),
    ],
    refs: [decideRef, monster('4580-4623'), missiles('3738-3772')],
  };
}

function extraSwing(
  routine: 'Magma' | 'Storm',
  currentFrame: number,
  toHit: number,
  damage: number,
): MonsterAttackSequenceSpec {
  return {
    id: `${routine.toLowerCase()}-engine-extra-swing`,
    kind: 'melee',
    condition: `The monster type belongs to the ${routine} engine family and the normal attack reaches its extra frame.`,
    animation: 'attack',
    damageChannel: 'normal',
    engineCurrentFrame: currentFrame,
    modifiers: { toHit, damage },
    steps: [
      step('decide', 'The same StartAttack decision that begins normal melee also enables this type-family check.', 'StartAttack(monster)', [monster('2013-2067')]),
      step('wind-up', 'The extra strike shares MonsterGraphic::Attack.', 'frames[6][Attack], rate[6][Attack]', [monster('823-830')]),
      step('hit-frame', 'This strike is keyed to an engine currentFrame literal, not animFrameNum.', `currentFrame == ${currentFrame}`, [monster('1278-1287')]),
      step('to-hit', 'The family modifier is applied to the normal to-hit channel before the ordinary player hit law.', `toHit(difficulty) ${toHit < 0 ? '-' : '+'} ${Math.abs(toHit)}`, [monster('1278-1287'), monster('1174-1213')]),
      step('damage', 'The family modifier is applied to the normal damage channel before fixed-point rolling and the one-HP floor.', `minDamage/maxDamage ${damage < 0 ? '-' : '+'} ${Math.abs(damage)}`, [monster('1278-1287'), monster('1217-1225')]),
      step('recover', 'Recovery is shared with the enclosing normal attack animation.', '(frames[6][Attack] - 1) * rate[6][Attack]', [monster('1290-1295')]),
    ],
    refs: [monster('1271-1295')],
  };
}

const counselorProjectile = (routine: D1AiRoutineId, decideRef: string): MonsterAttackSequenceSpec => projectile({
  id: `${routine.toLowerCase()}-counselor-projectile`,
  missile: 'Firebolt|ChargedBolt|LightningControl|Fireball',
  condition: 'At range, the Counselor-family roll and moving-missile line test pass; intelligence selects the missile.',
  decideRef,
  channel: 'engine',
  damageFormula: 'Firebolt/Fireball receive one RandomIntBetween(minDamage,maxDamage) whole-HP value; ChargedBolt uses its AddChargedBolt monster constant; Lightning segments use 2*RandomIntBetween(minDamage,maxDamage) already in 1/64-HP units and floor each hit to 64',
  collision: 'Firebolt is a stopping moving projectile. Fireball termination on a flight hit, blocking terrain, or expiry performs a one-time line-visible 3x3 blast pass before its animation-only phase, so the direct target can be checked again. ChargedBolt stops into its impact animation; LightningControl lays persistent Lightning segments whose hits do not consume their duration.',
  refs: [monster('2753-2758'), missiles('1903-2024'), missiles('267-271'), missiles('2976-3025'), missiles('3359-3390'), missiles('3992-4030')],
});

const flash = (routine: D1AiRoutineId, decideRef: string): MonsterAttackSequenceSpec => ({
  id: `${routine.toLowerCase()}-flash`,
  kind: 'missile',
  missile: 'FlashBottom+FlashTop',
  condition: 'Healthy and adjacent: forced immediately after Delay, otherwise on the Counselor-family adjacent roll.',
  animation: 'immediate',
  damageChannel: 'engine',
  steps: [
    step('decide', 'The AI calls StartRangedAttack with a null missile and immediately creates both Flash halves in the same decision call.', 'StartRangedAttack(Null); AddMissile(FlashBottom); AddMissile(FlashTop)', [decideRef, monster('2771-2775')]),
    step('hit-frame', 'Flash creation does not wait for animFrameNum; the normal attack animation is only the recovery stance.', 'decision tick', [monster('2771-2775')]),
    step('to-hit', 'Every covered tile is rechecked each process tick with magic-projectile to-hit; shifted damage disables blocking.', 'max(40+2*monsterLevel-2*playerLevel-2*distance, missileFloor)', [missiles('1067-1170'), missiles('3425-3477')]),
    step('damage', 'Bottom replaces the add argument with 2*monsterLevel internal units; Top keeps the AddMissile damage argument. Each shifted collision is floored to 64 internal units.', 'Bottom _midam=2*monsterLevel; Top _midam=AddMissile damage argument; damage=max(_midam+playerGetHit,64)', [missiles('2125-2159'), missiles('1150-1170')]),
    step('missile', 'Bottom covers six offsets including the center and southern/western half; Top covers the other three offsets. Both persist and recheck without deletion on actor collision.', undefined, [missiles('3425-3477')]),
    step('recover', 'The null ranged attack animation returns to Stand on its last Attack frame.', '(frames[6][Attack] - 1) * rate[6][Attack]', [monster('1298-1327')]),
  ],
  refs: [decideRef, monster('2771-2775'), missiles('2125-2159'), missiles('3425-3477')],
});

const familiarLightning: MonsterAttackSequenceSpec = {
  id: 'familiar-lightning',
  kind: 'missile',
  missile: 'Lightning',
  condition: 'The subtype is Familiar and normal melee begins.',
  animation: 'immediate',
  damageChannel: 'engine',
  steps: [
    step('decide', 'Immediately after StartAttack, the Familiar branch creates Lightning at enemyPosition in the same AI call.', 'StartAttack(monster); AddMissile(..., MissileID::Lightning, ..., GenerateRnd(10)+1, ...)', [monster('2469-2474')]),
    step('hit-frame', 'Lightning creation does not wait for animFrameNum; the separate melee hit still uses the normal marker.', 'decision tick', [monster('2469-2474')]),
    step('to-hit', 'Every Lightning process tick makes a fresh magic-projectile to-hit check and shifted damage disables blocking.', 'max(40+2*monsterLevel-2*playerLevel-2*distance, missileFloor)', [missiles('1067-1170'), missiles('3378-3390')]),
    step('damage', 'The add argument is already an internal-unit value; PlayerMHit applies the 64-unit minimum to each landed check.', 'max(_midam + playerGetHit, 64)', [monster('2469-2474'), missiles('1150-1170')]),
    step('missile', 'The stationary Lightning segment persists for its duration; actor hits restore rather than consume duration.', undefined, [missiles('2008-2024'), missiles('3378-3390')]),
    step('recover', 'The enclosing normal melee animation recovers independently.', '(frames[6][Attack] - 1) * rate[6][Attack]', [monster('1290-1295')]),
  ],
  refs: [monster('2469-2474'), missiles('2008-2024'), missiles('3378-3390')],
};

const inferno = (id: string, condition: string, decideRef: string): MonsterAttackSequenceSpec => projectile({
  id,
  missile: 'InfernoControl',
  condition,
  decideRef,
  specialAnimation: true,
  channel: 'engine',
  damageFormula: 'Each Inferno child rolls RandomIntBetween(minDamage,maxDamage) but passes isDamageShifted=true, so the value is already 1/64 HP and PlayerMHit floors it to 64',
  collision: 'InfernoControl creates at most three child tiles and stops at blocking terrain; each child persists, rechecks its tile, and restores duration after a hit.',
  refs: [missiles('2672-2700'), missiles('3940-3990')],
});

function acidProjectile(id: string, condition: string, decideRef: string): MonsterAttackSequenceSpec {
  const base = movingProjectile(id, 'Acid', condition, decideRef, true);
  return {
    ...base,
    steps: [
      ...base.steps.slice(0, -1),
      step('special', 'When the Acid impact animation ends it creates AcidPuddle. The puddle repeatedly checks its tile with shifted damage and does not end on actor collision.', 'puddle _midam = monster.data().level >= 2 ? 2 : 1; PlayerMHit floor = 64', [missiles('3048-3060'), missiles('3644-3658')]),
      base.steps[base.steps.length - 1],
    ],
    refs: [...base.refs, missiles('3048-3060'), missiles('3644-3658')],
  };
}

function summon(id: string, missileId: string, condition: string, decideRef: string): MonsterAttackSequenceSpec {
  return {
    id,
    kind: 'summon',
    ...(missileId === 'none' ? {} : { missile: missileId }),
    condition,
    animation: missileId === 'none' ? 'immediate' : 'special',
    damageChannel: 'none',
    steps: [
      step('decide', 'The AI validates its quest/space/capacity branch before starting the summon action.', 'AI summon condition', [decideRef]),
      step('special', missileId === 'none' ? 'The routine enters SpecialStand and creates a skeleton directly.' : `SpecialRangedAttack emits ${missileId}; it carries no direct damage channel.`, undefined, [decideRef]),
      step('missile', missileId === 'none' ? 'No missile is fired.' : `${missileId} resolves placement/spawn behavior rather than player damage.`, undefined, [decideRef, ...(missileId === 'none' ? [] : [missiles('3168-3191')])]),
      step('recover', 'The summon action returns to Stand after its action lifecycle.', undefined, [decideRef]),
    ],
    refs: [decideRef],
  };
}

const ledger = (routine: D1AiRoutineId, refs: readonly string[], sequences: readonly MonsterAttackSequenceSpec[]): MonsterAttackLedgerSpec => ({
  routine,
  steps: sequences.flatMap((sequence) => sequence.steps),
  refs,
  sequences,
});

export const D1_MONSTER_ATTACK_LEDGER_DATA = {
  Zombie: ledger('Zombie', [monster('2069-2097')], [melee('zombie-melee', 'Visible, standing, adjacent, and the action roll succeeds.', monster('2069-2097'))]),
  Fat: ledger('Fat', [monster('2099-2122')], [
    melee('fat-normal-melee', 'Adjacent and the shared roll is in the normal band.', monster('2099-2122')),
    specialMelee('fat-special-melee', 'Adjacent and the shared roll is in the following special band.', monster('2099-2122')),
  ]),
  SkeletonMelee: ledger('SkeletonMelee', [monster('2124-2147')], [melee('skeleton-melee', 'Adjacent successful roll, or the forced action after Delay.', monster('2124-2147'))]),
  SkeletonRanged: ledger('SkeletonRanged', [monster('2149-2178')], [movingProjectile('skeleton-arrow', 'Arrow', 'The independent shot roll succeeds, no retreat began, and the route is line-clear.', monster('2149-2178'))]),
  Scavenger: ledger('Scavenger', [monster('2202-2254'), monster('2124-2147')], [melee('scavenger-melee', 'The healing branch starts no action and inherited Skeleton melee chooses an attack.', monster('2202-2254'))]),
  Rhino: ledger('Rhino', [monster('2256-2312')], [
    charge('rhino-charge', 'At charge range, the roll and traversable-route test succeed.', monster('2256-2312')),
    melee('rhino-melee', 'Adjacent normal-goal attack roll succeeds.', monster('2256-2312')),
  ]),
  GoatMelee: ledger('GoatMelee', [monster('1893-1938')], [
    melee('goat-normal-melee', 'Adjacent attack roll succeeds and the wounded fair bit does not select special.', monster('1893-1938')),
    specialMelee('goat-special-melee', 'Adjacent attack roll succeeds, the monster is below half HP, and the fair bit selects special.', monster('1893-1938')),
  ]),
  GoatRanged: ledger('GoatRanged', [monster('1976-2011')], [movingProjectile('goat-arrow', 'Arrow', 'Still standing after retreat logic and line-clear.', monster('1976-2011'))]),
  Fallen: ledger('Fallen', [monster('2314-2372'), monster('2124-2147')], [melee('fallen-melee', 'Inherited Skeleton attack or forced adjacent Attack-goal action.', monster('2314-2372'))]),
  Magma: ledger('Magma', [monster('2013-2067')], [
    movingProjectile('magma-ball', 'MagmaBall', 'The ranged-avoidance shot band succeeds with a clear moving-missile line.', monster('2013-2067'), true),
    melee('magma-melee', 'The adjacent melee band succeeds.', monster('2013-2067')),
    extraSwing('Magma', 8, 10, -2),
  ]),
  SkeletonKing: ledger('SkeletonKing', [monster('2374-2430')], [
    summon('skeleton-king-summon', 'none', 'Multiplayer quests are disabled and the summon roll, tile, capacity, and type checks pass.', monster('2374-2430')),
    melee('skeleton-king-melee', 'The summon branch does not take the action and the adjacent melee roll succeeds.', monster('2374-2430')),
  ]),
  Bat: ledger('Bat', [monster('2432-2478')], [
    melee('bat-melee', 'Adjacent attack roll succeeds.', monster('2432-2478')),
    charge('gloom-charge', 'The subtype is Gloom, at charge range, with a clear route.', monster('2432-2478')),
    familiarLightning,
  ]),
  Gargoyle: ledger('Gargoyle', [monster('2480-2507'), monster('1893-1938')], [melee('gargoyle-melee', 'Awake normal combat inherits GoatMelee and selects normal attack.', monster('2480-2507'))]),
  Butcher: ledger('Butcher', [monster('2509-2524')], [melee('butcher-melee', 'Alert, standing, and adjacent.', monster('2509-2524'))]),
  Succubus: ledger('Succubus', [monster('1976-2011')], [movingProjectile('succubus-blood-star', 'BloodStar', 'Fully alert or monster-targeting, still standing, and line-clear.', monster('1976-2011'))]),
  Sneak: ledger('Sneak', [monster('2526-2576')], [melee('sneak-melee', 'Visible, Normal goal, adjacent, and the attack roll succeeds.', monster('2526-2576'))]),
  Storm: ledger('Storm', [monster('2013-2067')], [
    projectile({
      id: 'storm-thin-lightning', missile: 'ThinLightningControl', condition: 'The ranged-avoidance shot band succeeds with a clear line.', decideRef: monster('2013-2067'), specialAnimation: true, channel: 'engine',
      damageFormula: 'Each spawned Lightning segment uses 2*RandomIntBetween(minDamage,maxDamage) as already-shifted 1/64-HP damage; every landed check is floored to 64',
      collision: 'The control lays Lightning segments; each segment persists and rechecks, and actor hits restore rather than consume duration.', refs: [missiles('1999-2024'), missiles('3359-3390')],
    }),
    melee('storm-melee', 'The adjacent melee band succeeds.', monster('2013-2067')),
    extraSwing('Storm', 12, -20, 4),
  ]),
  Gharbad: ledger('Gharbad', [monster('2578-2628'), monster('1893-1938')], [
    melee('gharbad-normal-melee', 'The quest has released combat and inherited GoatMelee selects normal attack.', monster('2578-2628')),
    specialMelee('gharbad-special-melee', 'The quest has released combat and inherited wounded GoatMelee selects special.', monster('2578-2628')),
  ]),
  Acid: ledger('Acid', [monster('2013-2067')], [
    acidProjectile('acid-projectile', 'The halved ranged-avoidance shot band succeeds with a clear line.', monster('2013-2067')),
    melee('acid-melee', 'The adjacent melee band succeeds.', monster('2013-2067')),
  ]),
  AcidUnique: ledger('AcidUnique', [monster('1976-2011')], [acidProjectile('acid-unique-projectile', 'Still standing after retreat logic and line-clear; uses Special animation.', monster('1976-2011'))]),
  Golem: ledger('Golem', [monster('4157-4217')], [melee('golem-melee', 'A monster target is inside the attack box.', monster('4157-4217'))]),
  Zhar: ledger('Zhar', [monster('2786-2816'), monster('2724-2784')], [counselorProjectile('Zhar', monster('2724-2784')), flash('Zhar', monster('2724-2784'))]),
  Snotspill: ledger('Snotspill', [monster('2630-2667'), monster('2314-2372')], [melee('snotspill-melee', 'The quest has released combat, the tile is visible, and inherited Fallen chooses melee.', monster('2630-2667'))]),
  Snake: ledger('Snake', [monster('2669-2722')], [
    charge('snake-charge', 'Exactly charge distance away, clear route, and previous mode was not Charge.', monster('2669-2722')),
    melee('snake-melee', 'Adjacent successful roll or forced action after Delay/Charge.', monster('2669-2722')),
  ]),
  Counselor: ledger('Counselor', [monster('2724-2784')], [counselorProjectile('Counselor', monster('2724-2784')), flash('Counselor', monster('2724-2784'))]),
  Mega: ledger('Mega', [monster('2818-2877')], [
    inferno('mega-inferno', 'The close-range line-clear spell band or forced-cast marker succeeds, including half of successful adjacent actions.', monster('2818-2877')),
    melee('mega-melee', 'The other half of a successful adjacent action selects melee.', monster('2818-2877')),
  ]),
  Diablo: ledger('Diablo', [monster('2013-2067')], [
    projectile({
      id: 'diablo-apocalypse', missile: 'DiabloApocalypse', condition: 'The ranged-avoidance shot band succeeds with a clear line.', decideRef: monster('2013-2067'), specialAnimation: true, channel: 'engine',
      damageFormula: 'The AI supplies the engine damage argument to DiabloApocalypse; each ApocalypseBoom collision uses that stored value with isDamageShifted=false',
      collision: 'The controller creates ApocalypseBoom impacts; each boom stops damaging after its first successful hit but its animation persists.', refs: [missiles('3726-3735'), missiles('3853-3876')],
    }),
    melee('diablo-melee', 'The adjacent melee band succeeds.', monster('2013-2067')),
  ]),
  Lazarus: ledger('Lazarus', [monster('2879-2926'), monster('2724-2784')], [counselorProjectile('Lazarus', monster('2724-2784')), flash('Lazarus', monster('2724-2784'))]),
  LazarusSuccubus: ledger('LazarusSuccubus', [monster('2928-2951'), monster('1976-2011')], [movingProjectile('lazarus-succubus-blood-star', 'BloodStar', 'The quest gate is released, goal is Normal, still standing, and line-clear.', monster('2928-2951'))]),
  Warlord: ledger('Warlord', [monster('2984-3007'), monster('2124-2147')], [melee('warlord-melee', 'The quest gate is released and inherited Skeleton melee succeeds or is forced after Delay.', monster('2984-3007'))]),
  HorkDemon: ledger('HorkDemon', [monster('3009-3064')], [
    summon('hork-spawn', 'HorkSpawn', 'The spawn roll succeeds and front tile/capacity are available.', monster('3009-3064')),
    melee('hork-demon-melee', 'Adjacent attack roll succeeds.', monster('3009-3064')),
  ]),
} as const satisfies Partial<Record<D1AiRoutineId, MonsterAttackLedgerSpec>>;
