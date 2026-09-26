import { spellSpec } from '@/lib/catalog/reference/spellSpecs';

export interface DamageInputs {
  spellLevel: number;
  characterLevel: number;
  magic: number;
  targetCurrentHPInternal?: number;
}

export interface DamageRange {
  min: number;
  max: number;
  mean: number;
}

export interface DamageOutcome {
  damage: number;
  weight: number;
}

type Distribution = Map<number, bigint>;

const point = (value: number): Distribution => new Map([[value, BigInt(1)]]);

function randomLessThan(range: number): Distribution {
  if (range <= 0) return point(0);
  return new Map(Array.from({ length: range }, (_, value) => [value, BigInt(1)]));
}

function add(left: Distribution, right: Distribution): Distribution {
  const out: Distribution = new Map();
  for (const [a, ac] of left) for (const [b, bc] of right) out.set(a + b, (out.get(a + b) ?? BigInt(0)) + ac * bc);
  return out;
}

function rolls(range: number, count: number, addPerRoll = 0): Distribution {
  let out = point(0);
  const roll = new Map([...randomLessThan(range)].map(([value, count]) => [value + addPerRoll, count]));
  for (let i = 0; i < count; i++) out = add(out, roll);
  return out;
}

function transform(input: Distribution, fn: (value: number) => number): Distribution {
  const out: Distribution = new Map();
  for (const [value, count] of input) {
    const mapped = fn(value);
    out.set(mapped, (out.get(mapped) ?? BigInt(0)) + count);
  }
  return out;
}

function stats(distribution: Distribution): DamageRange {
  const values = [...distribution.keys()];
  const total = [...distribution.values()].reduce((sum, count) => sum + count, BigInt(0));
  return {
    min: Math.min(...values),
    max: Math.max(...values),
    mean: [...distribution].reduce((sum, [value, count]) => sum + value * Number(count), 0) / Number(total),
  };
}

/** DevilutionX ScaleSpellEffect: each level adds the truncated current value divided by eight. */
export function scaleSpellEffect(base: number, spellLevel: number): number {
  let scaled = base;
  for (let i = 0; i < spellLevel; i++) scaled += Math.trunc(scaled / 8);
  return scaled;
}

function requireInteger(name: string, value: number, minimum = 0): number {
  if (!Number.isInteger(value) || value < minimum) throw new Error(`${name} must be an integer >= ${minimum}`);
  return value;
}

function damageDistribution(spell: string, input: DamageInputs): Distribution {
  const spec = spellSpec(spell);
  if (!spec) throw new Error(`unknown vanilla spell ${spell}`);
  if (spec.damage.kind === 'none') throw new Error(`${spell} does not deal damage`);
  const S = requireInteger('spellLevel', input.spellLevel);
  const C = requireInteger('characterLevel', input.characterLevel, 1);
  const M = requireInteger('magic', input.magic);
  let distribution: Distribution;

  switch (spell) {
    case 'Firebolt': distribution = transform(randomLessThan(10), (r) => Math.trunc(M / 8) + S + 1 + r); break;
    case 'Lightning':
    case 'ChainLightning': distribution = transform(add(randomLessThan(2), randomLessThan(C)), (r) => r + 2); break;
    case 'Flash': distribution = transform(rolls(20, C + 1, 1), (r) => {
      const scaled = scaleSpellEffect(r, S);
      return (scaled + Math.trunc(scaled / 2)) / 64;
    }); break;
    case 'FireWall': distribution = transform(rolls(10, 2), (r) => (C + 2 + r) / 8); break;
    case 'Fireball': distribution = transform(rolls(10, 2), (r) => scaleSpellEffect(2 * (C + r) + 4, S)); break;
    case 'Guardian': distribution = transform(randomLessThan(10), (r) => scaleSpellEffect(Math.trunc(C / 2) + 1 + r, S)); break;
    case 'FlameWave': distribution = transform(randomLessThan(10), (r) => C + 1 + r); break;
    case 'Nova': distribution = transform(rolls(6, 5), (r) => scaleSpellEffect(Math.trunc((C + 5 + r) / 2), S)); break;
    case 'Inferno': distribution = transform(add(randomLessThan(C), randomLessThan(2)), (r) => (24 + 12 * r) / 64); break;
    case 'Golem': {
      const min = 2 * (S + 4);
      const max = 2 * (S + 8);
      distribution = new Map(Array.from({ length: max - min + 1 }, (_, i) => [min + i, BigInt(1)]));
      break;
    }
    case 'Apocalypse': distribution = rolls(6, C, 1); break;
    case 'Elemental': distribution = transform(rolls(10, 2), (r) => Math.trunc(scaleSpellEffect(2 * (C + r) + 4, S) / 2)); break;
    case 'ChargedBolt': {
      const range = Math.trunc(M / 4);
      distribution = transform(randomLessThan(range), (r) => r + 1);
      break;
    }
    case 'HolyBolt': distribution = transform(randomLessThan(10), (r) => C + 9 + r); break;
    case 'BloodStar': distribution = point(3 * S - Math.trunc(M / 8) + Math.trunc(M / 2)); break;
    case 'BoneSpirit': {
      const hp = input.targetCurrentHPInternal;
      if (hp == null) throw new Error('BoneSpirit damage requires targetCurrentHPInternal');
      distribution = point(Math.trunc(Math.trunc(requireInteger('targetCurrentHPInternal', hp) / 3) / 64));
      break;
    }
    default: throw new Error(`${spell} has damage in the spec but no exact evaluator`);
  }
  return distribution;
}

/** One missile collision or damaging tick, never total cast damage. */
export function damage(spell: string, input: DamageInputs): DamageRange {
  return stats(damageDistribution(spell, input));
}

/** Exact nominal-bin support for one collision/tick, consumed by combatDuel's kill DP. */
export function damageOutcomes(spell: string, input: DamageInputs): DamageOutcome[] {
  return [...damageDistribution(spell, input)].map(([damage, count]) => ({ damage, weight: Number(count) }));
}

export type HeroClass = 'Warrior' | 'Rogue' | 'Sorcerer' | 'Monk' | 'Barbarian' | 'Bard';

export interface ManaInputs {
  spellLevel: number;
  baseMana: number;
  manaAdj: number;
  minMana: number;
  characterLevel: number;
  /** Fixed-point _pMaxManaBase, used when baseMana is the engine's 255 sentinel. */
  maxManaBaseInternal?: number;
  /** Heal Other reads Healing's row rather than its own row. */
  healingBaseMana?: number;
  castType?: 'spell' | 'skill';
  hellfire?: boolean;
}

/** Exact GetManaAmount/ConsumeSpell arithmetic, returned in displayed mana points (internal amount / 64). */
export function manaCost(spell: string, input: ManaInputs, heroClass: HeroClass = 'Warrior'): number {
  if (!spellSpec(spell)) throw new Error(`unknown vanilla spell ${spell}`);
  if (input.castType === 'skill') return 0;
  const S = requireInteger('spellLevel', input.spellLevel);
  const C = requireInteger('characterLevel', input.characterLevel, 1);
  const base = requireInteger('baseMana', input.baseMana);
  const manaAdj = requireInteger('manaAdj', input.manaAdj);
  const minMana = requireInteger('minMana', input.minMana);
  const levelsAboveFirst = Math.max(S - 1, 0);
  let adjustment = levelsAboveFirst * manaAdj;
  if (spell === 'Firebolt') adjustment = Math.trunc(adjustment / 2);
  if (spell === 'Resurrect' && levelsAboveFirst > 0) adjustment = levelsAboveFirst * Math.trunc(base / 8);

  let amount: number;
  if (spell === 'Healing' || spell === 'HealOther') {
    const healingBase = spell === 'Healing' ? base : input.healingBaseMana;
    if (healingBase == null) throw new Error('HealOther mana requires healingBaseMana');
    amount = requireInteger('healingBaseMana', healingBase) + 2 * C - adjustment;
  } else if (base === 255) {
    if (input.maxManaBaseInternal == null) throw new Error(`${spell} mana requires maxManaBaseInternal for baseMana 255`);
    amount = requireInteger('maxManaBaseInternal', input.maxManaBaseInternal) >> 6;
    amount -= adjustment;
  } else {
    amount = base - adjustment;
  }

  let internal = Math.max(amount, 0) << 6;
  if (input.hellfire && heroClass === 'Sorcerer') internal = Math.trunc(internal / 2);
  else if (heroClass === 'Rogue' || heroClass === 'Monk' || heroClass === 'Bard') internal -= Math.trunc(internal / 4);
  if (minMana > (internal >> 6)) internal = minMana << 6;
  return internal / 64;
}
