/* eslint-disable no-console -- CLI harness; stdout is its interface. */
/**
 * Runtime-only Diablo I duel matrix. Every balance value comes from wrappers in the local DB.
 *
 *   npx tsx scripts/diablo/combat.ts [--class warrior|rogue|sorcerer] [--level N]
 *     [--difficulty normal|nightmare|hell] [--weapon d1-<item>] [--monsters id,id]
 *     [--out file.json] [--seed id,id]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { listEntities } from '@/lib/catalog-db';
import { submitStepArtifact } from '@/lib/catalog/headless';
import '@/lib/catalog/pipelines/registry.generated';
import { duel } from '@/lib/catalog/reference/combatDuel';
import { classCoefficients, monsterProfile, referenceBuild } from '@/lib/catalog/reference/combatInputs';
import { seedBestiaryCombatSteps } from '@/lib/catalog/reference/combatSeeds';
import { experienceAward, experienceCurveLaw, FIXED_POINT, type Difficulty } from '@/lib/catalog/reference/combatMath';
import { listWrappers } from '@/lib/catalog/reference/wrappers-db';
import { getDb } from '@/lib/db';
import type { ReferenceWrapper } from '@/lib/catalog/reference/wrapper';

const VANILLA = ['warrior', 'rogue', 'sorcerer'] as const;
type ClassFolder = typeof VANILLA[number];

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function csv(value: string | undefined): string[] | undefined {
  return value?.split(',').map((item) => item.trim()).filter(Boolean);
}

function stat(wrapper: ReferenceWrapper, label: string): number {
  const stats = wrapper.entity.data.stats;
  const value = Array.isArray(stats)
    ? (stats.find((entry) => entry && typeof entry === 'object' && (entry as { label?: unknown }).label === label) as { value?: unknown } | undefined)?.value
    : undefined;
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`${wrapper.entity.id} has no numeric data.stats[${label}]`);
  return number;
}

function finite(value: number): number | null {
  return Number.isFinite(value) ? value : null;
}

const requestedClass = arg('class')?.toLowerCase();
if (requestedClass && ['monk', 'bard', 'barbarian'].includes(requestedClass)) {
  console.error(`OUT OF SCOPE: ${requestedClass} is a Hellfire class; this matrix is vanilla Diablo I only`);
  process.exit(2);
}
if (requestedClass && !(VANILLA as readonly string[]).includes(requestedClass)) {
  console.error(`--class must be ${VANILLA.join('|')}`);
  process.exit(2);
}
const classes: ClassFolder[] = requestedClass ? [requestedClass as ClassFolder] : [...VANILLA];
const level = Number(arg('level') ?? 1);
if (!Number.isInteger(level) || level < 1) {
  console.error('--level must be a positive integer');
  process.exit(2);
}
const difficulty = (arg('difficulty') ?? 'normal') as Difficulty;
if (!(['normal', 'nightmare', 'hell'] as const).includes(difficulty)) {
  console.error('--difficulty must be normal|nightmare|hell');
  process.exit(2);
}

const db = getDb();
const characterWrappers = listWrappers(db, { sourceId: 'diablo1', catalogId: 'characters' });
const itemWrappers = listWrappers(db, { sourceId: 'diablo1', catalogId: 'items' });
const bestiaryWrappers = listWrappers(db, { sourceId: 'diablo1', catalogId: 'bestiary' })
  .filter((wrapper) => wrapper.file === 'monsters/monstdat.tsv' || wrapper.file === 'monsters/unique_monstdat.tsv');
const baseWrappers = bestiaryWrappers.filter((wrapper) => wrapper.file === 'monsters/monstdat.tsv');
const baseFor = (wrapper: ReferenceWrapper) => wrapper.file === 'monsters/unique_monstdat.tsv'
  ? baseWrappers.find((base) => base.raw._monster_id === wrapper.raw.type)
  : undefined;
const progressionWrappers = listWrappers(db, { sourceId: 'diablo1', catalogId: 'progression-curves' });
const weaponId = arg('weapon');
const weapon = weaponId ? itemWrappers.find((wrapper) => wrapper.entity.id === weaponId) : undefined;
if (weaponId && !weapon) throw new Error(`no items wrapper ${weaponId}`);

const seedIds = csv(arg('seed'));
const requestedMonsters = csv(arg('monsters')) ?? seedIds;
const monsters = requestedMonsters
  ? bestiaryWrappers.filter((wrapper) => requestedMonsters.includes(wrapper.entity.id))
  : bestiaryWrappers.filter((wrapper) => monsterProfile(wrapper, difficulty, baseFor(wrapper)).level <= level + 10);
const missingMonsters = (requestedMonsters ?? []).filter((id) => !monsters.some((wrapper) => wrapper.entity.id === id));
if (missingMonsters.length) console.log(`no monstdat wrapper for: ${missingMonsters.join(', ')}`);

const curve = experienceCurveLaw(progressionWrappers.map((wrapper) => {
  const rawLevel = wrapper.entity.data.level;
  const parsedLevel = rawLevel === 'MaxLevel' ? 'MaxLevel' as const : Number(rawLevel);
  return { level: parsedLevel, experience: Number(wrapper.entity.data.experienceToReach) };
}).filter((row): row is { level: number | 'MaxLevel'; experience: number } =>
  (row.level === 'MaxLevel' || Number.isInteger(row.level)) && Number.isFinite(row.experience)));
if (curve.maxLevel === 0) throw new Error('the local DB has no usable Diablo I XP-curve wrappers');

interface DuelRow {
  monster: string;
  monsterId: string;
  playerHitPct: number;
  expectedSwingsToKill: number | null;
  monsterHitPct: number;
  expectedMonsterDamagePerHit: number;
  expectedHitsToKillPlayer: number | null;
  xpAward: number;
}

const tables: Record<string, DuelRow[]> = {};
for (const folder of classes) {
  const classWrapper = characterWrappers.find((wrapper) => wrapper.entity.id === `d1-class-${folder}`);
  if (!classWrapper) throw new Error(`the local DB has no d1-class-${folder} wrapper`);
  const coefficients = classCoefficients(classWrapper);
  const build = referenceBuild(classWrapper, level, weapon);
  const playerAttack = build.weaponType === 'bow' ? 'ranged' : 'melee';
  const rows = monsters.map((wrapper): DuelRow => {
    const base = baseFor(wrapper);
    const monster = monsterProfile(wrapper, difficulty, base);
    const result = duel(build, coefficients, monster, {
      playerAttack,
      monsterAttack: 'melee',
      dungeonLevel: Math.min(16, Math.max(1, monster.level)),
    });
    const currentTotal = level <= 1 ? 0 : curve.threshold(level - 1) ?? 0;
    const xp = experienceAward({
      baseExperience: stat(base ?? wrapper, 'XP'),
      difficulty,
      unique: wrapper.file === 'monsters/unique_monstdat.tsv',
      whoHitMask: 1,
      localPlayerBit: 1,
      playerLevel: level,
      monsterLevel: monster.level - (wrapper.file === 'monsters/unique_monstdat.tsv'
        ? difficulty === 'nightmare' ? 15 : difficulty === 'hell' ? 30 : 0
        : 0),
      totalExperience: currentTotal,
      curve,
    });
    return {
      monster: wrapper.entity.name,
      monsterId: wrapper.entity.id,
      playerHitPct: result.playerHitChance * 100,
      expectedSwingsToKill: finite(result.expectedPlayerSwingsToKill),
      monsterHitPct: result.monsterHitChance * 100,
      expectedMonsterDamagePerHit: result.expectedMonsterDamagePerHit / FIXED_POINT,
      expectedHitsToKillPlayer: finite(result.expectedMonsterHitsToKillPlayer),
      xpAward: xp.granted,
    };
  });
  tables[folder] = rows;
  console.log(`\n=== ${folder} · level ${level} · ${difficulty}${weapon ? ` · ${weapon.entity.name}` : ' · bare-handed'} ===`);
  console.table(rows.map((row) => ({
    monster: row.monster,
    'player hit %': Number(row.playerHitPct.toFixed(2)),
    'swings to kill': row.expectedSwingsToKill == null ? null : Number(row.expectedSwingsToKill.toFixed(2)),
    'monster hit %': Number(row.monsterHitPct.toFixed(2)),
    'monster damage/hit': Number(row.expectedMonsterDamagePerHit.toFixed(2)),
    'hits to kill player': row.expectedHitsToKillPlayer == null ? null : Number(row.expectedHitsToKillPlayer.toFixed(2)),
    XP: row.xpAward,
  })));
}

const out = arg('out');
if (out) {
  const path = resolve(out);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(classes.length === 1 ? tables[classes[0]] : tables, null, 2));
  console.log(`JSON → ${path}`);
} else {
  for (const folder of classes) {
    const path = join(homedir(), 'Documents', 'Obsidian', 'pof', 'Diablo', 'Combat', `${folder}-L${level}.json`);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(tables[folder], null, 2));
    console.log(`JSON → ${path}`);
  }
}

if (seedIds) {
  const promoted = new Set(listEntities('bestiary').filter((entity) => entity.source === 'ingest').map((entity) => entity.entityId));
  const warrior = characterWrappers.find((wrapper) => wrapper.entity.id === 'd1-class-warrior');
  if (!warrior) throw new Error('the local DB has no d1-class-warrior wrapper for encounter seeds');
  for (const id of seedIds) {
    const wrapper = bestiaryWrappers.find((candidate) => candidate.entity.id === id);
    if (!wrapper) continue;
    if (!promoted.has(id)) {
      console.log(`SKIP ${id}: not promoted (promote it first)`);
      continue;
    }
    for (const seed of seedBestiaryCombatSteps(wrapper, warrior, difficulty)) {
      const result = submitStepArtifact(seed.catalogId, seed.entityId, seed.step, seed.data, []);
      console.log(`${seed.entityId} · ${seed.step}: ${result.acceptance?.status ?? '?'}`);
      for (const gap of seed.gaps) console.log(`    gap: ${gap}`);
    }
  }
}
