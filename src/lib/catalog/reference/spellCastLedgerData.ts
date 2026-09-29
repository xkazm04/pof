/** Pin-verified per-spell cast ledgers. This data module imports only its public types. */
import type {
  SpellCastBranch,
  SpellCastLedger,
  SpellCastManaRule,
  SpellCastSourceRule,
  SpellCastStep,
} from '@/lib/catalog/reference/spellCastLedger';

const spells = (lines: string): string => `.reference/devilutionX/Source/spells.cpp:${lines}`;
const missiles = (lines: string): string => `.reference/devilutionX/Source/missiles.cpp:${lines}`;
const player = (lines: string): string => `.reference/devilutionX/Source/player.cpp:${lines}`;
const inventory = (lines: string): string => `.reference/devilutionX/Source/inv.cpp:${lines}`;

const StandardMana = 'max(minMana,D(nonnegative(B-levelsAboveFirst(S)*manaAdj)))';
const FireboltMana = 'max(minMana,D(nonnegative(B-trunc(levelsAboveFirst(S)*manaAdj/2))))';
const HealingMana = 'max(minMana,D(nonnegative(healingBaseMana+2*C-levelsAboveFirst(S)*manaAdj)))';
const ResurrectMana = 'max(minMana,D(nonnegative(B-levelsAboveFirst(S)*trunc(B/8))))';
const SkillMana = '0 when cast as Skill';

const ManaSymbols = {
  B: 'sManaCost, except its full-pool sentinel means maxManaBaseInternal/64',
  S: 'max(GetSpellLevel(spell),0)',
  C: 'character level',
  manaAdj: 'sManaAdj',
  levelsAboveFirst: 'max(S-1,0)',
  nonnegative: 'max(value,0)',
  D: 'after conversion to internal fixed-point: Hellfire Sorcerer halves; otherwise Rogue, Monk, or Bard subtracts one quarter; other class/mode combinations are unchanged',
  minMana: 'sMinMana floor applied after D',
  healingBaseMana: 'Healing.sManaCost, including for HealOther',
} as const;

const mana = (formula = StandardMana, engineFormula = formula): SpellCastManaRule => ({
  formula,
  engineFormula,
  symbols: ManaSymbols,
  refs: [spells('103-145')],
});

const SourceRules: readonly SpellCastSourceRule[] = [
  {
    source: 'spellbook',
    check: 'The request and StartSpell recheck use CheckSpell: the request needs the hand cursor, then both checks require spell level above zero, enough mana from GetManaAmount, and no ItemSpecialEffect::NoMana.',
    consume: 'After every initial AddMissile succeeds, ConsumeSpell subtracts GetManaAmount from current and base mana and redraws the mana panel.',
    level: 'StartSpell sets executedSpell.spellLevel to GetSpellLevel: learned level plus item spell-level modifiers, clamped nonnegative.',
    refs: [player('248-289'), player('3170-3202'), '.reference/devilutionX/Source/player.h:635-647', spells('103-168')],
  },
  {
    source: 'scroll',
    check: 'The request needs the hand cursor and CanUseScroll; StartSpell calls CanUseScroll again before starting the animation.',
    consume: 'After every initial AddMissile succeeds, ConsumeScroll removes the selected matching scroll or rune, otherwise the first matching inventory or belt item; mana is untouched.',
    level: 'StartSpell still uses GetSpellLevel (learned plus item bonus), which may be zero because Scroll bypasses CheckSpell level gating; that value is passed to AddMissile.',
    refs: [player('248-289'), player('3177-3182'), '.reference/devilutionX/Source/player.h:635-647', inventory('2021-2062'), spells('147-158')],
  },
  {
    source: 'staff',
    check: 'The request needs the hand cursor and a matching charged staff in the left hand; StartSpell checks that staff again.',
    consume: 'After every initial AddMissile succeeds, ConsumeStaffCharge decrements one charge and recalculates inventory effects; mana is untouched.',
    level: 'StartSpell still uses GetSpellLevel (learned plus item bonus), which may be zero because Charges bypasses CheckSpell level gating; that value is passed to AddMissile.',
    refs: [player('248-289'), player('3180-3182'), '.reference/devilutionX/Source/player.h:635-647', inventory('1079-1085'), inventory('2064-2077'), spells('147-158')],
  },
  {
    source: 'skill',
    check: 'The request still needs the hand cursor, but CheckSpell returns success for SpellType::Skill before level and mana checks; the StartSpell recheck also succeeds.',
    consume: 'ConsumeSpell takes no mana, scroll, or charge for SpellType::Skill. Spell-specific health costs after the source switch still apply.',
    level: 'StartSpell sets executedSpell.spellLevel to GetSpellLevel even though Skill bypasses the level gate, then passes it to AddMissile.',
    refs: [player('248-289'), player('3170-3176'), '.reference/devilutionX/Source/player.h:635-647', spells('185-208'), spells('147-176')],
  },
];

const CheckStep = {
  phase: 'check' as const,
  what: 'Input/town gating and source ownership are checked before StartSpell. At the casting action frame DoSpell calls CastSpell; no resource has been consumed yet.',
  branches: [
    {
      condition: 'The request check or the StartSpell source recheck fails.',
      outcome: 'The cast never reaches CastSpell, so no AddMissile side effect or resource consumption occurs.',
      resource: 'free' as const,
      refs: [player('248-272'), player('3140-3202')],
    },
  ],
  refs: [player('248-272'), player('1007-1028'), player('3140-3202'), spells('185-233')],
};

const PoolFizzle: SpellCastBranch = {
  condition: 'Any initial AddMissile returns null because the missile pool is full or its Add* handler sets spellFizzled.',
  outcome: 'CastSpell remembers the fizzle across all initial additions and skips ConsumeSpell; missiles already added by this cast are not rolled back.',
  resource: 'free',
  setsSpellFizzled: true,
  refs: [spells('211-233'), missiles('2806-2858')],
};

const consumeStep = (extra = '') => ({
  phase: 'consume' as const,
  what: `Only after all initial AddMissile calls return non-null does CastSpell call ConsumeSpell. Spellbook mana uses GetManaAmount; scrolls remove one item; staves lose one charge; skills spend none.${extra}`,
  branches: [
    {
      condition: 'At least one initial AddMissile returned null.',
      outcome: 'ConsumeSpell is skipped, including any spell-specific health cost.',
      resource: 'free' as const,
      refs: [spells('211-233')],
    },
    {
      condition: 'Every initial AddMissile returned non-null and the source is Spell, Scroll, or Charges.',
      outcome: 'The corresponding mana, scroll, or staff charge is consumed after Add* side effects have already happened.',
      resource: 'consumed' as const,
      refs: [spells('147-176'), spells('211-233')],
    },
    {
      condition: 'Every initial AddMissile returned non-null and the source is Skill.',
      outcome: 'The cast continues with no mana, scroll, or charge payment.',
      resource: 'none' as const,
      refs: [spells('147-176'), spells('211-233')],
    },
  ],
  refs: [spells('103-176'), spells('211-233'), inventory('2021-2077')],
});

type LedgerSeed = {
  readonly spell: string;
  readonly initial: readonly string[];
  readonly spawned?: readonly string[];
  readonly mana?: SpellCastManaRule;
  readonly duration: string;
  readonly add: string;
  readonly addRefs: readonly string[];
  readonly addBranches?: readonly SpellCastBranch[];
  readonly process: string;
  readonly processRefs: readonly string[];
  readonly hitResult?: string;
  readonly end: string;
  readonly endRefs?: readonly string[];
  readonly consumeExtra?: string;
  readonly poolFizzle?: boolean;
};

function ledger(seed: LedgerSeed): SpellCastLedger {
  const addBranches = [
    ...(seed.poolFizzle === false ? [] : [PoolFizzle]),
    ...(seed.addBranches ?? []),
  ];
  const steps: SpellCastStep[] = [
    CheckStep,
    {
      phase: 'add' as const,
      what: seed.add,
      ...(addBranches.length ? { branches: addBranches } : {}),
      refs: seed.addRefs,
    },
    consumeStep(seed.consumeExtra),
    {
      phase: 'process' as const,
      what: seed.process,
      ...(seed.hitResult ? { hitResult: seed.hitResult } : {}),
      refs: seed.processRefs,
    },
    {
      phase: 'end' as const,
      what: seed.end,
      refs: seed.endRefs ?? [missiles('4197-4246')],
    },
  ];
  return {
    spell: seed.spell,
    expansion: 'diablo',
    initialMissiles: seed.initial,
    spawnedMissiles: seed.spawned ?? [],
    manaCost: seed.mana ?? mana(),
    durationRule: seed.duration,
    sourceRules: SourceRules,
    steps,
    refs: [...new Set([
      ...(seed.mana ?? mana()).refs,
      ...SourceRules.flatMap((rule) => rule.refs),
      ...steps.flatMap((step) => [
        ...step.refs,
        ...(step.branches ?? []).flatMap((branch) => branch.refs),
      ]),
    ])],
  };
}

const mechanicBranch = (
  condition: string,
  outcome: string,
  resource: 'free' | 'consumed',
  setsSpellFizzled: boolean,
  refs: readonly string[],
): SpellCastBranch => ({
  condition, outcome, resource, setsSpellFizzled, sourceDataset: 'spellMechanicsData', refs,
});

export const SPELL_CAST_LEDGER_DATA = [
  ledger({
    spell: 'Firebolt', initial: ['Firebolt'], spawned: ['MagmaBallExplosion'], mana: mana(FireboltMana),
    duration: 'at most 256',
    add: 'AddFirebolt fixes a same-tile aim, computes velocity, damage, light, and a finite flight duration before payment.',
    addRefs: [missiles('1867-1900'), spells('211-233')],
    process: 'ProcessGenericProjectile moves and collision-checks the blockable projectile. A hit, wall, or expiry ends flight and spawns a visual MagmaBallExplosion.',
    processRefs: [missiles('2976-3026')],
    end: 'The projectile is deleted after its first stopping collision or flight expiry; the child explosion is visual only.',
  }),
  ledger({
    spell: 'Healing', initial: ['Healing'], mana: mana(HealingMana), duration: 'immediate',
    add: 'AddHealing rolls and applies capped self-healing, redraws health, and marks the missile for deletion before payment.',
    addRefs: [missiles('2462-2482')],
    process: 'There is no per-tick process function; the complete gameplay effect already occurred in AddHealing.',
    processRefs: [missiles('2462-2482')],
    end: 'DeleteMissiles removes the flagged transient missile.',
  }),
  ledger({
    spell: 'Lightning', initial: ['LightningControl'], spawned: ['Lightning'],
    duration: 'controller at most 256; segment floor(S/2)+6',
    add: 'AddLightningControl initializes a moving controller; it does not create damaging segments until processing after payment.',
    addRefs: [missiles('1999-2006')],
    process: 'ProcessLightningControl advances the path and rolls damage for each newly spawned Lightning segment. Each stationary segment persists, collision-checks every tick, and is deleted on expiry.',
    processRefs: [missiles('3359-3391')], hitResult: 'persists-and-rechecks',
    end: 'The controller ends on blocked travel or expiry; every segment independently ends after its own duration.',
  }),
  ledger({
    spell: 'Flash', initial: ['FlashBottom', 'FlashTop'], duration: '19',
    add: 'CastSpell adds FlashBottom then FlashTop. Each Add* rolls its own damage and initializes a persistent adjacent-area child before the single payment.',
    addRefs: [spells('211-233'), missiles('2125-2159')],
    process: 'The two ProcessFlash* functions cover disjoint nearby offsets, collision-check every tick, temporarily make the caster invincible, and clear invincibility at expiry.',
    processRefs: [missiles('3425-3478')], hitResult: 'persists-and-rechecks',
    end: 'Both children delete at duration zero and clear the temporary invincibility flag.',
  }),
  ledger({
    spell: 'Identify', initial: ['Identify'], duration: 'immediate',
    add: 'AddIdentify marks its missile for deletion and opens the identify inventory cursor for the local player before payment.',
    addRefs: [missiles('2518-2533')],
    process: 'There is no missile process function; selecting an item later performs identification through the cursor workflow.',
    processRefs: [missiles('2518-2533')],
    end: 'DeleteMissiles removes the transient cursor-opening missile.',
  }),
  ledger({
    spell: 'FireWall', initial: ['FireWallControl'], spawned: ['FireWall'],
    duration: '160 when S=0; 160*(S+1) when S>0',
    add: 'AddWallControl searches near the target for a distinct missile-clear, line-clear spread origin and stores the two growth directions.',
    addRefs: [missiles('2535-2557')],
    addBranches: [mechanicBranch(
      'No distinct, missile-clear, line-clear spread tile exists within radius 5.',
      'AddWallControl sets spellFizzled; CastSpell skips payment.', 'free', true, [missiles('2535-2546')],
    )],
    process: 'ProcessWallControl grows a center FireWall and then both sides. Each child rolls damage in AddFireWall, repeatedly checks occupants, changes animation state, and expires independently.',
    processRefs: [missiles('1961-1975'), missiles('3065-3097'), missiles('3775-3840')],
    hitResult: 'persists-and-rechecks',
    end: 'The controller deletes after growth stops or its controller duration ends; wall children delete at their own duration zero.',
  }),
  ledger({
    spell: 'TownPortal', initial: ['TownPortal'], duration: '100 down to 1, then persistent',
    add: 'AddTownPortal places a portal, deactivates an older portal from the same source, and announces a valid dungeon portal before payment.',
    addRefs: [missiles('2073-2123')],
    addBranches: [mechanicBranch(
      'No legal dungeon portal tile exists within radius 5.',
      'The missile is flagged for deletion but AddMissile still returns it, so the cast is paid and creates no portal.',
      'consumed', false, [missiles('2073-2109')],
    )],
    process: 'ProcessTownPortal animates to an idle state, remains at duration one, and warps standing players that occupy its tile.',
    processRefs: [missiles('3393-3423')],
    end: 'A replaced portal receives duration zero and is deleted; an active idle portal otherwise persists.',
  }),
  ledger({
    spell: 'StoneCurse', initial: ['StoneCurse'], duration: '16*min(S+6,15)',
    add: 'AddStoneCurse searches for an eligible monster, petrifies it immediately, and stores its former mode before payment.',
    addRefs: [missiles('2363-2416')],
    addBranches: [
      mechanicBranch(
        'No eligible monster exists within radius 5 of the target.',
        'AddStoneCurse sets spellFizzled; CastSpell skips payment.', 'free', true, [missiles('2363-2392')],
      ),
      mechanicBranch(
        'The selected eligible monster is already petrified.',
        'The missile is flagged for deletion without spellFizzled, so payment still occurs and the effect does not stack.',
        'consumed', false, [missiles('2395-2403')],
      ),
    ],
    process: 'ProcessStoneCurse counts down, follows petrified/death state, restores the former mode on living expiry, or plays a shatter lifecycle for a dead target.',
    processRefs: [missiles('3698-3724')],
    end: 'The controller deletes when petrification ends, the target leaves Petrified mode, or the shatter lifecycle completes.',
  }),
  ledger({
    spell: 'Infravision', initial: ['Infravision'], duration: 'Scale(1584,S)',
    add: 'AddInfravision computes the scaled duration before payment.',
    addRefs: [missiles('2559-2562')],
    process: 'ProcessInfravision asserts the player infravision flag every tick, then deletes and recalculates item values at expiry.',
    processRefs: [missiles('3842-3851')],
    end: 'Expiry removes the missile and lets recalculated item effects determine the remaining infravision state.',
  }),
  ledger({
    spell: 'Phasing', initial: ['Phasing'], duration: '2',
    add: 'AddPhasing selects a legal random tile from the four outer corner regions around the caster and initializes a short teleport missile.',
    addRefs: [missiles('1829-1865')],
    addBranches: [mechanicBranch(
      'No legal tile exists in the four outer corner regions around the caster.',
      'The missile is flagged for deletion without spellFizzled, so payment still occurs and the player does not move.',
      'consumed', false, [missiles('1829-1865')],
    )],
    process: 'ProcessTeleport revalidates near the stored tile on its first tick, moves the player and local view if possible, and otherwise leaves the player in place.',
    processRefs: [missiles('3661-3696')],
    end: 'The two-tick teleport missile deletes on its next tick whether or not movement succeeded.',
  }),
  ledger({
    spell: 'ManaShield', initial: ['ManaShield'], duration: 'until depletion or teardown',
    add: 'AddManaShield flags the transient missile for deletion and enables the player shield immediately before payment.',
    addRefs: [missiles('2161-2175')],
    addBranches: [mechanicBranch(
      'Mana Shield is already active.',
      'AddManaShield sets spellFizzled; CastSpell skips payment and leaves the existing shield active.',
      'free', true, [missiles('2161-2169')],
    )],
    process: 'The missile has no process function. Global ProcessManaShield removes the player flag and synchronizes removal when mana reaches zero.',
    processRefs: [missiles('4202-4209')],
    end: 'The transient missile is deleted immediately; the separate player shield flag persists until depletion or teardown.',
  }),
  ledger({
    spell: 'Fireball', initial: ['Fireball'], duration: 'flight at most 256; explosion BigExplosionAnimLen-1',
    add: 'AddFireball rolls one scaled damage value and initializes a lit, blockable projectile before payment.',
    addRefs: [missiles('1977-1997')],
    process: 'ProcessFireball moves and checks the flight. A stopping hit, wall, or expiry transforms the same missile into a stationary line-visible 3x3 blast with separate collision checks.',
    processRefs: [missiles('3099-3166')], hitResult: 'flight-becomes-one-shot-blast',
    end: 'The transformed BigExplosion deletes when its animation-derived duration reaches zero.',
  }),
  ledger({
    spell: 'Guardian', initial: ['Guardian'], spawned: ['Firebolt', 'MagmaBallExplosion'],
    duration: 'max(30,16*min(S+trunc(C/2),30))',
    add: 'AddGuardian searches for a valid placement, then initializes the turret duration and light before payment.',
    addRefs: [missiles('2188-2234')],
    addBranches: [mechanicBranch(
      'No unoccupied, missile-clear, line-clear placement exists within radius 5.',
      'AddGuardian sets spellFizzled; CastSpell skips payment.', 'free', true, [missiles('2188-2218')],
    )],
    process: 'ProcessGuardian scans its ordered radius-6 arc every firing opportunity and creates at most one Firebolt. Each child follows the ordinary one-hit generic projectile lifecycle.',
    processRefs: [missiles('715-740'), missiles('2976-3026'), missiles('3514-3583')],
    hitResult: 'child-deleted-on-hit',
    end: 'The Guardian deletes and removes its light at duration zero; fired children persist independently.',
  }),
  ledger({
    spell: 'ChainLightning', initial: ['ChainLightning'], spawned: ['LightningControl', 'Lightning'],
    duration: 'chain 1; path at most 256; segment floor(S/2)+6',
    add: 'AddChainLightning stores the selected destination in a one-tick fan-out controller before payment.',
    addRefs: [missiles('2236-2241')],
    process: 'ProcessChainLightning creates one targeted LightningControl plus controls aimed at every covered monster. Controls move and spawn persistent, repeatedly checking Lightning segments.',
    processRefs: [missiles('3359-3391'), missiles('3585-3604')], hitResult: 'persists-and-rechecks',
    end: 'The fan-out controller deletes after one process tick; paths and their segments then expire independently.',
  }),
  ledger({
    spell: 'FlameWave', initial: ['FlameWaveControl'], spawned: ['FlameWave'],
    duration: 'sentinel 255, never decremented; ends on blocking terrain',
    add: 'AddFlameWaveControl stores the aim in a one-tick controller before payment; it creates no damaging wave during Add.',
    addRefs: [missiles('2564-2570')],
    process: 'ProcessFlameWaveControl tries to place a center and lateral wave segments. Each ProcessFlameWave child moves, pierces actor hits by restoring duration, and stops on blocking terrain.',
    processRefs: [missiles('2177-2186'), missiles('3480-3512'), missiles('3878-3907')],
    hitResult: 'persists-without-rechecking-target',
    end: 'The controller always deletes after its one process tick; zero legal first tile yields no child but does not refund payment.',
  }),
  ledger({
    spell: 'DoomSerpents', initial: [], duration: 'immediate',
    add: 'The vanilla spell row supplies no missile, so CastSpell makes no AddMissile call and fizzled remains false.',
    addRefs: [spells('211-233'), '.reference/devilutionX/Source/tables/spelldat.h:48-49'], poolFizzle: false,
    process: 'There is no missile or Process* lifecycle and no gameplay effect.',
    processRefs: [spells('211-233')],
    end: 'CastSpell reaches ConsumeSpell immediately after the empty add loop.',
  }),
  ledger({
    spell: 'BloodRitual', initial: [], duration: 'immediate',
    add: 'The vanilla spell row supplies no missile, so CastSpell makes no AddMissile call and fizzled remains false.',
    addRefs: [spells('211-233'), '.reference/devilutionX/Source/tables/spelldat.h:48-50'], poolFizzle: false,
    process: 'There is no missile or Process* lifecycle and no vanilla gameplay effect; Hellfire slot reuse is outside scope.',
    processRefs: [spells('211-233')],
    end: 'CastSpell reaches ConsumeSpell immediately after the empty add loop.',
  }),
  ledger({
    spell: 'Nova', initial: ['Nova'], spawned: ['NovaBall'],
    duration: 'controller 1; ball at most 255',
    add: 'AddNova rolls one shared scaled damage value and initializes a one-tick controller before payment.',
    addRefs: [missiles('2572-2586')],
    process: 'ProcessNova emits the fixed radial set of NovaBall children. Each ball moves through actors, preserves duration on hits, and ends on terrain or expiry.',
    processRefs: [missiles('3028-3046'), missiles('3285-3317')], hitResult: 'persists-without-rechecking-target',
    end: 'The controller deletes after emitting; each NovaBall deletes on blocked travel or duration zero.',
  }),
  ledger({
    spell: 'Invisibility', initial: [], duration: 'immediate',
    add: 'The vanilla spell row supplies no missile, so CastSpell makes no AddMissile call and fizzled remains false.',
    addRefs: [spells('211-233'), '.reference/devilutionX/Source/tables/spelldat.h:50-52'], poolFizzle: false,
    process: 'There is no missile, Process* lifecycle, invisibility flag, or gameplay effect.',
    processRefs: [spells('211-233')],
    end: 'CastSpell reaches ConsumeSpell immediately after the empty add loop.',
  }),
  ledger({
    spell: 'Inferno', initial: ['InfernoControl'], spawned: ['Inferno'],
    duration: 'segments 20,25,30; controller at most 256',
    add: 'AddInfernoControl initializes an aimed moving controller before payment.',
    addRefs: [missiles('2690-2700')],
    process: 'ProcessInfernoControl creates at most three consecutive children and stops at blocking terrain. Each ProcessInferno child repeatedly checks its tile through its own staged duration.',
    processRefs: [missiles('2672-2688'), missiles('3940-3990')], hitResult: 'persists-and-rechecks',
    end: 'The controller deletes after three child tiles, terrain blockage, or expiry; each child deletes at duration zero.',
  }),
  ledger({
    spell: 'Golem', initial: ['Golem'], duration: 'until killed, recast, or teardown',
    add: 'AddGolem is itself the summon operation: it flags the transient missile for deletion, kills an existing owned Golem on recast, or requests/spawns one at a valid tile before payment.',
    addRefs: [missiles('2418-2453')],
    addBranches: [mechanicBranch(
      'No unoccupied, line-clear summon tile exists within radius 5.',
      'AddGolem returns without spellFizzled, so no summon appears but payment still occurs.',
      'consumed', false, [missiles('2418-2439')],
    )],
    process: 'The cast missile has no process function. A spawned Golem continues through the monster lifecycle; recasting while it lives kills it rather than replacing it.',
    processRefs: [missiles('2418-2453'), '.reference/devilutionX/Source/monster.cpp:3263-3275'],
    end: 'DeleteMissiles removes the transient cast missile; the monster persists until killed, recast, or teardown.',
  }),
  ledger({
    spell: 'Teleport', initial: ['Teleport'], mana: mana(`on success ${StandardMana}; placement fizzle costs 0`, StandardMana),
    duration: '2',
    add: 'AddTeleport searches radius 5 around the clicked destination and stores a valid tile in a short teleport missile before payment.',
    addRefs: [missiles('1931-1949')],
    addBranches: [mechanicBranch(
      'No legal destination exists within radius 5 of the clicked tile.',
      'AddTeleport sets spellFizzled; CastSpell skips payment and no movement occurs.',
      'free', true, [missiles('1931-1948')],
    )],
    process: 'ProcessTeleport revalidates near the stored destination on its first tick, moves player occupancy, light, vision, and the local view if possible, and otherwise leaves the player in place after payment.',
    processRefs: [missiles('3661-3696')],
    end: 'The short teleport missile deletes on its next tick.',
  }),
  ledger({
    spell: 'Apocalypse', initial: ['Apocalypse'], spawned: ['ApocalypseBoom'],
    duration: 'one target per tick through clipped 16x16 scan',
    add: 'AddApocalypse fixes the clipped scan bounds and rolls one damage value shared by every later boom before payment.',
    addRefs: [missiles('2657-2670')],
    process: 'ProcessApocalypse scans until it finds one eligible monster per tick and spawns an ApocalypseBoom there. Each boom retries collision until its first hit or animation expiry.',
    processRefs: [missiles('2455-2460'), missiles('3726-3736'), missiles('3853-3876')],
    hitResult: 'stops-damaging-after-hit',
    end: 'The scanner deletes after exhausting its rectangle; each boom deletes when its animation duration ends.',
  }),
  ledger({
    spell: 'Etherealize', initial: ['Etherealize'], mana: mana(`nominal ${StandardMana}; executed cast is undefined`, StandardMana),
    duration: 'undefined',
    add: 'CastSpell asks AddMissile for Etherealize, but the pinned MissileData add function is null. A forced cast with pool space invokes it before ConsumeSpell and has undefined behavior.',
    addRefs: ['.reference/devilutionX/Source/tables/misdat.cpp:181-184', missiles('2806-2858')],
    addBranches: [{
      condition: 'The missile pool is not already full and the null add function is invoked.',
      outcome: 'Execution is undefined before a normal AddMissile return or ConsumeSpell; no safe resource or effect claim exists.',
      resource: 'undefined', refs: ['.reference/devilutionX/Source/tables/misdat.cpp:181-184', missiles('2806-2858')],
    }],
    process: 'No defined missile is initialized, so no safe Process* lifecycle exists.',
    processRefs: ['.reference/devilutionX/Source/tables/misdat.cpp:181-184'],
    end: 'Ordinary data keeps the placeholder unavailable; a forced execution is undefined rather than a normal lifecycle end.',
  }),
  ledger({
    spell: 'ItemRepair', initial: ['ItemRepair'], mana: mana(SkillMana, StandardMana), duration: 'immediate',
    add: 'AddItemRepair flags its missile for deletion and opens the repair inventory cursor before the Skill source reaches its zero-resource consume phase.',
    addRefs: [missiles('2607-2622')],
    process: 'There is no missile process function; later cursor selection runs the item-repair operation.',
    processRefs: [missiles('2607-2622'), '.reference/devilutionX/Source/items.cpp:3846-3860'],
    end: 'DeleteMissiles removes the transient cursor-opening missile.',
  }),
  ledger({
    spell: 'StaffRecharge', initial: ['StaffRecharge'], mana: mana(SkillMana, StandardMana), duration: 'immediate',
    add: 'AddStaffRecharge flags its missile for deletion and opens the recharge inventory cursor before the Skill source reaches its zero-resource consume phase.',
    addRefs: [missiles('2624-2639')],
    process: 'There is no missile process function; later cursor selection runs the staff recharge and maximum-charge reduction operation.',
    processRefs: [missiles('2624-2639'), '.reference/devilutionX/Source/items.cpp:3862-3874'],
    end: 'DeleteMissiles removes the transient cursor-opening missile.',
  }),
  ledger({
    spell: 'TrapDisarm', initial: ['TrapDisarm'], mana: mana(SkillMana, StandardMana), duration: 'immediate',
    add: 'AddTrapDisarm flags its missile for deletion and opens or immediately applies the disarm cursor before the Skill source reaches its zero-resource consume phase.',
    addRefs: [missiles('2641-2655')],
    process: 'There is no missile process function; the later player/object operation resolves disarm success or failure.',
    processRefs: [missiles('2641-2655'), player('1071-1092')],
    end: 'DeleteMissiles removes the transient cursor-opening missile.',
  }),
  ledger({
    spell: 'Elemental', initial: ['Elemental'], duration: 'initial 256; retarget 255; explosion BigExplosionAnimLen-1',
    add: 'AddElemental rolls half-scaled damage and initializes an unblockable projectile aimed at the clicked tile before payment.',
    addRefs: [missiles('2496-2516')],
    process: 'ProcessElemental moves to the clicked tile, retargets once to a nearby monster or caster facing, then transforms on collision/expiry into a repeated line-visible 3x3 BigExplosion state.',
    processRefs: [missiles('4061-4121')],
    end: 'The explosion state deletes after its animation-derived duration reaches zero.',
  }),
  ledger({
    spell: 'ChargedBolt', initial: ['ChargedBolt'], duration: 'at most 256; then LightningAnimLen',
    add: 'CastSpell creates the table bolt plus floor(S/2)+3 extra ChargedBolts. Every AddChargedBolt independently rolls damage and wobble state before the one payment.',
    addRefs: [spells('211-233'), missiles('2702-2718')],
    process: 'Each ProcessChargedBolt wobbles, moves, and collision-checks independently; a hit stops it and changes it to a stationary Lightning impact animation.',
    processRefs: [missiles('3992-4031')],
    end: 'Each bolt deletes after flight expiry or after its hit animation. A partial set can persist even when a later add fizzles the resource cost.',
  }),
  ledger({
    spell: 'HolyBolt', initial: ['HolyBolt'], duration: 'at most 256; explosion HolyBoltExplosionAnimLen-1',
    add: 'AddHolyBolt rolls damage and initializes a lit, blockable projectile before payment.',
    addRefs: [missiles('2720-2740')],
    process: 'ProcessHolyBolt moves and collision-checks eligible undead/Diablo targets, then changes a stopping hit, wall, or expiry into a visual HolyBoltExplosion state.',
    processRefs: [missiles('4033-4059'), '.reference/devilutionX/Source/monster.cpp:4937-4954'],
    end: 'The missile deletes after the explosion animation-derived duration reaches zero.',
  }),
  ledger({
    spell: 'Resurrect', initial: ['Resurrect'], spawned: ['ResurrectBeam'], mana: mana(ResurrectMana),
    duration: 'effect immediate; ResurrectBeamAnimLen',
    add: 'AddResurrect flags the transient missile for deletion and opens the resurrect target cursor before payment.',
    addRefs: [missiles('2742-2752')],
    process: 'The cast missile has no process function. Later target selection applies resurrection and spawns a ResurrectBeam whose ProcessResurrectBeam counts down and deletes.',
    processRefs: [spells('235-279'), missiles('2754-2759'), missiles('4167-4173')],
    end: 'The cursor-opening missile deletes immediately; a spawned beam deletes at duration zero.',
  }),
  ledger({
    spell: 'Telekinesis', initial: ['Telekinesis'], duration: 'immediate',
    add: 'AddTelekinesis flags the transient missile for deletion and opens the telekinesis cursor before payment.',
    addRefs: [missiles('2761-2768')],
    process: 'There is no missile process function; later cursor use operates an object, requests an item, or knocks back a monster.',
    processRefs: [missiles('2761-2768'), '.reference/devilutionX/Source/inv.cpp:2266-2278'],
    end: 'DeleteMissiles removes the transient cursor-opening missile.',
  }),
  ledger({
    spell: 'HealOther', initial: ['HealOther'], mana: mana(HealingMana), duration: 'immediate after target selection',
    add: 'AddHealOther flags the transient missile for deletion and opens the heal-other target cursor before payment.',
    addRefs: [missiles('2484-2494')],
    process: 'The cast missile has no process function. Later selection of a living player calls DoHealOther and caps the rolled heal at target maximum HP.',
    processRefs: [spells('281-309'), missiles('2484-2494')],
    end: 'The cursor-opening missile deletes immediately; invalid or dead later targets receive no heal, without a refund.',
  }),
  ledger({
    spell: 'BloodStar', initial: ['BloodStar'], spawned: ['BloodStarExplosion'],
    mana: mana(`${StandardMana} plus 5 physical HP`, StandardMana), duration: 'at most 256; then visual explosion',
    add: 'AddGenericMagicMissile computes deterministic player damage and initializes a lit, blockable BloodStar before payment.',
    addRefs: [missiles('2284-2326')],
    consumeExtra: ' After the source-specific payment switch, ConsumeSpell also applies 5 physical HP damage and can kill the caster.',
    process: 'ProcessGenericProjectile moves and collision-checks until a stopping hit, wall, or expiry, then spawns a visual BloodStarExplosion child.',
    processRefs: [missiles('2976-3026')],
    end: 'The projectile deletes at its first stopping collision or expiry; the explosion child is visual.',
  }),
  ledger({
    spell: 'BoneSpirit', initial: ['BoneSpirit'],
    mana: mana(`${StandardMana} plus 6 physical HP`, StandardMana), duration: 'initial 256; retarget 255; fade 7',
    add: 'AddBoneSpirit initializes a lit, blockable projectile aimed at the clicked tile before payment.',
    addRefs: [missiles('2770-2784')],
    consumeExtra: ' After the source-specific payment switch, ConsumeSpell also applies 6 physical HP damage and can kill the caster.',
    process: 'ProcessBoneSpirit reaches the clicked tile, retargets once and derives damage from that target, stops on collision/expiry, then runs a stationary fade state.',
    processRefs: [missiles('4123-4165')],
    end: 'The stationary fade deletes after its short terminal duration and removes its light.',
  }),
] as const satisfies readonly SpellCastLedger[];
