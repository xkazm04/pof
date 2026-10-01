/**
 * Weapon throughput — the ONE weapon-DPS law.
 *
 * A weapon row carries display strings ('8-14', '1.4s', '5%'). `parseWeaponStats`
 * is the only parser of them: a malformed field is an `err` naming the field,
 * never NaN. The expected hit resolves through the canon kernel (`computeHit`):
 * one Physical bucket at the damage midpoint, weighed non-crit vs forced-crit by
 * the crit chance (capped at canon's 95%), with optional target armour on canon's
 * soft-cap. So the crit multiplier (×2.5), the cap and the armour curve are read
 * from `canon-kernel`, never restated here.
 *
 *   dps = E[hit] / interval,   E[hit] = (1−c)·hit(non-crit) + c·hit(crit)
 *
 * Pure (no React). Every DPS surface of the Combat Metrics tab — compare rows,
 * the grouped chart, the STR/DEX panel and the Feature Map tiles — reads this.
 */
import {
  computeHit, CRIT_CHANCE_CAP, type Defense, type Offense,
} from '@/lib/combat/canon-kernel';
import { ok, err, type Result } from '@/types/result';

/** The display fields a weapon row must carry. */
export interface WeaponRow {
  id: string;
  name: string;
  category: string;
  baseDamage: string;
  attackSpeed: string;
  critChance: string;
}

export interface WeaponStats {
  dmgLo: number;
  dmgHi: number;
  /** Seconds between attacks. */
  intervalSec: number;
  /** Fraction 0–n as authored (the 95% cap is applied when the hit resolves). */
  critChance: number;
}

/**
 * STR/DEX → weapon law (moved verbatim out of StatInfluencePanel and named):
 * +2 damage per STR over 10; −0.02 s interval per DEX over 10, floored at 0.3 s;
 * +1% crit per 2 DEX over 10.
 */
export const ATTRIBUTE_WEAPON_LAW = {
  baseline: 10,
  damagePerStr: 2,
  intervalPerDex: 0.02,
  minIntervalSec: 0.3,
  dexPerCritPct: 2,
} as const;

export interface WeaponAttributes { str: number; dex: number }

export interface ThroughputOptions {
  attributes?: WeaponAttributes;
  /** Target armour rating (canon soft-cap against the hit size). */
  armour?: number;
}

export interface WeaponThroughput {
  stats: WeaponStats;
  /** Damage midpoint after the attribute law. */
  damage: number;
  intervalSec: number;
  /** Applied crit chance (attribute law, then clamped to [0, CRIT_CHANCE_CAP]). */
  critChance: number;
  expectedHit: number;
  dps: number;
}

const NUM = '(\\d+(?:\\.\\d+)?)';
const RANGE_RE = new RegExp(`^\\s*${NUM}\\s*-\\s*${NUM}\\s*$`);
const SECONDS_RE = new RegExp(`^\\s*${NUM}\\s*s?\\s*$`);
const PERCENT_RE = new RegExp(`^\\s*${NUM}\\s*%\\s*$`);

/** Parse a 'lo-hi' damage range. */
export function parseDamageRange(dmg: string): Result<{ lo: number; hi: number }> {
  const m = RANGE_RE.exec(dmg);
  if (!m) return err(`baseDamage: expected "lo-hi", got "${dmg}"`);
  const lo = Number(m[1]), hi = Number(m[2]);
  if (lo > hi) return err(`baseDamage: low ${lo} exceeds high ${hi}`);
  return ok({ lo, hi });
}

/** The ONE parser of a weapon row's display strings. */
export function parseWeaponStats(w: Pick<WeaponRow, 'baseDamage' | 'attackSpeed' | 'critChance'>): Result<WeaponStats> {
  const range = parseDamageRange(w.baseDamage);
  if (!range.ok) return range;
  const speed = SECONDS_RE.exec(w.attackSpeed);
  const intervalSec = speed ? Number(speed[1]) : NaN;
  if (!(intervalSec > 0)) return err(`attackSpeed: expected seconds like "1.4s", got "${w.attackSpeed}"`);
  const crit = PERCENT_RE.exec(w.critChance);
  if (!crit) return err(`critChance: expected a percent like "5%", got "${w.critChance}"`);
  return ok({ dmgLo: range.data.lo, dmgHi: range.data.hi, intervalSec, critChance: Number(crit[1]) / 100 });
}

/** Expected damage of one swing through the canon kernel. */
export function expectedWeaponHit(
  damage: number, critChance: number, opts: Pick<ThroughputOptions, 'armour'> = {},
): number {
  const c = Math.min(Math.max(critChance, 0), CRIT_CHANCE_CAP);
  const offense: Offense = { buckets: { Physical: { base: damage } } };
  const defense: Defense = { armour: opts.armour ?? 0 };
  const normal = computeHit(offense, defense, { forceCrit: false }).total;
  const crit = computeHit(offense, defense, { forceCrit: true }).total;
  return (1 - c) * normal + c * crit;
}

/** Full throughput readout for one weapon (err names the malformed field). */
export function weaponThroughput(w: WeaponRow, opts: ThroughputOptions = {}): Result<WeaponThroughput> {
  const parsed = parseWeaponStats(w);
  if (!parsed.ok) return err(`${w.id}: ${parsed.error}`);
  const stats = parsed.data;
  const L = ATTRIBUTE_WEAPON_LAW;
  const str = (opts.attributes?.str ?? L.baseline) - L.baseline;
  const dex = (opts.attributes?.dex ?? L.baseline) - L.baseline;
  const damage = (stats.dmgLo + stats.dmgHi) / 2 + str * L.damagePerStr;
  // The DEX floor never slows a weapon authored faster than it.
  const floor = Math.min(L.minIntervalSec, stats.intervalSec);
  const intervalSec = Math.max(floor, stats.intervalSec - dex * L.intervalPerDex);
  const critPctBonus = Math.floor(dex / L.dexPerCritPct);
  const critChance = Math.min(Math.max(stats.critChance + critPctBonus / 100, 0), CRIT_CHANCE_CAP);
  const expectedHit = expectedWeaponHit(Math.max(damage, 0), critChance, opts);
  return ok({ stats, damage, intervalSec, critChance, expectedHit, dps: expectedHit / intervalSec });
}

/** Expected DPS of one weapon; a malformed row is 0 (see weaponThroughput for the reason). */
export function weaponDps(w: WeaponRow, opts: ThroughputOptions = {}): number {
  const t = weaponThroughput(w, opts);
  return t.ok ? t.data.dps : 0;
}

export interface RosterRow<T extends WeaponRow> {
  weapon: T;
  id: string;
  name: string;
  category: string;
  intervalSec: number;
  dps: number;
}

export interface RosterGroup<T extends WeaponRow> {
  category: string;
  /** Sorted by dps descending. */
  rows: RosterRow<T>[];
  avgDps: number;
  maxDps: number;
}

export interface WeaponRoster<T extends WeaponRow> {
  /** Every parseable weapon, sorted by dps descending. */
  rows: RosterRow<T>[];
  /** Category groups in `categoryOrder` (default: first appearance in the input). */
  groups: RosterGroup<T>[];
  best: RosterRow<T> | null;
  meanDps: number;
  /** === rows[0].dps (0 for an empty roster). */
  globalMax: number;
  /** Rows that failed to parse, with the reason — excluded from every figure. */
  invalid: { id: string; error: string }[];
}

/** Rank, group and summarise a weapon table under one law. */
export function weaponRoster<T extends WeaponRow>(
  weapons: readonly T[], opts: ThroughputOptions & { categoryOrder?: readonly string[] } = {},
): WeaponRoster<T> {
  const rows: RosterRow<T>[] = [];
  const invalid: { id: string; error: string }[] = [];
  for (const weapon of weapons) {
    const t = weaponThroughput(weapon, opts);
    if (!t.ok) { invalid.push({ id: weapon.id, error: t.error }); continue; }
    rows.push({ weapon, id: weapon.id, name: weapon.name, category: weapon.category, intervalSec: t.data.intervalSec, dps: t.data.dps });
  }
  rows.sort((a, b) => b.dps - a.dps);
  const order = opts.categoryOrder ?? [...new Set(weapons.map(w => w.category))];
  const groups = order.flatMap(category => {
    const inCat = rows.filter(r => r.category === category);
    if (inCat.length === 0) return [];
    const avgDps = inCat.reduce((s, r) => s + r.dps, 0) / inCat.length;
    return [{ category, rows: inCat, avgDps, maxDps: inCat[0].dps }];
  });
  const meanDps = rows.length > 0 ? rows.reduce((s, r) => s + r.dps, 0) / rows.length : 0;
  return { rows, groups, best: rows[0] ?? null, meanDps, globalMax: rows[0]?.dps ?? 0, invalid };
}
