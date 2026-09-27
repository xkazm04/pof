/** Engine-derived Diablo I missile behaviours. No misdat.tsv row values are stored here. */
import type { ProjectRule } from '@/lib/catalog/canon/types';
import type { MissileBehaviourSpecData, MissileSpawn } from '@/lib/catalog/reference/missileSpecs';

const source = (line: number): string => `.reference/devilutionX/Source/missiles.cpp:${line}`;
const refs = (addLine: number, processLine?: number): string[] =>
  processLine == null ? [source(addLine)] : [source(addLine), source(processLine)];

const spec = (
  addFn: string | null,
  processFn: string | null,
  missileIds: readonly string[],
  movement: string,
  speed: string,
  lifetime: string,
  collision: string,
  damageSource: string,
  engineRefs: readonly string[],
): MissileBehaviourSpecData => ({
  addFn, processFn, missileIds, movement, speed, lifetime, collision, damageSource,
  refs: engineRefs,
});

const genericCollision = 'Checks actors and terrain along its path; table blockability decides whether an actor hit stops flight.';
const fixedMidam = 'Uses _midam supplied by the caller or computed by the add function; collision applies that same value.';

export const MISSILE_BEHAVIOUR_SPECS_DATA = [
  spec(null, null, ['ChainBall', 'BloodHit', 'BoneHit', 'MetalHit', 'DoomSerpents', 'FireOnly', 'BloodRitual', 'Invisibility', 'Etherealize', 'Spurt', 'FireMan', 'Krull'],
    'No runtime behaviour: the dispatch pair is null.', 'None.', 'No managed lifetime.', 'No add/process collision path.', 'None.',
    ['.reference/devilutionX/Source/tables/spelldat.h:98']),
  spec('AddArrow', 'ProcessArrow', ['Arrow'], 'Straight 16-direction projectile.', '32; player arrows add class/level and item-speed adjustments, or may randomize to 16..47.', '256 ticks maximum.', 'Actor or blocking-tile collision stops the blockable arrow; it does not pierce.', 'Player weapon physical bounds, monster ordinary bounds, or dungeon-level trap bounds.', refs(1779, 2945)),
  spec('AddElementalArrow', 'ProcessElementalArrow', ['FireArrow', 'LightningArrow'], 'Straight 16-direction arrow, followed by a stationary elemental impact.', '32 plus player class/level and attack-speed adjustments.', '256 flight ticks, then impact animation length minus 1.', 'Physical arrow hit stops flight; impact checks the terminal tile once for fire or lightning damage.', 'Physical weapon/monster/trap bounds in flight; matching player elemental item bounds or trap bounds on impact.', refs(1742, 2861)),
  spec('AddFirebolt', 'ProcessGenericProjectile', ['Firebolt'], 'Straight projectile with a visual explosion on termination.', '26 for monsters; players use 16+min(2*spellLevel,47); traps use 26.', '256 flight ticks; visual explosion uses its animation length.', genericCollision, 'Caller damage, otherwise player Magic/8+spell level+1..10, monster projectile damage, or trap damage.', refs(1867, 2976)),
  spec('AddMagmaBall', 'ProcessGenericProjectile', ['MagmaBall'], 'Straight projectile advanced three velocity steps at creation.', '16.', '256 ticks, except a Hellfire zero-integer-velocity guard uses 1.', genericCollision, 'Caller damage, otherwise monster projectile damage or trap damage; players normally do not create it.', refs(1903, 2976)),
  spec('AddGenericMagicMissile', 'ProcessGenericProjectile', ['BloodStar'], 'Straight projectile with source-specific sprite and visual explosion.', '16.', '256 flight ticks; visual explosion uses its animation length.', genericCollision, 'Caller damage, otherwise 3*spellLevel-Magic/8+Magic/2, monster projectile damage, or trap damage.', refs(2284, 2976)),
  spec('AddAcid', 'ProcessGenericProjectile', ['Acid'], 'Straight projectile ending in an acid splat and puddle chain.', '16.', '5*(monster intelligence+4), or 1 for the Hellfire zero-integer-velocity guard.', genericCollision, 'Caller damage, otherwise monster projectile damage or trap damage.', refs(2328, 2976)),
  spec('AddPhasing', 'ProcessTeleport', ['Phasing'], 'Instant relocation to a random legal tile in the outer part of a 13x13 square.', 'No velocity.', '2 ticks.', 'Placement checks player-valid tiles; it neither hits actors nor deals damage.', 'None.', refs(1829, 3661)),
  spec('AddTeleport', 'ProcessTeleport', ['Teleport'], 'Relocation to the closest legal position within radius 5 of the requested target.', 'No velocity.', '2 ticks on success; deleted immediately on placement failure.', 'Placement checks player-valid tiles; it neither hits actors nor deals damage.', 'None.', refs(1931, 3661)),
  spec('AddNovaBall', 'ProcessNovaBall', ['NovaBall'], 'One straight ray in a nova ring; actors do not consume its remaining lifetime.', '16.', '255 ticks maximum.', 'Passes through actors, but blocking terrain ends it.', fixedMidam, refs(1951, 3028)),
  spec('AddNova', 'ProcessNova', ['Nova'], 'One-tick stationary controller emits 36 rays toward radius-4 offsets.', 'Controller stationary; children use 16.', '1 controller tick; child lifetime belongs to NovaBall.', 'Controller has no collision; emitted balls use their own collision rule.', 'Computes spell-scaled player nova damage or dungeon-scaled trap damage and passes it to every ball.', refs(2572, 3314)),
  spec('AddFireWall', 'ProcessFireWall', ['FireWall'], 'Stationary damaging wall segment.', 'Velocity 16 is initialized for orientation/placement; the segment stays on its tile.', '16*10*(spellLevel+1) for positive levels, with monster/trap dungeon-level adjustment.', 'Repeatedly checks its tile; persists after hits.', 'Two 0..9 rolls +2 + character or dungeon level, stored at eight fixed units per HP.', refs(1961, 3065)),
  spec('AddWallControl', 'ProcessWallControl', ['FireWallControl'], 'Stationary controller grows a wall left and right around the selected center.', 'No projectile velocity.', '7 ticks.', 'Stops each growth side independently when placement is blocked; controller does not damage.', 'Fire-wall children compute their own damage.', refs(2535, 3775)),
  spec('AddFireball', 'ProcessFireball', ['Fireball'], 'Straight projectile followed by a stationary 3x3 explosion.', '16; player-owned casts add min(2*spellLevel,34).', '256 flight ticks; explosion lasts animation length minus 1.', 'First actor or blocking tile ends blockable flight; the blast checks line-visible cells in a 3x3 area.', 'Player spell formula set at add; monster source uses ordinary monster damage bounds.', refs(1977, 3099)),
  spec('AddLightningControl', 'ProcessLightningControl', ['LightningControl', 'ThinLightningControl'], 'Straight controller lays stationary lightning segments along its route.', '32.', '256 ticks maximum; terrain can end it.', 'Controller stops at missile-blocking terrain; segments repeatedly check actors on their tile.', 'Each controller tick derives player spell, monster ordinary, or trap dungeon damage and passes it to segments.', refs(1999, 3359)),
  spec('AddLightning', 'ProcessLightning', ['Lightning', 'ThinLightning'], 'Stationary segment created along a lightning controller path.', 'No independent velocity.', 'Player segment floor(spellLevel/2)+6; monster/trap segment 8 or 10.', 'Repeatedly checks its tile and persists after hits.', fixedMidam, refs(2008, 3378)),
  spec('AddMissileExplosion', 'ProcessMissileExplosion', ['MagmaBallExplosion', 'BloodStarExplosion'], 'Stationary visual explosion copied from its parent position.', 'No velocity.', 'Animation length.', 'No collision in this process function.', 'None; visual only.', refs(2027, 3626)),
  spec('AddMissileExplosion', 'ProcessAcidSplate', ['AcidSplat'], 'Stationary acid impact that creates a puddle when its animation ends.', 'No velocity.', 'Animation length.', 'Splat does not hit; its child puddle performs repeated collision checks.', 'Creates puddle damage of 1 or 2 from monster level.', refs(2027, 3644)),
  spec('AddAcidPuddle', 'ProcessAcidPuddle', ['AcidPuddle'], 'Stationary damaging puddle.', 'No velocity.', 'random(15)+40*(monster intelligence+1), then an ending animation.', 'Repeatedly checks its tile and persists after hits.', 'Uses _midam supplied by AcidSplat.', refs(2355, 3048)),
  spec('AddWeaponExplosion', 'ProcessWeaponExplosion', ['WeaponExplosion'], 'Stationary immediate weapon-proc explosion.', 'No velocity.', 'Selected impact animation length minus 1.', 'Checks the creation tile once; no piercing or movement.', 'Uses caller _midam as fire or lightning damage.', refs(2057, 3606)),
  spec('AddTownPortal', 'ProcessTownPortal', ['TownPortal'], 'Stationary portal; replaces an earlier portal from the same source.', 'No velocity.', 'Counts from 100 to 1, then persists.', 'Placement rejects occupied, object, missile, solid, blocked, and trigger tiles; standing on it changes level.', 'None.', refs(2073, 3393)),
  spec('AddRedPortal', 'ProcessRedPortal', ['RedPortal'], 'Stationary visual portal.', 'No velocity.', 'Counts from 100 to 1, then persists until externally removed.', 'No actor damage; this process function only animates and lights it.', 'None.', refs(2786, 4175)),
  spec('AddFlashBottom', 'ProcessFlashBottom', ['FlashBottom'], 'Stationary six-tile portion of a 3x3 flash.', 'No velocity.', '19 ticks.', 'Checks six cells every tick and persists after hits.', 'Player spell-scaled roll, twice monster level, or half dungeon level.', refs(2125, 3425)),
  spec('AddFlashTop', 'ProcessFlashTop', ['FlashTop'], 'Stationary three-tile portion of a 3x3 flash.', 'No velocity.', '19 ticks.', 'Checks three cells every tick and persists after hits.', 'Player spell-scaled roll or half dungeon level for a trap; otherwise caller value.', refs(2145, 3454)),
  spec('AddManaShield', null, ['ManaShield'], 'Immediate player-state operation.', 'No velocity.', 'Deleted during add; shield lifetime is owned by player state.', 'No collision.', 'None; redirects later damage through player state.', refs(2161)),
  spec('AddFlameWave', 'ProcessFlameWave', ['FlameWave'], 'Straight moving wall segment that passes through actors.', '16.', '255 ticks maximum.', 'Actor hits do not end it; blocking terrain does.', 'Character level +1..10.', refs(2177, 3480)),
  spec('AddFlameWaveControl', 'ProcessFlameWaveControl', ['FlameWaveControl'], 'One-tick controller creates a transverse moving wave with level-scaled width.', 'No velocity.', '1 tick.', 'Placement stops each side at blocked wall cells; controller does not hit.', 'Children compute character-level damage.', refs(2564, 3878)),
  spec('AddGuardian', 'ProcessGuardian', ['Guardian'], 'Stationary turret scans a radius-6 arc and fires at most one bolt every 16 ticks.', 'No movement; child Firebolt speed follows its own behaviour.', 'max(30,16*min(spellLevel+characterLevel/2,30)).', 'Placement requires an unoccupied line-clear tile; turret itself does not collide.', 'Each shot is spell-scaled from characterLevel/2 +1..10.', refs(2188, 3514)),
  spec('AddChainLightning', 'ProcessChainLightning', ['ChainLightning'], 'One-tick stationary controller emits one path to the target and paths to monsters in a level-scaled radius.', 'No movement; child controllers use 32.', '1 tick.', 'Controller has no collision; emitted lightning uses controller/segment rules.', 'Passes a marker value; LightningControl derives damage per path.', refs(2236, 3585)),
  spec('AddRhino', 'ProcessRhino', ['Rhino'], 'Moves the source monster as a charge projectile.', '18; snake processing samples two velocity steps ahead.', 'Up to 256 ticks while the monster remains in Charge mode.', 'Stops when destination tiles are unavailable or snake animation ends; impact is resolved by monster charge logic.', 'Monster charge/melee logic, not _midam collision damage.', refs(2264, 3738)),
  spec('AddStoneCurse', 'ProcessStoneCurse', ['StoneCurse'], 'Stationary state owner attached to a petrified monster.', 'No velocity.', '16*min(spellLevel+6,15), or 11 shatter ticks after death.', 'Selects an eligible monster within radius 5; no damage collision.', 'None; changes and later restores monster mode.', refs(2363, 3698)),
  spec('AddGolem', null, ['Golem'], 'Immediate summon or dismissal operation.', 'No velocity.', 'Deleted during add; summoned monster owns its lifetime.', 'Finds an unoccupied line-clear tile within radius 5; no missile collision.', 'Summoned monster stats derive from spell level and player mana elsewhere.', refs(2418)),
  spec('AddApocalypseBoom', 'ProcessApocalypseBoom', ['ApocalypseBoom', 'DiabloApocalypseBoom'], 'Stationary targeted explosion.', 'No velocity.', 'Animation length.', 'Checks its tile until its first successful hit, then only finishes animation.', fixedMidam, refs(2455, 3726)),
  spec('AddApocalypse', 'ProcessApocalypse', ['Apocalypse'], 'Stationary scanner emits one boom per tick over a clipped 16x16 area.', 'No velocity.', 'Until the scan exhausts eligible monsters; initialized to 255.', 'Skips minions and solid tiles; vanilla does not require line of sight.', 'Sum of character-level rolls from 1 through 6, passed to each boom.', refs(2657, 3853)),
  spec('AddDiabloApocalypse', null, ['DiabloApocalypse'], 'Immediate fan-out: creates one boom on every line-clear active player.', 'No velocity.', 'Deleted during add.', 'Line of sight gates targets; each child boom handles its hit.', 'Caller-provided _midam, passed to every boom.', refs(2793)),
  spec('AddHealing', null, ['Healing'], 'Immediate self-heal operation.', 'No velocity.', 'Deleted during add.', 'No collision.', 'Healing roll from character level and spell level, with class multiplier; capped at maximum HP.', refs(2462)),
  spec('AddHealOther', null, ['HealOther'], 'Immediate cursor-mode operation.', 'No velocity.', 'Deleted during add.', 'No missile collision; later cursor action selects the player.', 'Healing is applied by the later cursor action.', refs(2484)),
  spec('AddElemental', 'ProcessElemental', ['Elemental'], 'Straight projectile, one retarget within radius 19, then a stationary 3x3 explosion.', '16 before and after retarget.', '256 initial ticks, 255 after retarget, then explosion animation minus 1.', 'Unblockable flight can hit once before retarget; explosion repeatedly checks line-visible 3x3 cells.', 'Half the player Fireball spell calculation, fixed into _midam.', refs(2496, 4061)),
  spec('AddIdentify', null, ['Identify'], 'Immediate inventory-cursor operation.', 'No velocity.', 'Deleted during add.', 'No collision.', 'None.', refs(2518)),
  spec('AddInfravision', 'ProcessInfravision', ['Infravision'], 'Stationary player-state timer.', 'No velocity.', 'ScaleSpellEffect(1584,spellLevel).', 'No collision.', 'None; maintains the infravision flag.', refs(2559, 3842)),
  spec('AddRage', 'ProcessRage', ['Rage'], 'Stationary two-phase player-state timer.', 'No velocity.', '245+2*characterLevel for active phase, then the same cooldown.', 'No collision.', 'Final penalty applies 6*characterLevel physical damage after state recalculation.', refs(2588, 3909)),
  spec('AddItemRepair', null, ['ItemRepair'], 'Immediate inventory-cursor operation.', 'No velocity.', 'Deleted during add.', 'No collision.', 'None in missile code; item repair executes later.', refs(2607)),
  spec('AddStaffRecharge', null, ['StaffRecharge'], 'Immediate inventory-cursor operation.', 'No velocity.', 'Deleted during add.', 'No collision.', 'None in missile code; staff recharge executes later.', refs(2624)),
  spec('AddTrapDisarm', null, ['TrapDisarm'], 'Immediate object-cursor operation.', 'No velocity.', 'Deleted during add.', 'No collision.', 'None in missile code; object operation resolves success later.', refs(2641)),
  spec('AddInferno', 'ProcessInferno', ['Inferno'], 'Stationary segment laid by an aimed controller.', 'No independent velocity.', '20+5*segmentIndex ticks.', 'Repeatedly checks its tile and persists after hits.', 'Player: fixed-point 16+12*(R(characterLevel)+R(2)); monster: ordinary inclusive damage roll.', refs(2672, 3940)),
  spec('AddInfernoControl', 'ProcessInfernoControl', ['InfernoControl'], 'Straight controller lays at most three consecutive stationary segments.', '32.', '256 ticks maximum, but ends after three segments or blocking terrain.', 'Controller stops at missile-blocking terrain; segments perform actor collision.', 'Segments derive player or monster damage in AddInferno.', refs(2690, 3964)),
  spec('AddChargedBolt', 'ProcessChargedBolt', ['ChargedBolt'], 'Wobbling projectile, recalculating direction every 16 ticks.', '8.', '256 flight ticks, then impact animation length.', 'First successful actor hit or blocking terrain stops flight; it does not pierce.', 'Player 1..max(1,Magic/4); non-player constant 15.', refs(2702, 3992)),
  spec('AddHolyBolt', 'ProcessHolyBolt', ['HolyBolt'], 'Straight projectile followed by a visual impact.', '16+min(2*spellLevel,47), except traps use 16.', '256 flight ticks, then impact animation length minus 1.', 'Stops on first eligible actor hit or blocking terrain; it does not pierce.', 'Character level +9..18.', refs(2720, 4033)),
  spec('AddResurrect', null, ['Resurrect'], 'Immediate player-selection cursor operation.', 'No velocity.', 'Deleted during add.', 'No collision.', 'None in missile code; resurrection executes after target selection.', refs(2742)),
  spec('AddResurrectBeam', 'ProcessResurrectBeam', ['ResurrectBeam'], 'Stationary visual beam at the target.', 'No velocity.', 'Resurrect sprite animation length.', 'No collision.', 'None; visual only.', refs(2754, 4167)),
  spec('AddTelekinesis', null, ['Telekinesis'], 'Immediate remote-interaction cursor operation.', 'No velocity.', 'Deleted during add.', 'No collision.', 'None; later interaction may knock back but does not damage.', refs(2761)),
  spec('AddBoneSpirit', 'ProcessBoneSpirit', ['BoneSpirit'], 'Straight projectile, one retarget within radius 19, then a seven-tick fade.', '16 before and after retarget.', '256 initial ticks, 255 after retarget, then 7 fade ticks.', 'Blockable and non-piercing; stops on the first successful target hit or terrain.', 'At retarget, _midam becomes target current internal HP shifted right 7; hit logic recomputes the one-third effect.', refs(2770, 4123)),
] as const satisfies readonly MissileBehaviourSpecData[];

const spawn = (
  parent: string,
  child: string,
  when: MissileSpawn['when'],
  ...engineRefs: string[]
): MissileSpawn => ({ parent, child, when, refs: engineRefs });

/** AddMissile calls made by missile add/process paths in the pinned engine. */
export const MISSILE_SPAWNS_DATA = [
  spawn('Guardian', 'Firebolt', 'per tick', source(735), source(3514)),
  spawn('LightningControl', 'Lightning', 'per tick', source(835), source(3359)),
  spawn('LightningControl', 'ThinLightning', 'per tick', source(835), source(3359)),
  spawn('ThinLightningControl', 'Lightning', 'per tick', source(835), source(3359)),
  spawn('ThinLightningControl', 'ThinLightning', 'per tick', source(835), source(3359)),
  spawn('OpenNest', 'BigExplosion', 'on cast', source(1245), source(1249)),
  spawn('RuneOfFire', 'BigExplosion', 'on hit', source(1255), source(3205)),
  spawn('RuneOfLight', 'LightningWall', 'on hit', source(1260), source(3205)),
  spawn('RuneOfNova', 'Nova', 'on hit', source(1268), source(3205)),
  spawn('RuneOfImmolation', 'Immolation', 'on hit', source(1273), source(3205)),
  spawn('RuneOfStone', 'StoneCurse', 'on hit', source(1278), source(3205)),
  ...['Firebolt', 'Fireball', 'FireWallControl', 'Guardian', 'ChainLightning', 'TownPortal', 'Teleport', 'Apocalypse', 'StoneCurse']
    .map((child) => spawn('Jester', child, 'on cast', source(1359), source(1392))),
  spawn('DiabloApocalypse', 'DiabloApocalypseBoom', 'on cast', source(2793), source(2801)),
  spawn('Firebolt', 'MagmaBallExplosion', 'on expiry', source(2976), source(2988)),
  spawn('MagmaBall', 'MagmaBallExplosion', 'on expiry', source(2976), source(2988)),
  spawn('BloodStar', 'BloodStarExplosion', 'on expiry', source(2976), source(2991)),
  spawn('Acid', 'AcidSplat', 'on expiry', source(2976), source(2994)),
  spawn('OrangeFlare', 'OrangeExplosion', 'on expiry', source(2976), source(2997)),
  spawn('BlueFlare', 'BlueExplosion', 'on expiry', source(2976), source(3000)),
  spawn('RedFlare', 'RedExplosion', 'on expiry', source(2976), source(3003)),
  spawn('YellowFlare', 'YellowExplosion', 'on expiry', source(2976), source(3006)),
  spawn('BlueFlare2', 'BlueExplosion2', 'on expiry', source(2976), source(3009)),
  spawn('RingOfFire', 'FireWall', 'on cast', source(3241), source(3266)),
  spawn('Immolation', 'FireballBow', 'per tick', source(3309), source(3302)),
  spawn('Nova', 'NovaBall', 'per tick', source(3314), source(3302)),
  ...['Arrow', 'FireballBow', 'LightningBow', 'HolyBoltBow']
    .map((child) => spawn('SpectralArrow', child, 'per tick', source(3319), source(3349))),
  spawn('SpectralArrow', 'ChargedBoltBow', 'per tick', source(3319), source(3349), source(3351), source(3352)),
  spawn('ChainLightning', 'LightningControl', 'per tick', source(3585), source(3591), source(3597)),
  spawn('AcidSplat', 'AcidPuddle', 'on expiry', source(3644), source(3655)),
  spawn('FireWallControl', 'FireWall', 'per tick', source(755), source(3775), source(3790)),
  spawn('LightningWallControl', 'LightningWall', 'per tick', source(755), source(3775), source(3793)),
  spawn('Apocalypse', 'ApocalypseBoom', 'per tick', source(3853), source(3868)),
  spawn('FlameWaveControl', 'FlameWave', 'per tick', source(755), source(3878), source(3886)),
  spawn('InfernoControl', 'Inferno', 'per tick', source(3964), source(3971)),
] as const satisfies readonly MissileSpawn[];

export const MISSILE_SPAWNS = MISSILE_SPAWNS_DATA;

export const UNREACHABLE_MISSILE_REASON_REFS = {
  ChainBall: ['.reference/devilutionX/Source/tables/spelldat.h:116'],
  BloodHit: ['.reference/devilutionX/Source/tables/spelldat.h:117'],
  BoneHit: ['.reference/devilutionX/Source/tables/spelldat.h:118'],
  MetalHit: ['.reference/devilutionX/Source/tables/spelldat.h:119'],
  DoomSerpents: ['.reference/devilutionX/Source/tables/spelldat.h:128'],
  FireOnly: ['.reference/devilutionX/Source/tables/spelldat.h:129'],
  BloodRitual: ['.reference/devilutionX/Source/tables/spelldat.h:131'],
  Invisibility: ['.reference/devilutionX/Source/tables/spelldat.h:132'],
  Spurt: ['.reference/devilutionX/Source/tables/spelldat.h:135'],
  FireMan: ['.reference/devilutionX/Source/tables/spelldat.h:150'],
  Krull: ['.reference/devilutionX/Source/tables/spelldat.h:151'],
  FireArrow: ['.reference/devilutionX/Source/player.cpp:882', '.reference/devilutionX/Source/objects.cpp:2048'],
  LightningArrow: ['.reference/devilutionX/Source/player.cpp:885'],
  Rage: ['.reference/devilutionX/Source/tables/spelldat.h:143'],
  WeaponExplosion: ['.reference/devilutionX/Source/player.cpp:811'],
  RedPortal: ['.reference/devilutionX/Source/quests.cpp:159'],
} as const;

export const UNREACHABLE_MISSILE_REASONS_DATA = {
  ChainBall: 'Unused enum: the pinned MissileID declaration marks it unused and its dispatch functions are null.',
  BloodHit: 'Unused enum: the pinned MissileID declaration marks it unused and its dispatch functions are null.',
  BoneHit: 'Unused enum: the pinned MissileID declaration marks it unused and its dispatch functions are null.',
  MetalHit: 'Unused enum: the pinned MissileID declaration marks it unused and its dispatch functions are null.',
  DoomSerpents: 'Unused enum: the pinned MissileID declaration marks it unused and its dispatch functions are null.',
  FireOnly: 'Unused enum: the pinned MissileID declaration marks it unused and its dispatch functions are null.',
  BloodRitual: 'Unused enum: the pinned MissileID declaration marks it unused and its dispatch functions are null.',
  Invisibility: 'Unused enum: the pinned MissileID declaration marks it unused and its dispatch functions are null.',
  Spurt: 'Unused enum: the pinned MissileID declaration marks it unused and its dispatch functions are null.',
  FireMan: 'Unused enum: the pinned MissileID declaration marks it unused and its dispatch functions are null.',
  Krull: 'Unused enum: the pinned MissileID declaration marks it unused and its dispatch functions are null.',
  FireArrow: 'Dead in the spell/monster ownership graph; vanilla creates it only from player and trap attack code.',
  LightningArrow: 'Dead in the spell/monster ownership graph; vanilla creates it only from player attack code.',
  Rage: 'Hellfire-only: the pinned spell data reuses the vanilla BloodBoil enum slot for the Rage missile.',
  WeaponExplosion: 'Dead in the spell/monster ownership graph; vanilla creates it only from player weapon-proc code.',
  RedPortal: 'Dead in the spell/monster ownership graph; vanilla creates it only from quest code.',
} as const;

interface MissileLawData {
  id: string;
  title: string;
  body: string;
  refs: readonly string[];
}

const MISSILE_LAW_DATA: readonly MissileLawData[] = [{
  id: 'd1-missile-movement-distribution-law',
  title: 'Missile movement distribution law (engine-derived)',
  body: 'Missile movement distribution, derived from the engine: Disabled means no movement distribution is calculated and normally denotes a stationary effect. Blockable moving missiles stop after an actor hit; Unblockable moving missiles continue through actor hits. Blocking terrain can still end either moving kind when its process routine checks terrain.',
  refs: ['.reference/devilutionX/Source/tables/misdat.h:101', '.reference/devilutionX/Source/missiles.cpp:643'],
}];

export const DIABLO1_MISSILE_LAWS: readonly ProjectRule[] = MISSILE_LAW_DATA.map((law) => ({
  ...law,
  profile: 'diablo1',
  category: 'game',
  scope: 'vfx',
  refs: [...law.refs],
}));

