/* eslint-disable no-console -- CLI report; stdout and console.table are its interface. */
/**
 * Deterministic Diablo I descent report from locally ingested reference wrappers.
 *
 *   npx tsx scripts/diablo/descent.ts [--class warrior|rogue|sorcerer]
 *     [--policy none|all-strength|balanced] [--tiles-per-level N]
 *     [--difficulty normal|nightmare|hell] [--multiplayer]
 *     [--gear none|expected] [--weapon d1-<item>]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { combatGameMode } from '@/lib/catalog/reference/combatInputs';
import type { Difficulty } from '@/lib/catalog/reference/combatMath';
import {
  DEFAULT_TILES_PER_LEVEL_ASSUMPTION,
  DESCENT_CLASSES,
  simulateDescent,
  type DescentClassName,
  type DescentGear,
  type StatPointPolicy,
} from '@/lib/catalog/reference/descentSim';
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
const gear = (arg('gear') ?? 'none') as DescentGear;
if (!(['none', 'expected'] as const).includes(gear)) {
  console.error('--gear must be none|expected');
  process.exit(2);
}
const tilesPerLevel = Number(arg('tiles-per-level') ?? DEFAULT_TILES_PER_LEVEL_ASSUMPTION);
if (!Number.isInteger(tilesPerLevel) || tilesPerLevel < 0) {
  console.error('--tiles-per-level must be a non-negative integer');
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
  wrappers,
});

console.log(`\n=== Diablo I deterministic descent expectation: ${className} · ${policy} · ${difficulty} · ${result.gameMode} ===`);
console.log('ASSUMPTIONS (the tile count is not a reference-table value):');
for (const assumption of result.assumptions) {
  console.log(`- ${assumption.id}: ${assumption.value} — ${assumption.detail} [${assumption.source}]`);
}
console.table(result.levels.map((level) => ({
  depth: level.depth,
  pool: level.poolSize,
  kills: level.expectedMonstersKilled,
  XP: Number(level.expectedXpGained.toFixed(2)),
  'hero before': level.heroLevelBefore,
  'hero after': level.heroLevelAfter,
  'clear seconds': level.expectedSecondsToClear == null ? null : Number(level.expectedSecondsToClear.toFixed(2)),
  'damage taken': level.expectedDamageTaken == null ? null : Number(level.expectedDamageTaken.toFixed(2)),
  'hardest to hit': level.hardestMonster.byLowestHeroHitChance.monster,
  'highest damage': level.hardestMonster.byHighestExpectedDamageTaken.monster,
  note: level.note,
  ...(gear === 'expected' ? {
    weapon: level.weaponAssumed?.weaponId ?? 'unarmed',
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
      : level.sustain.sustainable ? 'yes' : `no (deficit ${level.sustain.deficit.toFixed(2)})`,
  } : {}),
})));

const path = join(
  homedir(),
  'Documents',
  'Obsidian',
  'pof',
  'Diablo',
  'Combat',
  `descent-${className}-${policy}${gear === 'expected' ? '-expected-gear' : ''}.json`,
);
mkdirSync(dirname(path), { recursive: true });
writeFileSync(path, JSON.stringify(result, null, 2));
console.log(`JSON → ${path}`);
