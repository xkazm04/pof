/**
 * A Diablo I spell's numbers, read from its engine-derived LAW (/diablo W13, operator decision D33). The spell tables carry
 * no damage — a spell's damage, to-hit and cast timing are engine code — so, like the AI routines (W08), each is written
 * once as a canon rule and parsed here at run time (registry: design-canon-as-executable-law; edit the prose and the
 * number moves, lose the sentence and this refuses). The caster's own numbers (Magic, to-hit base, cast frames, mana
 * pool) come from the class tables, never from this file.
 */
import { DIABLO1_CANON } from '@/lib/catalog/canon/profiles/diablo1';
import { timingLaw } from './behaviourScale';

const need = (id: string, re: RegExp): RegExpExecArray => {
  const body = DIABLO1_CANON.find((r) => r.id === id)?.body;
  if (!body) throw new Error(`canon rule ${id} is missing — no law to read`);
  const m = re.exec(body);
  if (!m) throw new Error(`canon rule ${id} no longer states ${re} — refusing to guess`);
  return m;
};

/** Spells whose damage law exists. Charged Bolt and Lightning are multi-missile — not modelled yet. */
export const SPELL_LAW_IDS: Record<string, string> = { Firebolt: 'd1-spell-firebolt-law' };
/** Every spell: to-hit, cast timing, mana — shared by all spells, one rule. */
export const CAST_LAW_ID = 'd1-spell-cast-law';

export interface FireboltLaw {
  magicDivisor: number;
  constant: number;
  spread: number;
  resistedFraction: number;
  toHit: { monsterLevelCoef: number; min: number; max: number };
  ticksPerFrame: number;
  regenerates: boolean;
}

export function fireboltLaw(): FireboltLaw {
  const id = SPELL_LAW_IDS.Firebolt;
  const dmg = need(id, /deals Magic \/ (\d+) \+ spell level \+ (\d+) plus 0-(\d+) damage/);
  const res = need(id, /resistant monster takes (\d+)\/(\d+) of it/);
  const hit = need(CAST_LAW_ID, /- (\d+) x monster level - distance\)%, clamped to (\d+)-(\d+)/);
  const tpf = need(CAST_LAW_ID, /at (\d+) tick per frame/);
  const noRegen = /Mana does not regenerate over time/.test(DIABLO1_CANON.find((r) => r.id === CAST_LAW_ID)?.body ?? '');
  return {
    magicDivisor: Number(dmg[1]), constant: Number(dmg[2]), spread: Number(dmg[3]),
    resistedFraction: Number(res[1]) / Number(res[2]),
    toHit: { monsterLevelCoef: Number(hit[1]), min: Number(hit[2]), max: Number(hit[3]) },
    ticksPerFrame: Number(tpf[1]),
    regenerates: !noRegen,
  };
}

/** The reference caster, read from a class's attribute + animation tables (Variable/Value rows). */
export interface ReferenceCaster {
  basis: string;
  level: number;
  magic: number;
  magicToHit: number;
  castingFrames: number;
  castingActionFrame: number;
  maxMana: number;
}

export function referenceCaster(input: {
  className: string; attributes: Record<string, string>; animations: Record<string, string>; level?: number;
}): ReferenceCaster {
  const level = input.level ?? 1;
  const num = (table: Record<string, string>, k: string) => {
    const v = table[k];
    if (v === undefined || v.trim() === '' || !Number.isFinite(Number(v))) {
      throw new Error(`class tables for ${input.className} have no numeric ${k} — refusing to default it`);
    }
    return Number(v);
  };
  const a = input.attributes;
  const magic = num(a, 'baseMag');
  return {
    basis: `Diablo I ${input.className}, level ${level}, base attributes`,
    level,
    magic,
    magicToHit: magic + num(a, 'baseMagicToHit'),
    castingFrames: num(input.animations, 'castingFrames'),
    castingActionFrame: num(input.animations, 'castingActionFrame'),
    maxMana: num(a, 'adjMana') + num(a, 'lvlMana') * level + num(a, 'chrMana') * magic,
  };
}

export interface SpellNumbers {
  damage: { minimum: number; maximum: number; mean: number };
  castTime: number;
  releaseTime: number;
  manaCost: number;
  manaRegenPerSec: number;
  castsPerPool: number;
  /** Chance to hit (0-1) against a monster of `level` at `distance` tiles. */
  toHit: (monsterLevel: number, distance: number) => number;
}

/** Firebolt at `spellLevel` for `caster`, with the table's mana cost. Seconds use the engine's tick rate (d1-timing-law). */
export function fireboltAt(caster: ReferenceCaster, spellLevel: number, tableManaCost: number): SpellNumbers {
  const law = fireboltLaw();
  if (law.regenerates) throw new Error('d1-spell-cast-law no longer says mana does not regenerate, and states no rate — refusing to guess one');
  if (spellLevel !== 1) throw new Error(`the law states Firebolt's mana cost at spell level 1 only (asked for ${spellLevel}) — refusing to extrapolate`);
  const tps = timingLaw().ticksPerSecond;
  const minimum = Math.floor(caster.magic / law.magicDivisor) + spellLevel + law.constant;
  const maximum = minimum + law.spread;
  return {
    damage: { minimum, maximum, mean: (minimum + maximum) / 2 },
    castTime: (caster.castingFrames * law.ticksPerFrame) / tps,
    releaseTime: (caster.castingActionFrame * law.ticksPerFrame) / tps,
    manaCost: tableManaCost,
    manaRegenPerSec: 0,
    castsPerPool: Math.floor(caster.maxMana / tableManaCost),
    toHit: (monsterLevel, distance) =>
      Math.min(law.toHit.max, Math.max(law.toHit.min, caster.magicToHit - law.toHit.monsterLevelCoef * monsterLevel - distance)) / 100,
  };
}
