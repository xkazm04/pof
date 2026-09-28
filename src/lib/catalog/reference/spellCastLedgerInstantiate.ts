import { castTiming } from '@/lib/catalog/reference/combatMath';
import {
  missileBehaviourGraph,
  resolveMissileKinetics,
  type ResolvedMissileKinetics,
} from '@/lib/catalog/reference/missileBehaviourGraphs';
import {
  MISSILE_SPAWNS,
  blockability,
  classifyMissileFlags,
  missileBehaviourSpec,
  spriteAnimLen,
  type MissileDamageType,
} from '@/lib/catalog/reference/missileSpecs';
import {
  resolvePlayerSpellHits,
  type PlayerSpellCollisionDamage,
  type ResolvedPlayerSpellHits,
} from '@/lib/catalog/reference/playerSpellHits';
import { referenceCaster, type ReferenceCaster } from '@/lib/catalog/reference/spellLaw';
import {
  damage,
  manaCost,
  scaleSpellEffect,
  type DamageRange,
  type HeroClass,
} from '@/lib/catalog/reference/spellMath';
import type { SpellCastLedger } from '@/lib/catalog/reference/spellCastLedger';
import type { ReferenceWrapper } from '@/lib/catalog/reference/wrapper';

const SPELL_LEVELS = Array.from({ length: 15 }, (_, index) => index + 1);
const CLASS_ROWS = [
  { folder: 'warrior', heroClass: 'Warrior' },
  { folder: 'rogue', heroClass: 'Rogue' },
  { folder: 'sorcerer', heroClass: 'Sorcerer' },
  { folder: 'monk', heroClass: 'Monk' },
  { folder: 'barbarian', heroClass: 'Barbarian' },
  { folder: 'bard', heroClass: 'Bard' },
] as const satisfies readonly { folder: string; heroClass: HeroClass }[];

export interface InstantiatedCastTiming {
  readonly frames: number;
  readonly releaseTick: number;
  readonly endTick: number;
  readonly releaseSeconds: number;
  readonly endSeconds: number;
}

export interface InstantiatedManaCost {
  /** Vanilla rules; Hellfire-only classes are retained so their class adjustment is explicit. */
  readonly diablo: number;
  /** Hellfire rules, including the Sorcerer half-cost branch. */
  readonly hellfire: number;
}

export interface InstantiatedDuration {
  readonly rule: string;
  readonly ticks: number | null;
  readonly kind: 'exact' | 'maximum' | 'damage-window' | 'indefinite-or-runtime';
}

export interface InstantiatedHitTopology {
  readonly maximumCollisionChecks: number;
  readonly maximumChecksPerTick: number;
  readonly collisionDamage: PlayerSpellCollisionDamage;
  readonly hitResult: ResolvedPlayerSpellHits['hitResult'];
  readonly groups: ResolvedPlayerSpellHits['groups'];
  readonly assumption: string;
}

export interface InstantiatedSpellLevel {
  readonly spellLevel: number;
  readonly manaByClass: Readonly<Partial<Record<HeroClass, InstantiatedManaCost>>>;
  readonly damage?: DamageRange;
  readonly duration: InstantiatedDuration;
  readonly hits?: InstantiatedHitTopology;
}

export interface InstantiatedMissileNode {
  readonly missile: string;
  readonly parent: string | null;
  readonly depth: number;
  readonly spawn: 'initial' | 'on hit' | 'on expiry' | 'per tick' | 'on cast' | 'on target action';
  readonly rowFound: boolean;
  readonly addFn?: string;
  readonly processFn?: string;
  readonly graphic?: string;
  readonly sounds: { readonly cast?: string; readonly hit?: string };
  readonly speed?: string | number;
  readonly damageColumns: Readonly<Record<string, string>>;
  readonly flags: readonly string[];
  readonly damageType?: MissileDamageType;
  readonly blockable: true | false | null;
  readonly engineDamageSource?: string;
  readonly engineCollision?: string;
  readonly damageUnits?: PlayerSpellCollisionDamage;
  readonly damageByLevel?: readonly { spellLevel: number; min: number; max: number; mean: number }[];
  readonly kineticsByLevel: readonly ResolvedMissileKinetics[];
}

export interface InstantiatedSpellCastLedger extends SpellCastLedger {
  readonly instantiated: true;
  readonly spellId: string;
  readonly row: {
    readonly manaCost: number;
    readonly minimumMana: number;
    readonly manaPerLevel: number;
    readonly bookLevel: number | null;
    readonly staffLevel: number | null;
    readonly scrollLevel: number | null;
    readonly staffCharges: { readonly minimum: number | null; readonly maximum: number | null };
    readonly soundId: string | null;
    readonly missiles: readonly string[];
  };
  readonly referenceCaster: ReferenceCaster;
  readonly castTimingByClass: Readonly<Partial<Record<HeroClass, InstantiatedCastTiming>>>;
  readonly levels: readonly InstantiatedSpellLevel[];
  readonly missileChain: readonly InstantiatedMissileNode[];
}

export interface InstantiatedSpellCastLedgerFinding {
  readonly dataset: 'spellMath' | 'playerSpellHits';
  readonly spell: string;
  readonly spellLevel: number;
  readonly field: string;
  readonly expected: string;
  readonly actual: string;
}

function requiredNumber(raw: Record<string, string>, columns: readonly string[], owner: string): number {
  for (const column of columns) {
    const value = raw[column];
    if (value !== undefined && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value);
  }
  throw new Error(`${owner} has no numeric ${columns.join(' or ')}`);
}

function optionalNumber(raw: Record<string, string>, columns: readonly string[]): number | null {
  for (const column of columns) {
    const value = raw[column];
    if (value !== undefined && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value);
  }
  return null;
}

function missilesOf(raw: Record<string, string>, fallback: readonly string[]): string[] {
  const values = (raw.missiles ?? '').split(',').map((value) => value.trim()).filter(Boolean);
  return values.length > 0 ? values : [...fallback];
}

interface RuntimeClass {
  readonly heroClass: HeroClass;
  readonly caster: ReferenceCaster;
  readonly timing: InstantiatedCastTiming;
}

function runtimeClasses(relatedRows: readonly ReferenceWrapper[]): RuntimeClass[] {
  return CLASS_ROWS.flatMap(({ folder, heroClass }) => {
    const attributes = relatedRows.find((row) => row.file === `classes/${folder}/attributes.tsv`);
    const animations = relatedRows.find((row) => row.file === `classes/${folder}/animations.tsv`);
    if (!attributes || !animations) return [];
    const caster = referenceCaster({ className: heroClass, attributes: attributes.raw, animations: animations.raw });
    const timing = castTiming({
      cast: { frames: caster.castingFrames, actionFrame: caster.castingActionFrame },
    });
    return [{
      heroClass,
      caster,
      timing: {
        frames: timing.frames,
        releaseTick: timing.releaseTicks,
        endTick: timing.ticks,
        releaseSeconds: timing.releaseSeconds,
        endSeconds: timing.seconds,
      },
    }];
  });
}

function damageAt(spell: string, spellLevel: number, caster: ReferenceCaster): DamageRange | undefined {
  try {
    return damage(spell, {
      spellLevel,
      characterLevel: caster.level,
      magic: caster.magic,
    });
  } catch (error) {
    if (error instanceof Error && (error.message.includes('does not deal damage')
      || error.message.includes('targetCurrentHPInternal'))) return undefined;
    throw error;
  }
}

function apocalypseAnimationTicks(relatedRows: readonly ReferenceWrapper[]): number | undefined {
  const boom = relatedRows.find((row) => row.file === 'missiles/misdat.tsv' && row.raw.id === 'ApocalypseBoom');
  if (!boom?.raw.graphic) return undefined;
  try {
    return spriteAnimLen(relatedRows, boom.raw.graphic, 0);
  } catch {
    return undefined;
  }
}

function hitTopology(
  spell: string,
  spellLevel: number,
  caster: ReferenceCaster,
  relatedRows: readonly ReferenceWrapper[],
): ResolvedPlayerSpellHits {
  const apocalypseTicks = apocalypseAnimationTicks(relatedRows);
  return resolvePlayerSpellHits(spell, {
    spellLevel,
    characterLevel: caster.level,
    targetDistance: 1,
    ...(apocalypseTicks === undefined ? {} : { apocalypseBoomAnimationTicks: apocalypseTicks }),
  });
}

function durationAt(
  rule: string,
  spellLevel: number,
  characterLevel: number,
  hits: ResolvedPlayerSpellHits | undefined,
): InstantiatedDuration {
  if (rule === 'immediate' || rule.startsWith('effect immediate') || rule.startsWith('immediate after')) {
    return { rule, ticks: 0, kind: 'exact' };
  }
  if (/^\d+$/.test(rule)) return { rule, ticks: Number(rule), kind: 'exact' };

  const fireWall = /(\d+) when S=0; (\d+)\*\(S\+1\) when S>0/.exec(rule);
  if (fireWall) {
    const ticks = spellLevel === 0 ? Number(fireWall[1]) : Number(fireWall[2]) * (spellLevel + 1);
    return { rule, ticks, kind: 'exact' };
  }
  const stoneCurse = /(\d+)\*min\(S\+(\d+),(\d+)\)/.exec(rule);
  if (stoneCurse) {
    const ticks = Number(stoneCurse[1]) * Math.min(spellLevel + Number(stoneCurse[2]), Number(stoneCurse[3]));
    return { rule, ticks, kind: 'exact' };
  }
  const scaled = /Scale\((\d+),S\)/.exec(rule);
  if (scaled) return { rule, ticks: scaleSpellEffect(Number(scaled[1]), spellLevel), kind: 'exact' };
  const guardian = /max\((\d+),(\d+)\*min\(S\+trunc\(C\/(\d+)\),(\d+)\)\)/.exec(rule);
  if (guardian) {
    return {
      rule,
      ticks: Math.max(
        Number(guardian[1]),
        Number(guardian[2]) * Math.min(
          spellLevel + Math.trunc(characterLevel / Number(guardian[3])),
          Number(guardian[4]),
        ),
      ),
      kind: 'exact',
    };
  }
  const segmentRule = /segment floor\(S\/(\d+)\)\+(\d+)/.exec(rule);
  if (segmentRule) {
    const segment = hits?.groups[0]?.collisionChecks
      ?? Math.trunc(spellLevel / Number(segmentRule[1])) + Number(segmentRule[2]);
    return { rule, ticks: segment, kind: 'damage-window' };
  }
  const fixedSegments = /segments ((?:\d+,?)+)/.exec(rule);
  if (fixedSegments) {
    const ticks = Math.max(...fixedSegments[1].split(',').map(Number));
    return { rule, ticks, kind: 'maximum' };
  }

  const maximums = [...rule.matchAll(/(?:at most|initial|retarget|controller|ball)\s+(\d+)/g)]
    .map((match) => Number(match[1]));
  if (maximums.length > 0) return { rule, ticks: Math.max(...maximums), kind: 'maximum' };
  return { rule, ticks: null, kind: 'indefinite-or-runtime' };
}

function instantiatedHits(resolved: ResolvedPlayerSpellHits): InstantiatedHitTopology {
  let maximumChecksPerTick = resolved.maximumCollisionChecks === 0 ? 0 : 1;
  if (resolved.source?.kind === 'lightning-segment') maximumChecksPerTick = resolved.groups.length;
  if (resolved.source?.kind === 'nova-ray') maximumChecksPerTick = resolved.groups[0]?.collisionChecks ?? 0;
  return {
    maximumCollisionChecks: resolved.maximumCollisionChecks,
    maximumChecksPerTick,
    collisionDamage: resolved.collisionDamage,
    hitResult: resolved.hitResult,
    groups: resolved.groups,
    assumption: resolved.stationaryAssumption,
  };
}

interface ChainSeed {
  readonly missile: string;
  readonly parent: string | null;
  readonly depth: number;
  readonly spawn: InstantiatedMissileNode['spawn'];
}

function missileSeeds(initialMissiles: readonly string[], allowedMissiles: ReadonlySet<string>): ChainSeed[] {
  const seeds: ChainSeed[] = initialMissiles.map((missile) => ({ missile, parent: null, depth: 0, spawn: 'initial' }));
  const seen = new Set(initialMissiles);
  for (let index = 0; index < seeds.length; index++) {
    const parent = seeds[index];
    for (const edge of MISSILE_SPAWNS.filter((candidate) => candidate.parent === parent.missile)) {
      if (!allowedMissiles.has(edge.child) || seen.has(edge.child)) continue;
      seen.add(edge.child);
      seeds.push({ missile: edge.child, parent: parent.missile, depth: parent.depth + 1, spawn: edge.when });
    }
  }
  for (const child of allowedMissiles) {
    if (seen.has(child)) continue;
    const parent = seeds.find((candidate) => missileBehaviourGraph(candidate.missile)
      ?.spawns.some((spawn) => spawn.missile === child));
    if (!parent) continue;
    seen.add(child);
    seeds.push({
      missile: child,
      parent: parent.missile,
      depth: parent.depth + 1,
      spawn: child === 'ResurrectBeam' ? 'on target action' : 'on cast',
    });
  }
  return seeds;
}

function missileDamageColumns(raw: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(raw).filter(([column, value]) =>
    /damage|(^|_)dam($|_)/i.test(column) && value.trim() !== ''));
}

function rowSpeed(raw: Record<string, string>): string | number | undefined {
  const column = ['speed', 'velocity', 'missileSpeed'].find((candidate) => raw[candidate]?.trim());
  if (!column) return undefined;
  const value = raw[column];
  return Number.isFinite(Number(value)) ? Number(value) : value;
}

function missileChain(
  ledger: SpellCastLedger,
  initialMissiles: readonly string[],
  relatedRows: readonly ReferenceWrapper[],
  levels: readonly InstantiatedSpellLevel[],
  characterLevel: number,
): InstantiatedMissileNode[] {
  const allowed = new Set([...initialMissiles, ...ledger.spawnedMissiles]);
  const seeds = missileSeeds(initialMissiles, allowed);
  const candidates = seeds.flatMap((seed) => {
    const row = relatedRows.find((candidate) => candidate.file === 'missiles/misdat.tsv'
      && candidate.raw.id === seed.missile);
    const specification = row
      ? missileBehaviourSpec(row.raw.addFn ?? '', row.raw.processFn ?? '')
      : undefined;
    const damageSource = specification?.damageSource.toLowerCase() ?? '';
    const collision = specification?.collision.toLowerCase() ?? '';
    const canDamage = damageSource !== '' && !damageSource.startsWith('none')
      && !collision.includes('no collision') && !collision.includes('controller does not')
      && !collision.includes('turret itself does not');
    return canDamage ? [{ missile: seed.missile, depth: seed.depth }] : [];
  });
  const damagingDepth = candidates.length > 0 ? Math.max(...candidates.map((candidate) => candidate.depth)) : -1;
  const computedDamage = levels.flatMap((level) => level.damage
    ? [{ spellLevel: level.spellLevel, ...level.damage }]
    : []);
  const damageUnits = levels.find((level) => level.hits)?.hits?.collisionDamage;

  return seeds.map((seed): InstantiatedMissileNode => {
    const row = relatedRows.find((candidate) => candidate.file === 'missiles/misdat.tsv'
      && candidate.raw.id === seed.missile);
    const raw = row?.raw ?? {};
    const specification = row
      ? missileBehaviourSpec(raw.addFn ?? '', raw.processFn ?? '')
      : undefined;
    const speed = rowSpeed(raw) ?? specification?.speed;
    let flags: string[] = [];
    let damageType: MissileDamageType | undefined;
    if (raw.flags?.trim()) {
      const classified = classifyMissileFlags(raw.flags);
      flags = classified.flags;
      damageType = classified.damageType;
    }
    const carriesComputedDamage = seed.depth === damagingDepth
      && candidates.some((candidate) => candidate.missile === seed.missile);
    return {
      missile: seed.missile,
      parent: seed.parent,
      depth: seed.depth,
      spawn: seed.spawn,
      rowFound: row !== undefined,
      ...(raw.addFn ? { addFn: raw.addFn } : {}),
      ...(raw.processFn ? { processFn: raw.processFn } : {}),
      ...(raw.graphic ? { graphic: raw.graphic } : {}),
      sounds: {
        ...(raw.castSound ? { cast: raw.castSound } : {}),
        ...(raw.hitSound ? { hit: raw.hitSound } : {}),
      },
      ...(speed === undefined ? {} : { speed }),
      damageColumns: missileDamageColumns(raw),
      flags,
      ...(damageType ? { damageType } : {}),
      blockable: blockability(raw.movementDistribution ?? ''),
      ...(specification ? {
        engineDamageSource: specification.damageSource,
        engineCollision: specification.collision,
      } : {}),
      ...(carriesComputedDamage && damageUnits ? {
        damageUnits,
        damageByLevel: computedDamage,
      } : {}),
      kineticsByLevel: levels.map((level) => resolveMissileKinetics(
        seed.missile,
        level.spellLevel,
        characterLevel,
        relatedRows,
      )),
    };
  });
}

/** Instantiate one code-owned cast sequence with values from that spell's runtime wrapper graph. */
export function instantiateSpellCastLedger(
  ledger: SpellCastLedger,
  spellWrapper: ReferenceWrapper,
  relatedRows: readonly ReferenceWrapper[],
): InstantiatedSpellCastLedger {
  const owner = spellWrapper.entity.id;
  const raw = spellWrapper.raw;
  const spell = raw.id ?? spellWrapper.key;
  const manaBase = requiredNumber(raw, ['manaCost'], owner);
  const minimumMana = requiredNumber(raw, ['minMana', 'minimumMana'], owner);
  const manaPerLevel = requiredNumber(raw, ['manaMultiplier', 'manaAdj', 'manaPerLevel'], owner);
  const initialMissiles = missilesOf(raw, ledger.initialMissiles);
  const classes = runtimeClasses(relatedRows);
  if (classes.length === 0) throw new Error(`${owner} has no related class attribute/animation rows`);
  const reference = classes.find((entry) => entry.heroClass === 'Sorcerer') ?? classes[0];
  const healing = relatedRows.find((row) => row.file === 'spells/spelldat.tsv' && row.raw.id === 'Healing');
  const healingBaseMana = healing ? optionalNumber(healing.raw, ['manaCost']) ?? undefined : undefined;
  const levels = SPELL_LEVELS.map((spellLevel): InstantiatedSpellLevel => {
    const evaluatedDamage = damageAt(spell, spellLevel, reference.caster);
    let resolvedHits: ResolvedPlayerSpellHits | undefined;
    if (evaluatedDamage) {
      try {
        resolvedHits = hitTopology(spell, spellLevel, reference.caster, relatedRows);
      } catch (error) {
        if (!(error instanceof Error && error.message.includes('apocalypseBoomAnimationTicks'))) throw error;
      }
    }
    const manaByClass = Object.fromEntries(classes.map(({ heroClass, caster }) => {
      const input = {
        spellLevel,
        baseMana: manaBase,
        manaAdj: manaPerLevel,
        minMana: minimumMana,
        characterLevel: reference.caster.level,
        maxManaBaseInternal: Math.round(caster.maxMana * 64),
        ...(healingBaseMana === undefined ? {} : { healingBaseMana }),
      };
      return [heroClass, {
        diablo: manaCost(spell, { ...input, hellfire: false }, heroClass),
        hellfire: manaCost(spell, { ...input, hellfire: true }, heroClass),
      }];
    })) as Partial<Record<HeroClass, InstantiatedManaCost>>;
    return {
      spellLevel,
      manaByClass,
      ...(evaluatedDamage ? { damage: evaluatedDamage } : {}),
      duration: durationAt(ledger.durationRule, spellLevel, reference.caster.level, resolvedHits),
      ...(resolvedHits ? { hits: instantiatedHits(resolvedHits) } : {}),
    };
  });
  return {
    ...ledger,
    instantiated: true,
    spellId: spellWrapper.entity.id,
    initialMissiles,
    row: {
      manaCost: manaBase,
      minimumMana,
      manaPerLevel,
      bookLevel: optionalNumber(raw, ['bookLevel']),
      staffLevel: optionalNumber(raw, ['staffLevel']),
      scrollLevel: optionalNumber(raw, ['scrollLevel']),
      staffCharges: {
        minimum: optionalNumber(raw, ['staffMin', 'staffChargesMinimum']),
        maximum: optionalNumber(raw, ['staffMax', 'staffChargesMaximum']),
      },
      soundId: raw.soundId?.trim() || null,
      missiles: initialMissiles,
    },
    referenceCaster: reference.caster,
    castTimingByClass: Object.fromEntries(classes.map((entry) => [entry.heroClass, entry.timing])),
    levels,
    missileChain: missileChain(ledger, initialMissiles, relatedRows, levels, reference.caster.level),
  };
}

const compared = (value: unknown): string => JSON.stringify(value);

/** Independent parity check for the instantiated scalar series; only disagreements are returned. */
export function auditInstantiatedSpellCastLedger(
  ledger: InstantiatedSpellCastLedger,
): InstantiatedSpellCastLedgerFinding[] {
  const findings: InstantiatedSpellCastLedgerFinding[] = [];
  for (const level of ledger.levels) {
    const expectedDamage = damageAt(ledger.spell, level.spellLevel, ledger.referenceCaster);
    if (compared(expectedDamage) !== compared(level.damage)) {
      findings.push({
        dataset: 'spellMath', spell: ledger.spell, spellLevel: level.spellLevel, field: 'damage',
        expected: compared(expectedDamage), actual: compared(level.damage),
      });
    }
    for (const [heroClass, actual] of Object.entries(level.manaByClass) as [HeroClass, InstantiatedManaCost][]) {
      const input = {
        spellLevel: level.spellLevel,
        baseMana: ledger.row.manaCost,
        manaAdj: ledger.row.manaPerLevel,
        minMana: ledger.row.minimumMana,
        characterLevel: ledger.referenceCaster.level,
        maxManaBaseInternal: Math.round(ledger.referenceCaster.maxMana * 64),
        ...(ledger.spell === 'Healing' ? { healingBaseMana: ledger.row.manaCost } : {}),
      };
      const expected = {
        diablo: manaCost(ledger.spell, { ...input, hellfire: false }, heroClass),
        hellfire: manaCost(ledger.spell, { ...input, hellfire: true }, heroClass),
      };
      if (compared(expected) !== compared(actual)) {
        findings.push({
          dataset: 'spellMath', spell: ledger.spell, spellLevel: level.spellLevel,
          field: `manaByClass.${heroClass}`, expected: compared(expected), actual: compared(actual),
        });
      }
    }
    if (!level.damage) continue;
    const expectedHits = instantiatedHits(resolvePlayerSpellHits(ledger.spell, {
      spellLevel: level.spellLevel,
      characterLevel: ledger.referenceCaster.level,
      targetDistance: 1,
    }));
    if (compared(expectedHits) !== compared(level.hits)) {
      findings.push({
        dataset: 'playerSpellHits', spell: ledger.spell, spellLevel: level.spellLevel, field: 'hits',
        expected: compared(expectedHits), actual: compared(level.hits),
      });
    }
  }
  return findings;
}
