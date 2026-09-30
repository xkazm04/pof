/** Player-owned persistent/multi-collision spell topology and stationary-target resolution. */
import { PLAYER_SPELL_HIT_SOURCES_DATA } from '@/lib/catalog/reference/playerSpellHitsData';

export type PlayerSpellCollisionDamage = 'already-shifted-fixed-point' | 'whole-hit-points';
export type PlayerSpellDamageRoll = 'once-per-cast' | 'once-per-child' | 'once-per-segment' | 'once-per-projectile';
export type PlayerSpellHitResult =
  | 'persists-and-rechecks'
  | 'persists-without-rechecking-target'
  | 'flight-becomes-one-shot-blast'
  | 'child-deleted-on-hit'
  | 'stops-damaging-after-hit';
export type PlayerSpellPackGeometry =
  | 'aimed-line'
  | 'seeking-radius'
  | 'cross-line'
  | 'impact-3x3'
  | 'widening-wave'
  | 'radial-ring'
  | 'scanned-area';

interface PlayerSpellHitSourceBase {
  readonly spell: string;
  readonly collisionChecks: string;
  readonly damageRoll: PlayerSpellDamageRoll;
  readonly collisionDamage: PlayerSpellCollisionDamage;
  readonly hitResult: PlayerSpellHitResult;
  readonly stationaryGeometry: string;
  /** Engine topology only; compact-ring coverage is a separate named pack-model assumption. */
  readonly packGeometry?: PlayerSpellPackGeometry;
  readonly packBehaviour?: string;
  readonly refs: readonly string[];
}

export type PlayerSpellHitSource = PlayerSpellHitSourceBase & (
  | { readonly kind: 'lightning-segment'; readonly targetPaths: 'one' | 'direct-plus-radius' }
  | { readonly kind: 'adjacent-persistent' }
  | { readonly kind: 'wall-segment' }
  | { readonly kind: 'impact-and-blast' }
  | { readonly kind: 'guardian-volley' }
  | { readonly kind: 'moving-piercing-ray' }
  | { readonly kind: 'nova-ray' }
  | { readonly kind: 'targeted-segment' }
  | { readonly kind: 'until-first-hit' }
);

export type PlayerSpellCollisionMode = 'independent-repeat' | 'first-hit-gates-followup' | 'until-first-hit';

export interface PlayerSpellCollisionGroup {
  /** Maximum calls to MonsterMHit for one damage roll against this stationary target. */
  readonly collisionChecks: number;
  /** How successful checks affect later checks in this group. */
  readonly mode: PlayerSpellCollisionMode;
}

export interface PlayerSpellHitInput {
  readonly spellLevel: number;
  readonly characterLevel: number;
  /** Tile distance used only for coverage/fan-out geometry; MonsterMHit to-hit still uses distance zero. */
  readonly targetDistance?: number;
  /** Nova has a duplicated ball only along one of its four cardinal rays. */
  readonly novaCardinalRay?: boolean;
  /** Runtime sprite length from missile_sprites.tsv; required for Apocalypse retry resolution. */
  readonly apocalypseBoomAnimationTicks?: number;
}

export interface ResolvedPlayerSpellHits {
  readonly source?: PlayerSpellHitSource;
  readonly groups: readonly PlayerSpellCollisionGroup[];
  readonly maximumCollisionChecks: number;
  readonly collisionDamage: PlayerSpellCollisionDamage;
  readonly hitResult: PlayerSpellHitResult | 'deleted-on-hit';
  readonly stationaryAssumption: string;
}

export interface ResolvedPlayerSpellPackSecondaryHits {
  readonly geometry: PlayerSpellPackGeometry;
  readonly groups: readonly PlayerSpellCollisionGroup[];
  readonly maximumCollisionChecks: number;
  /** Fireball creates its neighbour blast only after the primary flight collision succeeds. */
  readonly activation: 'always' | 'primary-hit';
  readonly assumption: string;
}

export const PLAYER_SPELL_HIT_SOURCES: readonly PlayerSpellHitSource[] = PLAYER_SPELL_HIT_SOURCES_DATA;

function requireInteger(name: string, value: number, minimum = 0): number {
  if (!Number.isInteger(value) || value < minimum) throw new Error(`${name} must be an integer >= ${minimum}`);
  return value;
}

export function playerSpellHitSource(spell: string): PlayerSpellHitSource | undefined {
  return PLAYER_SPELL_HIT_SOURCES.find((source) => source.spell === spell);
}

/** Resolve collision groups for one stationary monster; unknown ordinary spells retain one target collision. */
export function resolvePlayerSpellHits(spell: string, input: PlayerSpellHitInput): ResolvedPlayerSpellHits {
  const spellLevel = requireInteger('spellLevel', input.spellLevel);
  const characterLevel = requireInteger('characterLevel', input.characterLevel, 1);
  const targetDistance = input.targetDistance ?? 1;
  if (!Number.isFinite(targetDistance) || targetDistance < 0) {
    throw new Error(`targetDistance must be a non-negative finite number (got ${targetDistance})`);
  }
  const source = playerSpellHitSource(spell);
  if (!source) {
    return {
      groups: [{ collisionChecks: 1, mode: 'independent-repeat' }],
      maximumCollisionChecks: 1,
      collisionDamage: 'whole-hit-points',
      hitResult: 'deleted-on-hit',
      stationaryAssumption: 'One ordinary target collision is modelled for spells without a structured persistent-hit source.',
    };
  }

  let groups: PlayerSpellCollisionGroup[];
  switch (source.kind) {
    case 'lightning-segment': {
      const segmentChecks = Math.trunc(spellLevel / 2) + 6;
      const radiusCoversSelectedTarget = targetDistance <= Math.min(spellLevel + 3, 18);
      const pathCount = source.targetPaths === 'direct-plus-radius' && radiusCoversSelectedTarget ? 2 : 1;
      groups = Array.from({ length: pathCount }, () => ({
        collisionChecks: segmentChecks,
        mode: 'independent-repeat' as const,
      }));
      break;
    }
    case 'adjacent-persistent':
      groups = targetDistance <= 1 ? [{ collisionChecks: 19, mode: 'independent-repeat' }] : [];
      break;
    case 'wall-segment':
      groups = [{ collisionChecks: 160 * (spellLevel + 1), mode: 'independent-repeat' }];
      break;
    case 'impact-and-blast':
      groups = [{ collisionChecks: 2, mode: 'first-hit-gates-followup' }];
      break;
    case 'guardian-volley': {
      if (targetDistance > 6) {
        groups = [];
        break;
      }
      const duration = Math.max(30, 16 * Math.min(spellLevel + Math.trunc(characterLevel / 2), 30));
      groups = Array.from({ length: Math.ceil(duration / 16) }, () => ({
        collisionChecks: 1,
        mode: 'independent-repeat' as const,
      }));
      break;
    }
    case 'moving-piercing-ray':
      groups = [{ collisionChecks: 1, mode: 'independent-repeat' }];
      break;
    case 'nova-ray':
      groups = [{ collisionChecks: input.novaCardinalRay ? 2 : 1, mode: 'independent-repeat' }];
      break;
    case 'targeted-segment': {
      const targetTile = Math.trunc(targetDistance);
      groups = targetTile >= 1 && targetTile <= 3
        ? [{ collisionChecks: [20, 25, 30][targetTile - 1], mode: 'independent-repeat' }]
        : [];
      break;
    }
    case 'until-first-hit': {
      const collisionChecks = requireInteger(
        'apocalypseBoomAnimationTicks',
        input.apocalypseBoomAnimationTicks ?? Number.NaN,
        1,
      );
      groups = targetDistance <= 8 ? [{ collisionChecks, mode: 'until-first-hit' }] : [];
      break;
    }
  }

  return {
    source,
    groups,
    maximumCollisionChecks: groups.reduce((sum, group) => sum + group.collisionChecks, 0),
    collisionDamage: source.collisionDamage,
    hitResult: source.hitResult,
    stationaryAssumption: source.stationaryGeometry,
  };
}

/**
 * Resolve the collision groups received by one additional covered pack member. Coverage itself is
 * deliberately left to packMath: these are the engine checks after the named geometry assumption
 * says that the member lies on/in the spell.
 */
export function resolvePlayerSpellPackSecondaryHits(
  spell: string,
  input: PlayerSpellHitInput,
): ResolvedPlayerSpellPackSecondaryHits | undefined {
  const primary = resolvePlayerSpellHits(spell, input);
  if (!primary.source?.packGeometry) return undefined;

  let groups = primary.groups;
  let activation: ResolvedPlayerSpellPackSecondaryHits['activation'] = 'always';
  if (primary.source.kind === 'lightning-segment' && primary.source.targetPaths === 'direct-plus-radius') {
    groups = primary.groups.slice(0, 1);
  } else if (primary.source.kind === 'impact-and-blast') {
    groups = [{ collisionChecks: 1, mode: 'independent-repeat' }];
    activation = 'primary-hit';
  }

  return {
    geometry: primary.source.packGeometry,
    groups,
    maximumCollisionChecks: groups.reduce((sum, group) => sum + group.collisionChecks, 0),
    activation,
    assumption: primary.source.packBehaviour ?? primary.source.stationaryGeometry,
  };
}

export interface WeightedDamageOutcome {
  readonly damage: number;
  readonly weight: number;
}

function binomialProbabilities(checks: number, hitChance: number): number[] {
  if (checks === 0) return [1];
  if (hitChance === 0) return [1, ...Array.from({ length: checks }, () => 0)];
  if (hitChance === 1) return [...Array.from({ length: checks }, () => 0), 1];
  const logFactorial = [0];
  for (let value = 1; value <= checks; value++) logFactorial[value] = logFactorial[value - 1] + Math.log(value);
  const probabilities = Array.from({ length: checks + 1 }, (_, hits) => Math.exp(
    logFactorial[checks] - logFactorial[hits] - logFactorial[checks - hits]
      + hits * Math.log(hitChance) + (checks - hits) * Math.log1p(-hitChance),
  ));
  const total = probabilities.reduce((sum, probability) => sum + probability, 0);
  return probabilities.map((probability) => probability / total);
}

function addOutcome(outcomes: Map<number, number>, damage: number, weight: number): void {
  if (weight <= 0) return;
  outcomes.set(damage, (outcomes.get(damage) ?? 0) + weight);
}

function groupDamageOutcomes(
  perHit: readonly WeightedDamageOutcome[],
  hitChance: number,
  group: PlayerSpellCollisionGroup,
): WeightedDamageOutcome[] {
  const totalWeight = perHit.reduce((sum, outcome) => sum + outcome.weight, 0);
  if (!(totalWeight > 0)) return [{ damage: 0, weight: 1 }];
  const outcomes = new Map<number, number>();
  for (const outcome of perHit) {
    const damageWeight = outcome.weight / totalWeight;
    if (group.mode === 'until-first-hit') {
      const missChance = (1 - hitChance) ** group.collisionChecks;
      addOutcome(outcomes, 0, damageWeight * missChance);
      addOutcome(outcomes, outcome.damage, damageWeight * (1 - missChance));
      continue;
    }
    if (group.mode === 'first-hit-gates-followup') {
      addOutcome(outcomes, 0, damageWeight * (1 - hitChance));
      addOutcome(outcomes, outcome.damage, damageWeight * hitChance * (1 - hitChance));
      addOutcome(outcomes, 2 * outcome.damage, damageWeight * hitChance * hitChance);
      continue;
    }
    for (const [hits, probability] of binomialProbabilities(group.collisionChecks, hitChance).entries()) {
      addOutcome(outcomes, hits * outcome.damage, damageWeight * probability);
    }
  }
  return [...outcomes].map(([damage, weight]) => ({ damage, weight }));
}

function convolve(left: readonly WeightedDamageOutcome[], right: readonly WeightedDamageOutcome[]): WeightedDamageOutcome[] {
  const outcomes = new Map<number, number>();
  for (const a of left) for (const b of right) addOutcome(outcomes, a.damage + b.damage, a.weight * b.weight);
  return [...outcomes].map(([damage, weight]) => ({ damage, weight }));
}

/** Per-cast damage distribution, preserving damage-roll sharing within each collision group. */
export function playerSpellCastDamageOutcomes(
  perHit: readonly WeightedDamageOutcome[],
  hitChance: number,
  groups: readonly PlayerSpellCollisionGroup[],
): WeightedDamageOutcome[] {
  if (!Number.isFinite(hitChance) || hitChance < 0 || hitChance > 1) {
    throw new Error(`hitChance must be from 0 through 1 (got ${hitChance})`);
  }
  return groups.reduce<WeightedDamageOutcome[]>(
    (total, group) => convolve(total, groupDamageOutcomes(perHit, hitChance, group)),
    [{ damage: 0, weight: 1 }],
  );
}

/** Expected MonsterMHit hard-recovery starts per cast; qualifying repeat hits restart the animation. */
export function expectedMonsterRecoveryStartsPerCast(
  perHit: readonly WeightedDamageOutcome[],
  hitChance: number,
  groups: readonly PlayerSpellCollisionGroup[],
  qualifies: (damage: number) => boolean,
): number {
  const totalWeight = perHit.reduce((sum, outcome) => sum + outcome.weight, 0);
  if (!(totalWeight > 0) || hitChance === 0) return 0;
  const qualifyingDamageChance = perHit.reduce(
    (sum, outcome) => sum + (qualifies(outcome.damage) ? outcome.weight : 0),
    0,
  ) / totalWeight;
  return groups.reduce((sum, group) => {
    if (group.mode === 'until-first-hit') {
      return sum + qualifyingDamageChance * (1 - (1 - hitChance) ** group.collisionChecks);
    }
    if (group.mode === 'first-hit-gates-followup') {
      return sum + qualifyingDamageChance * (hitChance + hitChance * hitChance);
    }
    return sum + qualifyingDamageChance * group.collisionChecks * hitChance;
  }, 0);
}
