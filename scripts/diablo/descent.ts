/* eslint-disable no-console -- CLI report; stdout and console.table are its interface. */
/**
 * Deterministic Diablo I descent report from locally ingested reference wrappers.
 *
 *   npx tsx scripts/diablo/descent.ts [--class warrior|rogue|sorcerer]
 *     [--policy none|all-strength|balanced] [--tiles-per-level N]
 *     [--difficulty normal|nightmare|hell] [--multiplayer]
 *     [--gear none|expected] [--weapon d1-<item>]
 *     [--defense none|expected]
 *     [--offense none|expected]
 *     [--sorcerer-combat mixed|pure-spell]
 *     [--income monster-gold|gold-and-sales] [--items-per-trip N]
 *     [--identify never|when-profitable]
 *     [--encounter duel|packs] [--slots N]
 *     [--spell-area-in-packs off|expected]
 *     [--buy none|defence]
 *     [--recovery none|town-portal] [--portal-trip-seconds N]
 *     [--chain]
 * Rogue and Sorcerer default to expected gear; Warrior and explicit --weapon runs default to none.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { combatGameMode } from '@/lib/catalog/reference/combatInputs';
import type { Difficulty } from '@/lib/catalog/reference/combatMath';
import {
  DEFAULT_TILES_PER_LEVEL_ASSUMPTION,
  DEFAULT_SALE_ITEMS_PER_TRIP_ASSUMPTION,
  DEFAULT_TOWN_PORTAL_TRIP_SECONDS_ASSUMPTION,
  DESCENT_CLASSES,
  simulateDescent,
  simulateDifficultyChain,
  type DescentClassName,
  type DescentEncounter,
  type DescentGear,
  type DescentPurchases,
  type DescentRecovery,
  type DefensiveAffixes,
  type OffensiveAffixes,
  type SaleIdentify,
  type SorcererCombatPolicy,
  type SpellAreaInPacks,
  type StatPointPolicy,
  type SustainIncome,
} from '@/lib/catalog/reference/descentSim';
import { DEFAULT_ADJACENT_SLOTS } from '@/lib/catalog/reference/packMath';
import { listWrappers } from '@/lib/catalog/reference/wrappers-db';
import { getDb } from '@/lib/db';

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const className = (arg('class') ?? 'warrior').toLowerCase() as DescentClassName;
if (!(DESCENT_CLASSES as readonly string[]).includes(className)) {
  console.error(`--class must be ${DESCENT_CLASSES.join('|')}`);
  process.exit(2);
}
const policy = (arg('policy') ?? 'none') as StatPointPolicy;
if (!(['none', 'all-strength', 'balanced'] as const).includes(policy)) {
  console.error('--policy must be none|all-strength|balanced');
  process.exit(2);
}
const difficulty = (arg('difficulty') ?? 'normal') as Difficulty;
if (!(['normal', 'nightmare', 'hell'] as const).includes(difficulty)) {
  console.error('--difficulty must be normal|nightmare|hell');
  process.exit(2);
}
const gear = (arg('gear') ?? (className === 'warrior' || arg('weapon') ? 'none' : 'expected')) as DescentGear;
if (!(['none', 'expected'] as const).includes(gear)) {
  console.error('--gear must be none|expected');
  process.exit(2);
}
const defensiveAffixes = (arg('defense') ?? 'none') as DefensiveAffixes;
if (!(['none', 'expected'] as const).includes(defensiveAffixes)) {
  console.error('--defense must be none|expected');
  process.exit(2);
}
const offensiveAffixes = (arg('offense') ?? 'none') as OffensiveAffixes;
if (!(['none', 'expected'] as const).includes(offensiveAffixes)) {
  console.error('--offense must be none|expected');
  process.exit(2);
}
const purchases = (arg('buy') ?? 'none') as DescentPurchases;
if (!(['none', 'defence'] as const).includes(purchases)) {
  console.error('--buy must be none|defence');
  process.exit(2);
}
const sorcererCombatPolicy = (arg('sorcerer-combat') ?? 'mixed') as SorcererCombatPolicy;
if (!(['mixed', 'pure-spell'] as const).includes(sorcererCombatPolicy)) {
  console.error('--sorcerer-combat must be mixed|pure-spell');
  process.exit(2);
}
const sustainIncome = (arg('income') ?? 'monster-gold') as SustainIncome;
if (!(['monster-gold', 'gold-and-sales'] as const).includes(sustainIncome)) {
  console.error('--income must be monster-gold|gold-and-sales');
  process.exit(2);
}
const saleIdentify = (arg('identify') ?? 'never') as SaleIdentify;
if (!(['never', 'when-profitable'] as const).includes(saleIdentify)) {
  console.error('--identify must be never|when-profitable');
  process.exit(2);
}
if (saleIdentify === 'when-profitable' && sustainIncome !== 'gold-and-sales') {
  console.error('--identify when-profitable requires --income gold-and-sales');
  process.exit(2);
}
const saleItemsPerTrip = Number(arg('items-per-trip') ?? DEFAULT_SALE_ITEMS_PER_TRIP_ASSUMPTION);
if (!Number.isInteger(saleItemsPerTrip) || saleItemsPerTrip < 0) {
  console.error('--items-per-trip must be a non-negative integer');
  process.exit(2);
}
const tilesPerLevel = Number(arg('tiles-per-level') ?? DEFAULT_TILES_PER_LEVEL_ASSUMPTION);
if (!Number.isInteger(tilesPerLevel) || tilesPerLevel < 0) {
  console.error('--tiles-per-level must be a non-negative integer');
  process.exit(2);
}
const encounter = (arg('encounter') ?? 'duel') as DescentEncounter;
if (!(['duel', 'packs'] as const).includes(encounter)) {
  console.error('--encounter must be duel|packs');
  process.exit(2);
}
const adjacentSlots = Number(arg('slots') ?? DEFAULT_ADJACENT_SLOTS);
if (!Number.isInteger(adjacentSlots) || adjacentSlots < 1 || adjacentSlots > DEFAULT_ADJACENT_SLOTS) {
  console.error(`--slots must be an integer from 1 to ${DEFAULT_ADJACENT_SLOTS}`);
  process.exit(2);
}
const spellAreaInPacks = (arg('spell-area-in-packs') ?? 'off') as SpellAreaInPacks;
if (!(['off', 'expected'] as const).includes(spellAreaInPacks)) {
  console.error('--spell-area-in-packs must be off|expected');
  process.exit(2);
}
if (spellAreaInPacks === 'expected' && (encounter !== 'packs' || className !== 'sorcerer')) {
  console.error('--spell-area-in-packs expected requires --encounter packs --class sorcerer');
  process.exit(2);
}
const recovery = (arg('recovery') ?? 'none') as DescentRecovery;
if (!(['none', 'town-portal'] as const).includes(recovery)) {
  console.error('--recovery must be none|town-portal');
  process.exit(2);
}
const townPortalTripSeconds = Number(
  arg('portal-trip-seconds') ?? DEFAULT_TOWN_PORTAL_TRIP_SECONDS_ASSUMPTION,
);
if (!Number.isFinite(townPortalTripSeconds) || townPortalTripSeconds < 0) {
  console.error('--portal-trip-seconds must be a non-negative number');
  process.exit(2);
}
const chain = process.argv.includes('--chain');

const wrappers = listWrappers(getDb(), { sourceId: 'diablo1' });
const weaponId = arg('weapon');
const weapon = weaponId
  ? wrappers.find((wrapper) => wrapper.catalogId === 'items' && wrapper.entity.id === weaponId)
  : undefined;
if (weaponId && !weapon) throw new Error(`no items wrapper ${weaponId}`);
if (weapon && gear === 'expected') throw new Error('--gear expected cannot be combined with --weapon');

const simulationInput = {
  className,
  policy,
  tilesPerLevel,
  gameMode: combatGameMode(process.argv),
  weapon,
  gear,
  defensiveAffixes,
  offensiveAffixes,
  purchases,
  sorcererCombatPolicy,
  sustainIncome,
  saleItemsPerTrip,
  saleIdentify,
  encounter,
  adjacentSlots,
  spellAreaInPacks,
  recovery,
  townPortalTripSeconds,
  wrappers,
};
const result = chain
  ? simulateDifficultyChain(simulationInput)
  : simulateDescent({ ...simulationInput, difficulty });
const offenseBaseline = offensiveAffixes === 'expected' && !chain
  ? simulateDescent({ ...simulationInput, difficulty, offensiveAffixes: 'none' })
  : undefined;

if (result.model === 'deterministic-expectation-chain') {
  console.log(`\n=== Diablo I deterministic difficulty chain: ${className} · ${policy} · ${result.gameMode} ===`);
  console.table(result.summary.legs.map((leg) => ({
    difficulty: leg.difficulty,
    'end level': leg.levelAtEnd,
    'first unsustainable depth': leg.firstUnsustainableDepth,
    ...(leg.stunLockDepths ? { 'stun-lock depths': leg.stunLockDepths.join(', ') || null } : {}),
  })));
} else {
console.log(`\n=== Diablo I deterministic descent expectation: ${className} · ${policy} · ${difficulty} · ${result.gameMode} ===`);
console.log('ASSUMPTIONS (the tile count is not a reference-table value):');
for (const assumption of result.assumptions) {
  console.log(`- ${assumption.id}: ${assumption.value} — ${assumption.detail} [${assumption.source}]`);
}
console.table(result.levels.map((level) => {
  const baseline = offenseBaseline?.levels[level.depth - 1];
  const mode = level.expectedMeleeKills === undefined ? level.attackMode ?? 'melee' : 'mixed';
  return {
    depth: level.depth,
    mode,
    'spells used': level.spellsUsed?.map((spell) =>
      `${spell.spell} L${spell.spellLevel} ${(spell.killShare * 100).toFixed(1)}%`).join(', ') ?? null,
    unbounded: level.unboundedMonsters?.map((monster) => monster.monster).join(', ') || null,
    'free shots %': level.approach == null ? null : Number((level.approach.freeShotShare * 100).toFixed(2)),
    weapon: mode === 'spell' ? null : level.weaponAssumed?.weaponId ?? result.weaponId ?? 'unarmed',
    pool: level.poolSize,
    kills: level.expectedMonstersKilled,
    'spell kills': level.expectedSpellKills == null ? null : Number(level.expectedSpellKills.toFixed(2)),
    'melee kills': level.expectedMeleeKills == null ? null : Number(level.expectedMeleeKills.toFixed(2)),
    XP: Number(level.expectedXpGained.toFixed(2)),
    'hero before': level.heroLevelBefore,
    'hero after': level.heroLevelAfter,
    'clear seconds': level.expectedSecondsToClear == null ? null : Number(level.expectedSecondsToClear.toFixed(2)),
    'damage taken': level.expectedDamageTaken == null ? null : Number(level.expectedDamageTaken.toFixed(2)),
    ...(encounter === 'packs' ? {
      'pack size': Number(level.pack!.expectedPackSize.toFixed(2)),
      'damage multiplier': level.pack!.damageMultiplierVsDuel == null
        ? null
        : Number(level.pack!.damageMultiplierVsDuel.toFixed(2)),
      interruptions: level.pack!.expectedGotHitInterruptions == null
        ? null
        : Number(level.pack!.expectedGotHitInterruptions.toFixed(2)),
      'pack sustainable': level.pack!.sustainable ? 'yes' : 'no',
      ...(spellAreaInPacks === 'expected' ? {
        'targets/cast': level.pack!.spellArea?.expectedTargetsAffectedPerCast == null
          ? null
          : Number(level.pack!.spellArea.expectedTargetsAffectedPerCast.toFixed(2)),
        'attackers suppressed/cast': level.pack!.spellArea?.expectedAttackersSuppressedPerCast == null
          ? null
          : Number(level.pack!.spellArea.expectedAttackersSuppressedPerCast.toFixed(2)),
      } : {}),
    } : {}),
    ...(recovery === 'town-portal' ? {
      'worst engagement': level.recovery!.worstEngagement.unbounded
        ? `${level.recovery!.worstEngagement.monster} (unbounded${level.recovery!.worstEngagement.stunLocked ? ', stun-lock' : ''})`
        : `${level.recovery!.worstEngagement.monster} (${level.recovery!.worstEngagement.expectedDamageTaken!.toFixed(2)} damage)`,
      'engagement survivable': level.recovery!.engagementSurvivable ? 'yes' : 'no',
      'trips needed': level.recovery!.tripsNeeded == null
        ? null
        : Number(level.recovery!.tripsNeeded.toFixed(2)),
      'portal source': level.recovery!.portalSource,
      'portal gold': level.recovery!.portalGold == null
        ? null
        : Number(level.recovery!.portalGold.toFixed(2)),
      'portal mana': level.recovery!.portalMana == null
        ? null
        : Number(level.recovery!.portalMana.toFixed(2)),
      'town seconds': level.recovery!.townTimeSeconds == null
        ? null
        : Number(level.recovery!.townTimeSeconds.toFixed(2)),
      'recovery verdict': level.recovery!.verdict,
    } : {}),
    'mana spent': level.mana?.expectedManaSpent == null ? null : Number(level.mana.expectedManaSpent.toFixed(2)),
    'mana pool': level.mana == null ? null : Number(level.mana.manaPool.toFixed(2)),
    'mana available': level.mana == null ? null : Number(level.mana.totalManaAvailable.toFixed(2)),
    'mana potions': level.mana == null
      ? null
      : Number((level.mana.manaPotionsAvailable + level.mana.fullManaPotionsAvailable).toFixed(2)),
    'mana sustainable': level.mana == null ? null : level.mana.sustainable ? 'yes' : 'no',
    'hardest to hit': level.hardestMonster.byLowestHeroHitChance.monster,
    'highest damage': level.hardestMonster.byHighestExpectedDamageTaken.monster,
    note: level.note,
    ...(gear === 'expected' ? {
      'weapon damage': level.weaponAssumed
        ? `${level.weaponAssumed.damage.min}-${level.weaponAssumed.damage.max} +${level.weaponAssumed.damageBonusPercent}%`
        : null,
      armour: level.armourAssumed?.totalArmourClass ?? 0,
      'block %': level.expectedBlockChance == null ? null : Number((level.expectedBlockChance * 100).toFixed(2)),
      potions: level.sustain == null
        ? null
        : Number((level.sustain.healingPotionsAvailable + level.sustain.fullHealingPotionsAvailable).toFixed(2)),
      sustainable: level.sustain == null
        ? null
        : level.sustain.sustainable ? 'yes' : `no (life deficit ${level.sustain.deficit.toFixed(2)})`,
    } : {}),
    ...(defensiveAffixes === 'expected' ? {
      'magic resist %': level.defensiveAffixesAssumed?.resistances.magic ?? 0,
      'fire resist %': level.defensiveAffixesAssumed?.resistances.fire ?? 0,
      'lightning resist %': level.defensiveAffixesAssumed?.resistances.lightning ?? 0,
      'hit recovery': level.defensiveAffixesAssumed?.hitRecoveryTier ?? 'none',
    } : {}),
    ...(offensiveAffixes === 'expected' ? {
      'attack speed': level.offensiveAffixesAssumed?.fastAttackTier ?? 'none',
      'to-hit %': level.offensiveAffixesAssumed?.toHitBonusPercent ?? 0,
      'damage %': level.offensiveAffixesAssumed?.damageBonusPercent ?? 0,
      'flat damage': level.offensiveAffixesAssumed?.flatDamage ?? 0,
      'life steal %': level.offensiveAffixesAssumed?.lifeStealPercent ?? 0,
      'mana steal %': level.offensiveAffixesAssumed?.manaStealPercent ?? 0,
      'knockback %': Number(((level.offensiveAffixesAssumed?.knockbackProbability ?? 0) * 100).toFixed(2)),
      'vs demon %': level.offensiveAffixesAssumed?.damageAgainstDemonsPercent ?? 0,
      'vs undead %': level.offensiveAffixesAssumed?.damageAgainstUndeadPercent ?? 0,
      'life stolen': Number((level.sustain?.expectedLifeStolen ?? 0).toFixed(2)),
      'mana stolen': Number((level.mana?.expectedManaStolen ?? 0).toFixed(2)),
      'seconds saved': baseline?.expectedSecondsToClear == null || level.expectedSecondsToClear == null
        ? null
        : Number((baseline.expectedSecondsToClear - level.expectedSecondsToClear).toFixed(2)),
      'damage saved (offense)': baseline?.expectedDamageTaken == null || level.expectedDamageTaken == null
        ? null
        : Number((baseline.expectedDamageTaken - level.expectedDamageTaken).toFixed(2)),
      'sustain effect': baseline?.sustain == null || level.sustain == null
        ? null
        : `${baseline.sustain.sustainable ? 'yes' : 'no'} → ${level.sustain.sustainable ? 'yes' : 'no'}`,
    } : {}),
    ...(purchases === 'defence' ? {
      bought: level.defencePurchases?.bought.map((item) =>
        `${item.store} ${item.equipmentSlot} ${item.target} (${item.expectedPrice}g)`).join(', ') || null,
      'defence gold': level.defencePurchases?.goldSpent ?? 0,
      'result AC': level.defencePurchases?.resultingArmourClass ?? 0,
      'result magic %': level.defencePurchases?.resultingResistances.magic ?? 0,
      'result fire %': level.defencePurchases?.resultingResistances.fire ?? 0,
      'result lightning %': level.defencePurchases?.resultingResistances.lightning ?? 0,
      'result recovery': level.defencePurchases?.resultingHitRecoveryTier ?? 'none',
      'damage no buy': level.defencePurchases?.expectedDamageTakenWithoutPurchases == null
        ? null
        : Number(level.defencePurchases.expectedDamageTakenWithoutPurchases.toFixed(2)),
      'damage saved': level.defencePurchases?.expectedDamageReduction == null
        ? null
        : Number(level.defencePurchases.expectedDamageReduction.toFixed(2)),
      'sustainable no buy': level.defencePurchases?.sustainableWithoutPurchases ? 'yes' : 'no',
    } : {}),
  };
}));

if (result.goldFlow) {
  console.log('\nGOLD FLOW (derived measurement; rates use combat-only clear time):');
  console.table(result.goldFlow.levels.map((level) => ({
    depth: level.depth,
    'monster gold': Number(level.faucets.monsterGold.toFixed(2)),
    sales: Number(level.faucets.sales.toFixed(2)),
    ...(saleIdentify === 'when-profitable' ? {
      'sales unidentified': Number((level.sales.unidentifiedPolicyExpectedGold ?? 0).toFixed(2)),
      identified: Number((level.sales.expectedItemsIdentified ?? 0).toFixed(2)),
      'sale net gain': Number((level.sales.expectedNetGoldGainVsUnidentified ?? 0).toFixed(2)),
    } : {}),
    'faucets total': Number(level.faucets.total.toFixed(2)),
    'potions bought': Number(level.sinks.potionsBought.toFixed(2)),
    ...(purchases === 'defence' ? { 'defence bought': Number((level.sinks.defenceBought ?? 0).toFixed(2)) } : {}),
    ...(recovery === 'town-portal'
      ? { 'town portals': Number((level.sinks.townPortals ?? 0).toFixed(2)) }
      : {}),
    repair: Number(level.sinks.repair.toFixed(2)),
    identify: Number(level.sinks.identify.toFixed(2)),
    'sinks total': Number(level.sinks.total.toFixed(2)),
    net: Number(level.net.toFixed(2)),
    'faucets/hour': level.perHour == null ? null : Number(level.perHour.faucets.total.toFixed(2)),
    'sinks/hour': level.perHour == null ? null : Number(level.perHour.sinks.total.toFixed(2)),
    'net/hour': level.perHour == null ? null : Number(level.perHour.net.toFixed(2)),
  })));
  console.table([{
    scope: 'cumulative',
    faucets: Number(result.goldFlow.cumulative.faucets.total.toFixed(2)),
    sinks: Number(result.goldFlow.cumulative.sinks.total.toFixed(2)),
    ...(purchases === 'defence'
      ? { 'defence bought': Number((result.goldFlow.cumulative.sinks.defenceBought ?? 0).toFixed(2)) }
      : {}),
    ...(recovery === 'town-portal'
      ? { 'town portals': Number((result.goldFlow.cumulative.sinks.townPortals ?? 0).toFixed(2)) }
      : {}),
    net: Number(result.goldFlow.cumulative.net.toFixed(2)),
    'faucets/hour': result.goldFlow.cumulative.perHour == null
      ? null
      : Number(result.goldFlow.cumulative.perHour.faucets.total.toFixed(2)),
    'sinks/hour': result.goldFlow.cumulative.perHour == null
      ? null
      : Number(result.goldFlow.cumulative.perHour.sinks.total.toFixed(2)),
    'net/hour': result.goldFlow.equilibrium.netGoldPerHour == null
      ? null
      : Number(result.goldFlow.equilibrium.netGoldPerHour.toFixed(2)),
    equilibrium: result.goldFlow.equilibrium.status,
  }]);
}
}

const path = join(
  homedir(),
  'Documents',
  'Obsidian',
  'pof',
  'Diablo',
  'Combat',
  `descent-${className}-${policy}${gear === 'expected' ? '-expected-gear' : ''}${className === 'sorcerer' && sorcererCombatPolicy === 'mixed' ? '-mixed' : ''}${sustainIncome === 'gold-and-sales' ? '-gold-and-sales' : ''}${saleIdentify === 'when-profitable' ? '-identify-profitable' : ''}${encounter === 'packs' ? `-packs-${adjacentSlots}-slots` : ''}${spellAreaInPacks === 'expected' ? '-expected-spell-area' : ''}${defensiveAffixes === 'expected' ? '-expected-defense' : ''}${offensiveAffixes === 'expected' ? '-expected-offense' : ''}${purchases === 'defence' ? '-buy-defence' : ''}${recovery === 'town-portal' ? '-town-portal-recovery' : ''}${townPortalTripSeconds !== DEFAULT_TOWN_PORTAL_TRIP_SECONDS_ASSUMPTION ? `-${townPortalTripSeconds}s-town-trip` : ''}${chain ? '-chain' : ''}.json`,
);
mkdirSync(dirname(path), { recursive: true });
writeFileSync(path, JSON.stringify(result, null, 2));
console.log(`JSON → ${path}`);
