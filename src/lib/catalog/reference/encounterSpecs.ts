/** Diablo I named encounter entities and engine-sourced combat-map artifacts. */
import { REFERENCE_GAP } from '@/lib/catalog/acceptance/markers';
import { SOURCED_FIELD, type SourcedStamp } from '@/lib/catalog/acceptance/sourced';
import { DIABLO1_SOURCE } from '@/lib/catalog/ingest/diablo1';
import type { IngestedEntity } from '@/lib/catalog/ingest/run';
import { aggregateClassWrappers } from '@/lib/catalog/reference/classHeroes';
import { duel } from '@/lib/catalog/reference/combatDuel';
import { classCoefficients, monsterProfile, referenceBuild } from '@/lib/catalog/reference/combatInputs';
import { FIXED_POINT } from '@/lib/catalog/reference/combatMath';
import { simulateDescent } from '@/lib/catalog/reference/descentSim';
import { contentHash } from '@/lib/catalog/reference/hash';
import type { StepSeed } from '@/lib/catalog/reference/stepSeeds';
import type { ReferenceWrapper } from '@/lib/catalog/reference/wrapper';
import type { CatalogLink } from '@/lib/catalog/types';
import { DIABLO1_ENCOUNTER_LAWS, ENCOUNTER_SPECS_DATA } from '@/lib/catalog/reference/encounterSpecsData';

export interface EncounterMinionSpec {
  type: string;
  count: string;
  relation: string;
}

export interface EncounterSpecData {
  id: `d1-encounter-${string}`;
  name: string;
  location: `d1-${string}`;
  expectedDepth: number;
  boss: `d1-${string}`;
  quest: `d1-Q_${string}`;
  combat: boolean;
  minions: readonly EncounterMinionSpec[];
  trigger: string;
  arena: string;
  win: string;
  loss: string;
  special: string;
  refs: readonly string[];
}

export interface EncounterLawData {
  id: string;
  title: string;
  body: string;
  refs: readonly string[];
}

export interface EncounterDuel {
  model: 'combatDuel expected-value melee exchange';
  hero: 'warrior';
  heroLevel: number;
  expectedDepth: number;
  difficulty: 'normal';
  gameMode: 'single';
  playerHitChance: number;
  expectedPlayerDamagePerSwingHp: number;
  expectedPlayerHitsToKill: number;
  expectedPlayerSwingsToKill: number;
  expectedPlayerSecondsToKill: number | null;
  monsterHitChance: number;
  expectedMonsterDamagePerHitHp: number;
  expectedMonsterDamagePerSwingHp: number;
  expectedMonsterHitsToKillPlayer: number;
  expectedMonsterSwingsToKillPlayer: number;
  basis: string;
}

export interface EncounterEntityData {
  kind: 'combat' | 'scripted-noncombat';
  trigger: string;
  arena: string;
  win: string;
  loss: string;
  special: string;
  minions: readonly EncounterMinionSpec[];
  expectedDepth: number;
  stepGaps: Readonly<Record<string, string>>;
}

export type EncounterCatalogEntity = Omit<IngestedEntity, 'catalogId' | 'data'> & {
  catalogId: 'combat-map';
  data: EncounterEntityData;
};

export interface EncounterEntityWrapper {
  catalogId: 'combat-map';
  entity: EncounterCatalogEntity;
}

export const ENCOUNTER_SPECS: readonly EncounterSpecData[] = ENCOUNTER_SPECS_DATA;

export { DIABLO1_ENCOUNTER_LAWS };

const NON_FILLABLE_STEP_GAPS = {
  'Encounter Layout': 'The engine does not define PoF extent, elevation thresholds, tactical points, cover points, or UE wiring; 2D tile geometry is outside this specification.',
  Hazards: 'No requested encounter has a separately modeled encounter hazard; monster spells, props, and doors are not translated into PoF hazard actors.',
  Balance: 'combatDuel supplies expected duel values but no tier-normalized threat score, and omits AI delays, movement, healing, packs, summons, and arena gates.',
  '3D / Terrain': 'The engine names authored maps but defines no mesh candidates or UE assets; tile geometry is outside this specification.',
  Material: 'Dungeon and palette identity do not provide a resolvable material entity, physical surface, material instance, or UE wiring.',
  'Ambient / Audio': 'Coded greetings and speech cues do not define a complete encounter-specific ambient, combat, and music soundscape.',
  'Icon 2D Art': 'Monster sprite identity does not provide four encounter-icon candidates, a selected candidate, or a UE texture path.',
  'Test Gate': 'The engine behavior provides assertions but no registered UE automation test or runtime-deferred gate for these encounters.',
  'UE Packaging': 'The source provides no PoF arena actors, spawn volumes, gameplay effects, UE asset paths, packaging manifest, or wiring contract.',
} as const;

const concreteMinionIds = (minion: EncounterMinionSpec): string[] => minion.type
  .split('|')
  .map((part) => part.trim())
  .filter((part) => /^d1-[A-Za-z0-9_-]+$/.test(part));

const uniqueLinks = (links: readonly CatalogLink[]): CatalogLink[] => {
  const seen = new Set<string>();
  return links.filter((link) => {
    const key = `${link.catalogId}:${link.entityId}:${link.role}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

/** The generic unique-pack rule remains canon only; only the nine named encounters become entities. */
export function encounterEntities(): EncounterEntityWrapper[] {
  return ENCOUNTER_SPECS.map((spec) => {
    const links = uniqueLinks([
      { catalogId: 'zone-map', entityId: spec.location, role: 'location' },
      { catalogId: 'bestiary', entityId: spec.boss, role: 'boss' },
      ...spec.minions.flatMap(concreteMinionIds).map((entityId): CatalogLink => ({
        catalogId: 'bestiary', entityId, role: 'minion',
      })),
      { catalogId: 'quests', entityId: spec.quest, role: 'quest' },
    ]);
    return {
      catalogId: 'combat-map',
      entity: {
        id: spec.id,
        catalogId: 'combat-map',
        name: spec.name,
        categoryPath: ['Diablo I', 'Boss encounters'],
        lifecycle: 'planned',
        tags: ['diablo-encounter', spec.combat ? 'combat' : 'scripted-noncombat'],
        links,
        data: {
          kind: spec.combat ? 'combat' : 'scripted-noncombat',
          trigger: spec.trigger,
          arena: spec.arena,
          win: spec.win,
          loss: spec.loss,
          special: spec.special,
          minions: spec.minions,
          expectedDepth: spec.expectedDepth,
          stepGaps: {
            ...NON_FILLABLE_STEP_GAPS,
            ...(!spec.combat ? {
              'Waves & Spawns': 'Lachdanan never enters combat; a hostile wave or duel would contradict the pinned engine.',
            } : {}),
          },
        },
        provenance: {
          kind: 'ingest',
          sourceGame: DIABLO1_SOURCE.sourceGame,
          sourceProject: DIABLO1_SOURCE.sourceProject,
          sourceFile: spec.refs.join(', '),
          sourceRow: spec.id,
          licenceNote: DIABLO1_SOURCE.licenceNote,
          ingestedAt: '2026-09-27T00:00:00.000Z',
          canonProfile: 'diablo1',
        },
      },
    };
  });
}

const encounterSpec = (entityId: string): EncounterSpecData => {
  const spec = ENCOUNTER_SPECS.find((candidate) => candidate.id === entityId);
  if (!spec) throw new Error(`no Diablo I encounter specification for ${entityId}`);
  return spec;
};

/**
 * Derive hostile-boss duel values from the same expected hero levels as descentSim. The duel is
 * deliberately its simple melee-exchange model even for caster bosses; the limitation is retained
 * in the seed gaps instead of being hidden by encounter-specific guesses.
 */
export function encounterDuels(wrappers: readonly ReferenceWrapper[]): ReadonlyMap<string, EncounterDuel> {
  const simulation = simulateDescent({
    className: 'warrior', policy: 'none', gameMode: 'single', difficulty: 'normal', wrappers,
  });
  const warrior = aggregateClassWrappers(wrappers.filter((wrapper) => wrapper.catalogId === 'characters'))
    .find((wrapper) => wrapper.entity.id === 'd1-class-warrior');
  if (!warrior) throw new Error('the supplied wrappers have no d1-class-warrior aggregate');
  const coefficients = classCoefficients(warrior);
  const bestiaryById = new Map(wrappers
    .filter((wrapper) => wrapper.catalogId === 'bestiary')
    .map((wrapper) => [wrapper.entity.id, wrapper]));
  const ordinaryByType = new Map(wrappers
    .filter((wrapper) => wrapper.catalogId === 'bestiary' && wrapper.file === 'monsters/monstdat.tsv')
    .map((wrapper) => [wrapper.raw._monster_id, wrapper]));
  const results = new Map<string, EncounterDuel>();

  for (const spec of ENCOUNTER_SPECS.filter((candidate) => candidate.combat)) {
    const boss = bestiaryById.get(spec.boss);
    if (!boss) throw new Error(`${spec.id} references missing boss wrapper ${spec.boss}`);
    const base = boss.file === 'monsters/unique_monstdat.tsv' ? ordinaryByType.get(boss.raw.type) : undefined;
    if (boss.file === 'monsters/unique_monstdat.tsv' && !base) {
      throw new Error(`${spec.id} boss ${spec.boss} has no supplied monstdat base ${boss.raw.type}`);
    }
    const heroLevel = simulation.levels.find((level) => level.depth === spec.expectedDepth)?.heroLevelBefore;
    if (heroLevel == null) throw new Error(`${spec.id} has no descent result for depth ${spec.expectedDepth}`);
    const build = referenceBuild(warrior, heroLevel);
    const result = duel(build, coefficients, monsterProfile(boss, 'normal', base, 'single'), {
      gameMode: 'single', playerAttack: 'melee', playerDistance: 0,
      monsterAttack: 'melee', dungeonLevel: spec.expectedDepth,
    });
    results.set(spec.id, {
      model: 'combatDuel expected-value melee exchange',
      hero: 'warrior',
      heroLevel,
      expectedDepth: spec.expectedDepth,
      difficulty: 'normal',
      gameMode: 'single',
      playerHitChance: result.playerHitChance,
      expectedPlayerDamagePerSwingHp: result.expectedPlayerDamagePerSwing / FIXED_POINT,
      expectedPlayerHitsToKill: result.expectedPlayerHitsToKill,
      expectedPlayerSwingsToKill: result.expectedPlayerSwingsToKill,
      expectedPlayerSecondsToKill: result.expectedPlayerSecondsToKill,
      monsterHitChance: result.monsterHitChance,
      expectedMonsterDamagePerHitHp: result.expectedMonsterDamagePerHit / FIXED_POINT,
      expectedMonsterDamagePerSwingHp: result.expectedMonsterDamagePerSwing / FIXED_POINT,
      expectedMonsterHitsToKillPlayer: result.expectedMonsterHitsToKillPlayer,
      expectedMonsterSwingsToKillPlayer: result.expectedMonsterSwingsToKillPlayer,
      basis: 'Hero level is descentSim heroLevelBefore at the encounter depth. Base-stat, bare-handed Warrior; Normal single player; both sides use combatDuel melee at distance zero. AI delays, movement, spells, healing, packs, summons, and arena gates are omitted.',
    });
  }
  return results;
}

function stamp(entity: EncounterCatalogEntity, spec: EncounterSpecData, columns: string[]): SourcedStamp {
  return {
    sourceGame: entity.provenance.sourceGame,
    sourceFile: spec.refs.join(', '),
    sourceRow: spec.id,
    columns,
  };
}

function waveDetails(spec: EncounterSpecData) {
  return [{
    wave: 1,
    trigger: spec.trigger,
    waitForKillsBeforeNextWave: true,
    combatants: [
      { enemyArchetype: spec.boss, count: '1', relation: 'boss' },
      ...spec.minions.map((minion) => ({
        enemyArchetype: minion.type,
        count: minion.count,
        relation: minion.relation,
      })),
    ],
  }];
}

/** Build only the steps supported by the pinned engine; all missing checker fields are explicit gaps. */
export function seedEncounterSteps(
  entity: EncounterCatalogEntity,
  derivedDuel?: EncounterDuel,
): StepSeed[] {
  const spec = encounterSpec(entity.id);
  const brief = `${spec.name} is ${spec.combat ? 'a combat encounter' : 'an explicitly non-combat scripted encounter'} at ${spec.location}. ${spec.trigger} Arena: ${spec.arena} Combatants: ${spec.boss}${spec.minions.length ? ` with ${spec.minions.map((minion) => `${minion.count} ${minion.type}`).join('; ')}` : ' alone'}. Outcome: ${spec.win} Loss: ${spec.loss} Distinguishing rule: ${spec.special}`;
  const seeds: StepSeed[] = [{
    catalogId: 'combat-map', entityId: spec.id, step: 'Concept Brief',
    data: {
      brief,
      [SOURCED_FIELD]: stamp(entity, spec, ['trigger', 'arena', 'boss', 'minions', 'win', 'loss', 'special']),
    },
    gaps: [],
  }];

  if (spec.combat) {
    const links = entity.links?.filter((link) => link.catalogId === 'bestiary') ?? [];
    seeds.push({
      catalogId: 'combat-map', entityId: spec.id, step: 'Waves & Spawns',
      data: {
        waves: {
          areaLevel: REFERENCE_GAP,
          waveCount: 1,
          waitForKillsBeforeNextWave: true,
          waveDetails: waveDetails(spec),
          derivedDuel: derivedDuel ?? REFERENCE_GAP,
          wiringContract: REFERENCE_GAP,
        },
        links,
        [SOURCED_FIELD]: stamp(entity, spec, ['trigger', 'boss', 'minions', '(derived combatDuel + descentSim)']),
      },
      gaps: [
        'areaLevel: Diablo dungeon depth is not PoF areaLevel semantics',
        'wiringContract: the pinned engine defines no PoF spawn volumes, grants, dependencies, or UE verification',
        ...spec.minions.filter((minion) => minion.type.includes('${')).map((minion) =>
          `minion type/count: ${minion.count}; exact authored types and counts require the external DUN file`),
        ...(derivedDuel ? [
          'derivedDuel: expected-value reference only; it is not a tier-normalized Balance score and omits AI delays, movement, spells, healing, packs, summons, and arena gates',
        ] : ['derivedDuel: requires the source wrappers used by descentSim and combatDuel']),
      ],
    });
  }

  seeds.push({
    catalogId: 'combat-map', entityId: spec.id, step: 'Win/Loss Rules',
    data: {
      winLoss: {
        winCondition: spec.win,
        winDetail: spec.win,
        lossCondition: spec.loss,
        lossDetail: spec.loss,
        failSafe: REFERENCE_GAP,
        wiringContract: REFERENCE_GAP,
      },
      [SOURCED_FIELD]: stamp(entity, spec, ['win', 'loss']),
    },
    gaps: [
      'failSafe: the engine supplies no per-encounter retry or reset fail-safe',
      'wiringContract: the engine supplies no PoF or UE outcome-delegate wiring',
    ],
  });
  return seeds;
}

export const ENCOUNTER_MAPPING_VERSION = contentHash([
  'diablo1-encounters@1',
  ...DIABLO1_ENCOUNTER_LAWS.map((law) => law.id),
]);
