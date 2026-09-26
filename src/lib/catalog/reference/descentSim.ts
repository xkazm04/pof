/** Deterministic Diablo I descent expectations assembled from reference wrappers and combat laws. */
import { DIABLO1_SOURCE } from '@/lib/catalog/ingest/diablo1';
import { duel } from '@/lib/catalog/reference/combatDuel';
import { classCoefficients, monsterProfile, referenceBuild } from '@/lib/catalog/reference/combatInputs';
import {
  experienceAward,
  experienceCurveLaw,
  FIXED_POINT,
  type Difficulty,
  type ExperienceCurveLaw,
  type GameMode,
  type PlayerBuild,
} from '@/lib/catalog/reference/combatMath';
import { aggregateClassWrappers } from '@/lib/catalog/reference/classHeroes';
import { contentHash } from '@/lib/catalog/reference/hash';
import { locationEntities, type LocationEntityWrapper } from '@/lib/catalog/reference/locationSpecs';
import type { ReferenceWrapper } from '@/lib/catalog/reference/wrapper';

export const DESCENT_CLASSES = ['warrior', 'rogue', 'sorcerer'] as const;
export type DescentClassName = typeof DESCENT_CLASSES[number];
export type StatPointPolicy = 'none' | 'all-strength' | 'balanced';

/** Explicit non-solid-tile assumption used only when a caller does not provide one. */
export const DEFAULT_TILES_PER_LEVEL_ASSUMPTION = 3_000;

export interface DescentAssumption {
  id: string;
  value: string | number;
  source: string;
  detail: string;
}

export interface DescentMonsterDifficulty {
  monsterId: string;
  monster: string;
  value: number;
}

export interface DescentHardestMonster {
  byLowestHeroHitChance: DescentMonsterDifficulty;
  byHighestExpectedDamageTaken: DescentMonsterDifficulty;
}

export interface DescentLevelResult {
  depth: number;
  poolSize: number;
  expectedMonstersKilled: number;
  expectedXpGained: number;
  heroLevelBefore: number;
  heroLevelAfter: number;
  expectedSecondsToClear: number | null;
  expectedDamageTaken: number | null;
  hardestMonster: DescentHardestMonster;
  note: string;
}

export interface DescentSimulation {
  model: 'deterministic-expectation';
  className: DescentClassName;
  policy: StatPointPolicy;
  gameMode: GameMode;
  difficulty: Difficulty;
  weaponId: string | null;
  assumptions: DescentAssumption[];
  levels: DescentLevelResult[];
}

export interface SimulateDescentInput {
  className: DescentClassName;
  policy: StatPointPolicy;
  tilesPerLevel?: number;
  gameMode: GameMode;
  difficulty: Difficulty;
  weapon?: ReferenceWrapper;
  /** Source rows are passed in; the simulator never reads a database or filesystem. */
  wrappers: readonly ReferenceWrapper[];
  /** Tests and other pure callers may pass already-projected location entities. */
  locations?: readonly LocationEntityWrapper[];
}

const ATTRIBUTE_KEYS = ['strength', 'magic', 'dexterity', 'vitality'] as const;
type AttributeKey = typeof ATTRIBUTE_KEYS[number];

function numericStat(wrapper: ReferenceWrapper, label: string): number {
  const stats = wrapper.entity.data.stats;
  const entry = Array.isArray(stats)
    ? stats.find((item) => item && typeof item === 'object' && (item as { label?: unknown }).label === label)
    : undefined;
  const value = Number((entry as { value?: unknown } | undefined)?.value);
  if (!Number.isFinite(value)) throw new Error(`${wrapper.entity.id} has no numeric data.stats[${label}]`);
  return value;
}

function curveFrom(wrappers: readonly ReferenceWrapper[]): ExperienceCurveLaw {
  const aggregate = wrappers.find((wrapper) =>
    wrapper.catalogId === 'progression-curves' && Array.isArray(wrapper.entity.data.levels));
  const records = aggregate
    ? (aggregate.entity.data.levels as { level?: unknown; experience?: unknown }[]).map((row) => ({
        level: Number(row.level),
        experience: Number(row.experience),
      }))
    : wrappers.filter((wrapper) => wrapper.catalogId === 'progression-curves').map((wrapper) => ({
        level: wrapper.entity.data.level === 'MaxLevel' ? 'MaxLevel' as const : Number(wrapper.entity.data.level),
        experience: Number(wrapper.entity.data.experienceToReach),
      }));
  const usable = records.filter((row): row is { level: number | 'MaxLevel'; experience: number } =>
    (row.level === 'MaxLevel' || Number.isInteger(row.level)) && Number.isFinite(row.experience));
  const curve = experienceCurveLaw(usable);
  if (curve.maxLevel === 0) throw new Error('the supplied wrappers have no usable Diablo I XP curve');
  return curve;
}

function classWrapperFrom(wrappers: readonly ReferenceWrapper[], className: DescentClassName): ReferenceWrapper {
  const classes = aggregateClassWrappers(wrappers.filter((wrapper) => wrapper.catalogId === 'characters'));
  const classWrapper = classes.find((wrapper) => wrapper.entity.id === `d1-class-${className}`);
  if (!classWrapper) throw new Error(`the supplied wrappers have no d1-class-${className} aggregate`);
  return classWrapper;
}

function allocateStats(build: PlayerBuild, policy: StatPointPolicy, maxima: Record<AttributeKey, number>): PlayerBuild {
  if (policy === 'none') return build;
  let remaining = Math.max(0, (build.level - 1) * 5);
  const allocated = { ...build };
  if (policy === 'all-strength') {
    allocated.strength += Math.min(remaining, Math.max(0, maxima.strength - allocated.strength));
    return allocated;
  }
  while (remaining > 0) {
    let spent = false;
    for (const key of ATTRIBUTE_KEYS) {
      if (remaining === 0) break;
      if (allocated[key] >= maxima[key]) continue;
      allocated[key]++;
      remaining--;
      spent = true;
    }
    if (!spent) break;
  }
  return allocated;
}

function levelAt(totalExperience: number, currentLevel: number, curve: ExperienceCurveLaw): number {
  let level = currentLevel;
  while (level < curve.maxLevel && totalExperience >= (curve.threshold(level) ?? Number.MAX_SAFE_INTEGER)) level++;
  return level;
}

function finiteOrNull(value: number): number | null {
  return Number.isFinite(value) ? value : null;
}

function hardest(
  rows: readonly { wrapper: ReferenceWrapper; playerHitChance: number; expectedDamageTaken: number }[],
): DescentHardestMonster {
  const hit = [...rows].sort((a, b) =>
    a.playerHitChance - b.playerHitChance || b.expectedDamageTaken - a.expectedDamageTaken ||
    a.wrapper.entity.id.localeCompare(b.wrapper.entity.id))[0];
  const damage = [...rows].sort((a, b) =>
    b.expectedDamageTaken - a.expectedDamageTaken || a.playerHitChance - b.playerHitChance ||
    a.wrapper.entity.id.localeCompare(b.wrapper.entity.id))[0];
  return {
    byLowestHeroHitChance: {
      monsterId: hit.wrapper.entity.id,
      monster: hit.wrapper.entity.name,
      value: hit.playerHitChance,
    },
    byHighestExpectedDamageTaken: {
      monsterId: damage.wrapper.entity.id,
      monster: damage.wrapper.entity.name,
      value: damage.expectedDamageTaken,
    },
  };
}

function assumptions(tilesPerLevel: number, policy: StatPointPolicy): DescentAssumption[] {
  return [
    {
      id: 'non-solid-tiles-per-level',
      value: tilesPerLevel,
      source: 'explicit caller assumption (the reference data has no per-level non-solid tile count)',
      detail: `Ambient population is floor(${tilesPerLevel} / 30); this value is an ASSUMPTION, not a Diablo table value.`,
    },
    {
      id: 'eligible-type-mixture',
      value: 'uniform mean over eligible ordinary monster types',
      source: 'd1-monster-type-selection plus zone-map spawns links',
      detail: 'The expectation averages type-level outcomes equally; it does not sample a game seed or claim the linked candidate pool is one generated roster.',
    },
    {
      id: 'unique-placement',
      value: 'eligible uniques reported but excluded from totals',
      source: 'd1-unique-placement',
      detail: 'A unique requires its base type in the actually registered roster and may depend on quest availability; neither event is fixed by a candidate-pool expectation.',
    },
    {
      id: 'stat-point-policy',
      value: policy,
      source: 'five points per completed hero level; class maxima from the supplied class wrapper',
      detail: policy === 'balanced'
        ? 'Balanced spends points round-robin in Strength, Magic, Dexterity, Vitality order, skipping capped attributes.'
        : policy === 'all-strength'
          ? 'All-strength spends only into Strength up to the class maximum; excess points remain unspent.'
          : 'No level-up stat points are spent.',
    },
    {
      id: 'duel-exchange',
      value: 'hero attacks first; one melee counterattack between hero swings',
      source: 'combatDuel.duel expectations',
      detail: 'Expected damage per kill is (expected hero swings - 1) × expected monster damage per swing. Monster travel, AI delays, ranged spacing, healing, and simultaneous packs are outside this duel model.',
    },
    {
      id: 'clear-time',
      value: 'sum of duel time-to-kill; zero travel time',
      source: 'combatDuel.duel expectedPlayerSecondsToKill',
      detail: 'Every ambient kill is fought sequentially; navigation, doors, loot, recovery, and downtime add no seconds.',
    },
  ];
}

/**
 * Simulate the vanilla depths 1..16 as a deterministic expectation. No random roster, combat roll,
 * or dungeon seed is generated: every per-type quantity is an exact combat-law expectation, then
 * the eligible type pool is averaged and multiplied by the explicit population assumption.
 */
export function simulateDescent(input: SimulateDescentInput): DescentSimulation {
  if (!(DESCENT_CLASSES as readonly string[]).includes(input.className)) throw new Error(`unknown Diablo I class ${input.className}`);
  if (!(['none', 'all-strength', 'balanced'] as const).includes(input.policy)) throw new Error(`unknown stat-point policy ${input.policy}`);
  if (!(['normal', 'nightmare', 'hell'] as const).includes(input.difficulty)) throw new Error(`unknown difficulty ${input.difficulty}`);
  const tilesPerLevel = input.tilesPerLevel ?? DEFAULT_TILES_PER_LEVEL_ASSUMPTION;
  if (!Number.isInteger(tilesPerLevel) || tilesPerLevel < 0) throw new Error(`tilesPerLevel must be a non-negative integer (got ${tilesPerLevel})`);

  const classWrapper = classWrapperFrom(input.wrappers, input.className);
  const coefficients = classCoefficients(classWrapper);
  const maxima = {
    strength: coefficients.maxStrength,
    magic: coefficients.maxMagic,
    dexterity: coefficients.maxDexterity,
    vitality: coefficients.maxVitality,
  };
  const curve = curveFrom(input.wrappers);
  const locations = input.locations ?? locationEntities(input.wrappers);
  const bestiary = input.wrappers.filter((wrapper) => wrapper.catalogId === 'bestiary');
  const bestiaryById = new Map(bestiary.map((wrapper) => [wrapper.entity.id, wrapper]));
  const ordinaryByType = new Map(bestiary
    .filter((wrapper) => wrapper.file === 'monsters/monstdat.tsv')
    .map((wrapper) => [wrapper.raw._monster_id, wrapper]));
  const ambientPopulation = Math.floor(tilesPerLevel / 30);
  const maximumExperience = curve.threshold(curve.maxLevel) ?? Number.MAX_SAFE_INTEGER;
  let heroLevel = 1;
  let totalExperience = 0;
  const levels: DescentLevelResult[] = [];

  for (let depth = 1; depth <= 16; depth++) {
    const location = locations.find((candidate) => candidate.entity.data.depth === depth);
    if (!location) throw new Error(`the supplied locations have no vanilla dungeon depth ${depth}`);
    const spawnIds = (location.entity.links ?? []).filter((link) => link.role === 'spawns').map((link) => link.entityId);
    const uniqueIds = (location.entity.links ?? []).filter((link) => link.role === 'unique').map((link) => link.entityId);
    const pool = spawnIds.map((id) => bestiaryById.get(id)).filter((wrapper): wrapper is ReferenceWrapper => wrapper !== undefined);
    if (pool.length !== spawnIds.length) {
      const missing = spawnIds.filter((id) => !bestiaryById.has(id));
      throw new Error(`depth ${depth} references missing bestiary wrappers: ${missing.join(', ')}`);
    }
    if (pool.length === 0) throw new Error(`depth ${depth} has no eligible ordinary monster pool`);

    const heroLevelBefore = heroLevel;
    const build = allocateStats(referenceBuild(classWrapper, heroLevelBefore, input.weapon), input.policy, maxima);
    const playerAttack = build.weaponType === 'bow' ? 'ranged' : 'melee';
    const rows = pool.map((wrapper) => {
      const unique = wrapper.file === 'monsters/unique_monstdat.tsv';
      const base = unique ? ordinaryByType.get(wrapper.raw.type) : undefined;
      if (unique && !base) throw new Error(`${wrapper.entity.id} has no supplied monstdat base ${wrapper.raw.type}`);
      const monster = monsterProfile(wrapper, input.difficulty, base, input.gameMode);
      const result = duel(build, coefficients, monster, {
        gameMode: input.gameMode,
        playerAttack,
        playerDistance: 0,
        monsterAttack: 'melee',
        dungeonLevel: depth,
      });
      if (result.expectedPlayerSecondsToKill === null) {
        throw new Error(`${classWrapper.entity.id} has no attack timing for ${build.weaponGraphic ?? build.weaponType}`);
      }
      const difficultyLevelBonus = input.difficulty === 'nightmare' ? 15 : input.difficulty === 'hell' ? 30 : 0;
      const xp = experienceAward({
        baseExperience: numericStat(base ?? wrapper, 'XP'),
        difficulty: input.difficulty,
        unique,
        whoHitMask: 1,
        localPlayerBit: 1,
        playerLevel: heroLevelBefore,
        monsterLevel: unique ? monster.level - difficultyLevelBonus : monster.level,
        multiplayer: input.gameMode === 'multi',
        totalExperience,
        curve,
      });
      const expectedDamageTaken = Math.max(0, result.expectedPlayerSwingsToKill - 1)
        * result.expectedMonsterDamagePerSwing / FIXED_POINT;
      return {
        wrapper,
        xp: xp.granted,
        seconds: result.expectedPlayerSecondsToKill,
        playerHitChance: result.playerHitChance,
        expectedDamageTaken,
      };
    });
    const divisor = rows.length;
    const meanXp = rows.reduce((sum, row) => sum + row.xp, 0) / divisor;
    const uncappedXp = meanXp * ambientPopulation;
    const expectedXpGained = Math.min(uncappedXp, Math.max(0, maximumExperience - totalExperience));
    const expectedSeconds = rows.reduce((sum, row) => sum + row.seconds, 0) / divisor * ambientPopulation;
    const expectedDamage = rows.reduce((sum, row) => sum + row.expectedDamageTaken, 0) / divisor * ambientPopulation;
    totalExperience += expectedXpGained;
    heroLevel = levelAt(totalExperience, heroLevelBefore, curve);
    const notes = [
      `Uniform expectation across ${pool.length} eligible ordinary type${pool.length === 1 ? '' : 's'}; ${ambientPopulation} sequential ambient kills.`,
      `${uniqueIds.length} eligible unique row${uniqueIds.length === 1 ? '' : 's'} excluded because actual roster and quest conditions are unresolved.`,
      ...(depth === 16 ? ['Depth 16 uses the range-eligible pool as an explicit proxy; d1-monster-type-selection says the engine skips its random draw for the authored fixed roster.'] : []),
    ];
    levels.push({
      depth,
      poolSize: pool.length,
      expectedMonstersKilled: ambientPopulation,
      expectedXpGained,
      heroLevelBefore,
      heroLevelAfter: heroLevel,
      expectedSecondsToClear: finiteOrNull(expectedSeconds),
      expectedDamageTaken: finiteOrNull(expectedDamage),
      hardestMonster: hardest(rows),
      note: notes.join(' '),
    });
  }

  return {
    model: 'deterministic-expectation',
    className: input.className,
    policy: input.policy,
    gameMode: input.gameMode,
    difficulty: input.difficulty,
    weaponId: input.weapon?.entity.id ?? null,
    assumptions: assumptions(tilesPerLevel, input.policy),
    levels,
  };
}

/** Build the runtime-only combat-map pseudo-wrapper promoted by the Diablo ingest CLI. */
export function descentEntity(input: SimulateDescentInput): ReferenceWrapper {
  const simulation = simulateDescent(input);
  const classWrapper = classWrapperFrom(input.wrappers, input.className);
  const id = `d1-descent-${input.className}`;
  const relevantFiles = [...new Set(input.wrappers
    .filter((wrapper) => ['characters', 'bestiary', 'progression-curves'].includes(wrapper.catalogId))
    .map((wrapper) => wrapper.entity.provenance.sourceFile))];
  const mappingVersion = contentHash([
    'd1-monster-type-selection', 'd1-unique-placement', 'd1-xp-award-law', 'd1-xp-curve-law',
    'combatMath', 'combatDuel', simulation.policy, simulation.gameMode, simulation.difficulty,
  ]);
  return {
    wrapperId: `${classWrapper.sourceId}:combat-map:${id}`,
    sourceId: classWrapper.sourceId,
    file: 'engine/descent-expectation',
    technique: 'engine-derived-expectation@1',
    key: id,
    keyKind: 'column',
    raw: {},
    rawHash: contentHash(simulation),
    catalogId: 'combat-map',
    mappingVersion,
    entity: {
      id,
      catalogId: 'combat-map',
      name: `Diablo I ${input.className} descent expectation`,
      categoryPath: ['Combat Map', 'Diablo I Descent'],
      lifecycle: 'planned',
      tags: ['diablo-descent', 'engine-derived', input.className],
      links: [
        { catalogId: 'characters', entityId: classWrapper.entity.id, role: 'simulates' },
        ...(input.weapon ? [{ catalogId: 'items', entityId: input.weapon.entity.id, role: 'weapon' }] : []),
      ],
      data: {
        kind: 'descent-expectation',
        difficultyCurve: simulation.levels,
        assumptions: simulation.assumptions,
        model: simulation.model,
        className: simulation.className,
        policy: simulation.policy,
        gameMode: simulation.gameMode,
        difficulty: simulation.difficulty,
        weaponId: simulation.weaponId,
      },
      provenance: {
        kind: 'ingest',
        sourceGame: DIABLO1_SOURCE.sourceGame,
        sourceProject: `${DIABLO1_SOURCE.sourceProject}; engine pinned at 4138a82`,
        sourceFile: relevantFiles.join(', '),
        sourceRow: `derived ${id} from eligible pools at depths 1-16`,
        licenceNote: DIABLO1_SOURCE.licenceNote,
        ingestedAt: classWrapper.entity.provenance.ingestedAt,
        canonProfile: 'diablo1',
      },
    },
  };
}
