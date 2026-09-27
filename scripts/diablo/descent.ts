/* eslint-disable no-console -- CLI report; stdout and console.table are its interface. */
/**
 * Deterministic Diablo I descent report from locally ingested reference wrappers.
 *
 *   npx tsx scripts/diablo/descent.ts [--class warrior|rogue|sorcerer]
 *     [--policy none|all-strength|balanced] [--tiles-per-level N]
 *     [--difficulty normal|nightmare|hell] [--multiplayer]
 *     [--gear none|expected] [--weapon d1-<item>]
 *     [--sorcerer-combat mixed|pure-spell]
 *     [--income monster-gold|gold-and-sales] [--items-per-trip N]
 *     [--encounter duel|packs] [--slots N]
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
  DESCENT_CLASSES,
  simulateDescent,
  type DescentClassName,
  type DescentEncounter,
  type DescentGear,
  type SorcererCombatPolicy,
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

const wrappers = listWrappers(getDb(), { sourceId: 'diablo1' });
const weaponId = arg('weapon');
const weapon = weaponId
  ? wrappers.find((wrapper) => wrapper.catalogId === 'items' && wrapper.entity.id === weaponId)
  : undefined;
if (weaponId && !weapon) throw new Error(`no items wrapper ${weaponId}`);
if (weapon && gear === 'expected') throw new Error('--gear expected cannot be combined with --weapon');

const result = simulateDescent({
  className,
  policy,
  tilesPerLevel,
  gameMode: combatGameMode(process.argv),
  difficulty,
  weapon,
  gear,
  sorcererCombatPolicy,
  sustainIncome,
  saleItemsPerTrip,
  encounter,
  adjacentSlots,
  wrappers,
});

console.log(`\n=== Diablo I deterministic descent expectation: ${className} · ${policy} · ${difficulty} · ${result.gameMode} ===`);
console.log('ASSUMPTIONS (the tile count is not a reference-table value):');
for (const assumption of result.assumptions) {
  console.log(`- ${assumption.id}: ${assumption.value} — ${assumption.detail} [${assumption.source}]`);
}
console.table(result.levels.map((level) => {
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
  };
}));

if (result.goldFlow) {
  console.log('\nGOLD FLOW (derived measurement; rates use combat-only clear time):');
  console.table(result.goldFlow.levels.map((level) => ({
    depth: level.depth,
    'monster gold': Number(level.faucets.monsterGold.toFixed(2)),
    sales: Number(level.faucets.sales.toFixed(2)),
    'faucets total': Number(level.faucets.total.toFixed(2)),
    'potions bought': Number(level.sinks.potionsBought.toFixed(2)),
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

const path = join(
  homedir(),
  'Documents',
  'Obsidian',
  'pof',
  'Diablo',
  'Combat',
  `descent-${className}-${policy}${gear === 'expected' ? '-expected-gear' : ''}${className === 'sorcerer' && sorcererCombatPolicy === 'mixed' ? '-mixed' : ''}${sustainIncome === 'gold-and-sales' ? '-gold-and-sales' : ''}${encounter === 'packs' ? `-packs-${adjacentSlots}-slots` : ''}.json`,
);
mkdirSync(dirname(path), { recursive: true });
writeFileSync(path, JSON.stringify(result, null, 2));
console.log(`JSON → ${path}`);
