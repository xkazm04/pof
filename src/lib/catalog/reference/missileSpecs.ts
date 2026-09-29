/** Diablo I missile projections, engine behaviours, and spell/monster usage links. */
import { REFERENCE_GAP } from '@/lib/catalog/acceptance/markers';
import { SOURCED_FIELD, type SourcedStamp } from '@/lib/catalog/acceptance/sourced';
import { D1_AI_ROUTINES_DATA } from '@/lib/catalog/reference/aiRoutinesData';
import {
  MONSTER_MISSILE_DAMAGE_SOURCES_DATA,
} from '@/lib/catalog/reference/monsterMissileDamageData';
import type {
  MonsterMissileDamageFormula,
  MonsterMissileDamageSource,
  MonsterMissileHitCount,
  MonsterPersistentHitBehavior,
} from '@/lib/catalog/reference/monsterMissileDamage';
import {
  DIABLO1_MISSILE_LAWS,
  MISSILE_BEHAVIOUR_SPECS_DATA,
  MISSILE_SPAWNS_DATA,
  UNREACHABLE_MISSILE_REASONS_DATA,
  UNREACHABLE_MISSILE_REASON_REFS,
} from '@/lib/catalog/reference/missileSpecsData';
import { SPELL_SPECS_DATA } from '@/lib/catalog/reference/spellSpecsData';
import type { StepSeed } from '@/lib/catalog/reference/stepSeeds';
import type { ReferenceWrapper } from '@/lib/catalog/reference/wrapper';

export type MissileDamageType = 'Physical' | 'Fire' | 'Lightning' | 'Magic' | 'Acid';

export interface MissileBehaviourSpecData {
  readonly addFn: string | null;
  readonly processFn: string | null;
  readonly missileIds: readonly string[];
  readonly movement: string;
  readonly speed: string;
  readonly lifetime: string;
  readonly collision: string;
  readonly damageSource: string;
  readonly refs: readonly string[];
}

export interface MissileUsageLink {
  readonly owner: string;
  readonly missiles: readonly string[];
  readonly hellfire: boolean;
}

export interface MissileSpawn {
  readonly parent: string;
  readonly child: string;
  readonly when: 'on hit' | 'on expiry' | 'per tick' | 'on cast';
  readonly refs: readonly string[];
}

export interface MissileReachability {
  readonly missile: string;
  readonly directOwners: readonly string[];
  /** Shortest chain from a directly owned missile to this missile, excluding this missile. */
  readonly spawnedBy: readonly string[];
  readonly reachable: boolean;
  readonly unreachableReason?: string;
}

export interface UnusedMissileReason {
  readonly missile: string;
  readonly reason: string;
  readonly refs: readonly string[];
}

export interface MonsterMissileDamageSummary {
  readonly byRoutine: readonly {
    readonly routine: string;
    readonly damageSource: MonsterMissileDamageFormula;
    readonly representation: MonsterMissileDamageSource['collision'];
    readonly projectilesPerAttack: number;
    readonly hitCount: MonsterMissileHitCountSummary;
    readonly persistentChild?: {
      readonly missile: string;
      readonly damageSource: MonsterMissileDamageFormula;
      readonly representation: MonsterMissileDamageSource['collision'];
      readonly hitCount: MonsterMissileHitCountSummary;
    };
  }[];
}

export type MonsterMissileHitCountSummary =
  | { readonly kind: 'fixed'; readonly hits: number; readonly persistent?: Omit<MonsterPersistentHitBehavior, 'refs'> }
  | Omit<Extract<MonsterMissileHitCount, { kind: 'targeted-path' }>, 'refs'>
  | Omit<Extract<MonsterMissileHitCount, { kind: 'random-duration' }>, 'refs'>;

export const MISSILE_BEHAVIOUR_SPECS: readonly MissileBehaviourSpecData[] =
  MISSILE_BEHAVIOUR_SPECS_DATA;

export const MISSILE_SPAWNS: readonly MissileSpawn[] = MISSILE_SPAWNS_DATA;

export { DIABLO1_MISSILE_LAWS };

const DAMAGE_FLAGS = new Set<MissileDamageType>(['Physical', 'Fire', 'Lightning', 'Magic', 'Acid']);
const KNOWN_FLAGS = new Set<string>([...DAMAGE_FLAGS, 'Arrow', 'Invisible']);

export const MISSILE_FLAG_CLASSIFICATION = {
  Physical: 'data.damageType',
  Fire: 'data.damageType',
  Lightning: 'data.damageType',
  Magic: 'data.damageType',
  Acid: 'data.damageType',
  Arrow: 'data.arrow',
  Invisible: 'data.invisible',
} as const;

export function classifyMissileFlags(raw: string): {
  flags: string[];
  damageType: MissileDamageType;
  arrow: boolean;
  invisible: boolean;
} {
  const flags = raw.split(',').map((flag) => flag.trim()).filter(Boolean);
  const unknown = flags.filter((flag) => !KNOWN_FLAGS.has(flag));
  if (unknown.length) throw new Error(`Unknown missile flag(s): ${unknown.join(', ')}`);
  const damageTypes = flags.filter((flag): flag is MissileDamageType => DAMAGE_FLAGS.has(flag as MissileDamageType));
  if (damageTypes.length !== 1) {
    throw new Error(`Expected exactly one missile damage flag, got ${damageTypes.join(', ') || '(none)'}`);
  }
  return {
    flags,
    damageType: damageTypes[0],
    arrow: flags.includes('Arrow'),
    invisible: flags.includes('Invisible'),
  };
}

export function blockability(raw: string): true | false | null {
  if (raw === 'Blockable') return true;
  if (raw === 'Unblockable') return false;
  if (raw === '') return null;
  throw new Error(`Unknown missile movement distribution: ${raw}`);
}

const behaviourKey = (addFn: string, processFn: string): string => `${addFn}\u0000${processFn}`;
const SPEC_BY_PAIR = new Map(
  MISSILE_BEHAVIOUR_SPECS.map((specification) => [
    behaviourKey(specification.addFn ?? '', specification.processFn ?? ''),
    specification,
  ]),
);

export function missileBehaviourSpec(addFn: string, processFn: string): MissileBehaviourSpecData | undefined {
  return SPEC_BY_PAIR.get(behaviourKey(addFn, processFn));
}

function soundsOf(raw: ReferenceWrapper['raw']): { cast?: string; hit?: string } {
  return {
    ...(raw.castSound ? { cast: raw.castSound } : {}),
    ...(raw.hitSound ? { hit: raw.hitSound } : {}),
  };
}

function summarizeHitCount(hitCount: MonsterMissileHitCount): MonsterMissileHitCountSummary {
  if (hitCount.kind === 'fixed') {
    return {
      kind: hitCount.kind,
      hits: hitCount.hits,
      ...(hitCount.persistent ? {
        persistent: {
          collisionChecks: hitCount.persistent.collisionChecks,
          segmentsAtTarget: hitCount.persistent.segmentsAtTarget,
          hitDeletesMissile: hitCount.persistent.hitDeletesMissile,
          repeatChecksSamePlayer: hitCount.persistent.repeatChecksSamePlayer,
          stationaryAssumption: hitCount.persistent.stationaryAssumption,
          geometry: hitCount.persistent.geometry,
        },
      } : {}),
    };
  }
  if (hitCount.kind === 'targeted-path') {
    return {
      kind: hitCount.kind,
      collisionChecksByTargetTile: hitCount.collisionChecksByTargetTile,
      maxSegments: hitCount.maxSegments,
      hitDeletesMissile: hitCount.hitDeletesMissile,
      repeatChecksSamePlayer: hitCount.repeatChecksSamePlayer,
      stationaryAssumption: hitCount.stationaryAssumption,
      geometry: hitCount.geometry,
    };
  }
  return {
    kind: hitCount.kind,
    ticksPerIntelligence: hitCount.ticksPerIntelligence,
    intelligenceOffset: hitCount.intelligenceOffset,
    randomAdditionalTicks: hitCount.randomAdditionalTicks,
    endingAnimation: hitCount.endingAnimation,
    hitDeletesMissile: hitCount.hitDeletesMissile,
    repeatChecksSamePlayer: hitCount.repeatChecksSamePlayer,
    stationaryAssumption: hitCount.stationaryAssumption,
    geometry: hitCount.geometry,
  };
}

/** Normalize compound enums at promotion while preserving the reusable raw wrapper. */
export function withMissileSpecs(
  wrappers: readonly ReferenceWrapper[],
  bestiaryWrappers: readonly ReferenceWrapper[] = wrappers,
): ReferenceWrapper[] {
  return wrappers.map((wrapper) => {
    if (wrapper.catalogId !== 'vfx' || wrapper.file !== 'missiles/misdat.tsv') return wrapper;
    const specification = missileBehaviourSpec(wrapper.raw.addFn ?? '', wrapper.raw.processFn ?? '');
    if (!specification) {
      throw new Error(`${wrapper.wrapperId}: no engine-derived missile spec for ${wrapper.raw.addFn || '(none)'}/${wrapper.raw.processFn || '(none)'}`);
    }
    const classified = classifyMissileFlags(wrapper.raw.flags ?? '');
    const missile = wrapper.raw.id ?? '';
    const routineLinks = MONSTER_AI_TO_MISSILES.filter((link) => link.missiles.includes(missile));
    const linkedRoutines = new Set(routineLinks.map((link) => link.owner));
    const hostLinks = bestiaryWrappers
      .filter((monster) => monster.catalogId === 'bestiary'
        && (monster.file === 'monsters/monstdat.tsv' || monster.file === 'monsters/unique_monstdat.tsv')
        && linkedRoutines.has(monster.raw.ai))
      .map((monster) => ({ catalogId: 'bestiary', entityId: monster.entity.id, role: 'host' }));
    const byRoutine = (MONSTER_MISSILE_DAMAGE_SOURCES_DATA as readonly MonsterMissileDamageSource[])
      .filter((source) => source.missile === missile)
      .flatMap((source) => source.routines.map((routine) => ({
        routine,
        damageSource: source.formula,
        representation: source.collision,
        projectilesPerAttack: source.projectilesPerAttack,
        hitCount: summarizeHitCount(source.hitCount),
        ...(source.persistentChild ? {
          persistentChild: {
            missile: source.persistentChild.missile,
            damageSource: source.persistentChild.formula,
            representation: source.persistentChild.collision,
            hitCount: summarizeHitCount(source.persistentChild.hitCount),
          },
        } : {}),
      }))) satisfies MonsterMissileDamageSummary['byRoutine'];
    const data: Record<string, unknown> = {
      ...wrapper.entity.data,
      behaviour: {
        ...(wrapper.raw.addFn ? { addFn: wrapper.raw.addFn } : {}),
        ...(wrapper.raw.processFn ? { processFn: wrapper.raw.processFn } : {}),
      },
      sounds: soundsOf(wrapper.raw),
      damageType: classified.damageType,
      flags: classified.flags,
      blockable: blockability(wrapper.raw.movementDistribution ?? ''),
      engineSpec: specification,
    };
    if (byRoutine.length > 0) data.monsterDamage = { byRoutine };
    else delete data.monsterDamage;
    if (wrapper.raw.graphic) data.graphic = wrapper.raw.graphic;
    else delete data.graphic;
    if (classified.arrow) data.arrow = true;
    else delete data.arrow;
    if (classified.invisible) data.invisible = true;
    else delete data.invisible;
    const links = [
      ...(wrapper.entity.links ?? []).filter((link) => link.catalogId !== 'bestiary' || link.role !== 'host'),
      ...hostLinks,
    ];
    return { ...wrapper, entity: { ...wrapper.entity, links, data } };
  });
}

/** Read the selected animation-group length from a projected missile sprite wrapper. */
export function spriteAnimLen(
  wrappers: readonly ReferenceWrapper[],
  graphicId: string,
  direction: number,
): number {
  if (!Number.isInteger(direction) || direction < 0 || direction >= 16) {
    throw new Error(`missile sprite direction must be an integer from 0 to 15 (got ${direction})`);
  }
  const wrapper = wrappers.find((candidate) => candidate.catalogId === 'vfx'
    && candidate.file === 'missiles/missile_sprites.tsv'
    && String(candidate.raw.id) === graphicId);
  if (!wrapper) throw new Error(`the supplied wrappers have no missile_sprites.tsv row for ${graphicId}`);
  const frameLength = wrapper.entity.data.frameLength;
  if (!Array.isArray(frameLength) || frameLength.length !== 16
    || frameLength.some((value) => !Number.isInteger(value) || value < 0)) {
    throw new Error(`${wrapper.entity.id} has no valid 16-entry data.frameLength`);
  }
  return frameLength[direction] as number;
}

const splitMissileExpression = (value: string): string[] =>
  value.split(/[|+]/).map((missile) => missile.trim()).filter((missile) => missile !== '' && missile !== 'none');

export const SPELL_TO_MISSILES: readonly MissileUsageLink[] = SPELL_SPECS_DATA
  .filter((spell) => spell.missiles.length > 0)
  .map((spell) => ({ owner: spell.spell, missiles: [...spell.missiles], hellfire: false }));

export const MONSTER_AI_TO_MISSILES: readonly MissileUsageLink[] = Object.entries(D1_AI_ROUTINES_DATA)
  .map(([owner, routine]) => ({
    owner,
    missiles: [...new Set(routine.attacks.flatMap((attack) => splitMissileExpression(attack.missile)))],
    hellfire: routine.hellfire,
  }))
  .filter((link) => link.missiles.length > 0);

export function computeMissileReachability(
  missiles: readonly string[],
  spellLinks: readonly MissileUsageLink[],
  monsterLinks: readonly MissileUsageLink[],
  spawns: readonly MissileSpawn[],
  unreachableReasons: Readonly<Record<string, string>> = {},
): Readonly<Record<string, MissileReachability>> {
  const missileSet = new Set(missiles);
  const directOwners = new Map<string, string[]>();
  const addOwners = (kind: string, links: readonly MissileUsageLink[]) => {
    for (const link of links) {
      for (const missile of link.missiles) {
        if (!missileSet.has(missile)) continue;
        const owners = directOwners.get(missile) ?? [];
        owners.push(`${kind}:${link.owner}`);
        directOwners.set(missile, owners);
      }
    }
  };
  addOwners('spell', spellLinks);
  addOwners('monster-ai', monsterLinks);

  const children = new Map<string, string[]>();
  for (const edge of spawns) {
    if (!missileSet.has(edge.parent) || !missileSet.has(edge.child)) continue;
    const values = children.get(edge.parent) ?? [];
    if (!values.includes(edge.child)) values.push(edge.child);
    children.set(edge.parent, values);
  }

  const paths = new Map<string, string[]>();
  const queue: string[] = [];
  for (const missile of missiles) {
    if (!directOwners.has(missile)) continue;
    paths.set(missile, []);
    queue.push(missile);
  }
  for (let index = 0; index < queue.length; index++) {
    const parent = queue[index];
    const parentPath = paths.get(parent)!;
    for (const child of children.get(parent) ?? []) {
      if (paths.has(child)) continue;
      paths.set(child, [...parentPath, parent]);
      queue.push(child);
    }
  }

  return Object.fromEntries(missiles.map((missile) => {
    const path = paths.get(missile);
    return [missile, {
      missile,
      directOwners: directOwners.get(missile) ?? [],
      spawnedBy: path ?? [],
      reachable: path != null,
      ...(path == null && unreachableReasons[missile] != null
        ? { unreachableReason: unreachableReasons[missile] }
        : {}),
    }];
  }));
}

const VANILLA_MISSILES = [...new Set(
  MISSILE_BEHAVIOUR_SPECS.flatMap((specification) => specification.missileIds),
)];

export const MISSILE_REACHABILITY = computeMissileReachability(
  VANILLA_MISSILES,
  SPELL_TO_MISSILES,
  MONSTER_AI_TO_MISSILES,
  MISSILE_SPAWNS,
  UNREACHABLE_MISSILE_REASONS_DATA,
);

/** Vanilla missile enum entries unreachable from spell/monster owners, including transitive spawns. */
export const UNUSED_MISSILES: readonly string[] = VANILLA_MISSILES
  .filter((missile) => !MISSILE_REACHABILITY[missile].reachable);

/** Pin-verified explanation for every missile that remains outside the spell/monster graph. */
export const UNUSED_MISSILE_REASONS: readonly UnusedMissileReason[] = UNUSED_MISSILES.map((missile) => ({
  missile,
  reason: UNREACHABLE_MISSILE_REASONS_DATA[missile as keyof typeof UNREACHABLE_MISSILE_REASONS_DATA],
  refs: UNREACHABLE_MISSILE_REASON_REFS[missile as keyof typeof UNREACHABLE_MISSILE_REASON_REFS],
}));

function stamp(wrapper: ReferenceWrapper, specification: MissileBehaviourSpecData, columns: string[]): SourcedStamp {
  const provenance = wrapper.entity.provenance;
  return {
    sourceGame: provenance.sourceGame,
    sourceFile: `${provenance.sourceFile}; Source/missiles.cpp`,
    sourceRow: provenance.sourceRow,
    columns: [...columns, ...specification.refs.map((ref) => `(engine ${ref})`)],
  };
}

const VFX_ART_GAPS = [
  'Concept Brief: the reference table and missile engine do not define a PoF Niagara art brief',
  'Mesh / Sprite: graphic names a source sprite id, not a target mesh or sprite candidate',
  'Material: the reference does not define a target material instance',
  'GPU / LOD Budget: the reference engine has no Niagara GPU timing or LOD budget',
  'Variants: the reference does not define target-system visual variants',
  'Icon 2D Art: the reference does not define a target VFX icon',
  'Test Gate: the reference has no PoF VFX runtime acceptance test',
  'UE Packaging: the reference has no UE asset manifest or package path',
] as const;

export function seedMissileSteps(wrapper: ReferenceWrapper): StepSeed[] {
  if (wrapper.catalogId !== 'vfx' || wrapper.file !== 'missiles/misdat.tsv') return [];
  const specification = missileBehaviourSpec(wrapper.raw.addFn ?? '', wrapper.raw.processFn ?? '');
  if (!specification) throw new Error(`${wrapper.wrapperId}: missing engine-derived missile behaviour`);
  const flags = classifyMissileFlags(wrapper.raw.flags ?? '');
  const sounds = soundsOf(wrapper.raw);
  const cues = Object.values(sounds);

  return [
    {
      catalogId: 'vfx', entityId: wrapper.entity.id, step: 'Behavior',
      data: {
        behavior: {
          emitters: wrapper.raw.graphic || REFERENCE_GAP,
          lifetime: specification.lifetime,
          spawnRate: REFERENCE_GAP,
          engine: {
            addFn: specification.addFn,
            processFn: specification.processFn,
            movement: specification.movement,
            speed: specification.speed,
            collision: specification.collision,
            damageSource: specification.damageSource,
            damageType: flags.damageType,
            blockable: blockability(wrapper.raw.movementDistribution ?? ''),
          },
        },
        [SOURCED_FIELD]: stamp(wrapper, specification, ['id', 'addFn', 'processFn', 'graphic', 'flags', 'movementDistribution']),
      },
      gaps: [
        'spawnRate: the reference uses sprite animation and simulation ticks, not particle spawn rate',
        'animNotify: Diablo I dispatches missiles from spell/monster code rather than a PoF animation notify',
        'wiringContract: the reference does not define PoF Niagara registration or activation wiring',
        ...VFX_ART_GAPS,
      ],
    },
    {
      catalogId: 'vfx', entityId: wrapper.entity.id, step: 'Sound Hook',
      data: {
        soundHook: {
          cues: cues.length ? cues : REFERENCE_GAP,
          animNotifyBinding: REFERENCE_GAP,
          sounds,
        },
        [SOURCED_FIELD]: stamp(wrapper, specification, ['castSound', 'hitSound']),
      },
      gaps: [
        ...(cues.length ? [] : ['cues: both source sound cells are blank, meaning this missile has no sound hook']),
        'animNotifyBinding: source sound ids are played by missile/spell code, not a PoF animation notify',
      ],
    },
  ];
}
