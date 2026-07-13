/**
 * Content-invariant checkers — deterministic assertions that a produced artifact obeys a
 * DESIGN LAW, not merely that its fields are populated. Where a plain shape checker
 * (`fieldsPopulated`, `minCount`) passes a config that VIOLATES a balance law, these read
 * the actual numbers and check them against the law's THRESHOLDS.
 *
 * The thresholds are NOT hardcoded here — they are parsed from the canon rule bodies in
 * `@/lib/catalog/canon/canon-seed` (the single source of truth), so a canon edit flows
 * through automatically. The regexes use `\D` (non-digit) runs between numbers so they are
 * robust to the exact unicode of the canon prose (±, ≈, ≤, ×, en-dash, minus). A parse that
 * no longer matches throws at MODULE LOAD (loud) rather than silently using a stale literal.
 *
 * Extends the `withinPercent` precedent in `dataCheckers.ts`. Every non-pass result carries a
 * SPECIFIC reason naming the law + actual-vs-allowed.
 */
import { CANON_SEED } from '@/lib/catalog/canon/canon-seed';
import type { AcceptanceResult, Checker } from './types';

/* ── Canon threshold parsing (single source of truth = CANON_SEED) ─────────── */

function canonBody(id: string): string {
  const r = CANON_SEED.find((x) => x.id === id);
  if (!r) throw new Error(`invariants: canon rule "${id}" not found in CANON_SEED`);
  return r.body;
}
function parseCanon(id: string, re: RegExp): RegExpMatchArray {
  const m = canonBody(id).match(re);
  if (!m) throw new Error(`invariants: canon rule "${id}" body no longer matches ${re} — update the parser or the rule`);
  return m;
}

// proj-balance: "Tier power target ≈ 100 (±10%). Price/power ratio 0.8–1.2×."
const _bal = parseCanon('proj-balance', /power target\D+(\d+)\D+(\d+)%/);
export const POWER_TARGET = Number(_bal[1]); // 100
export const POWER_TOL_PCT = Number(_bal[2]); // 10
const _pp = parseCanon('proj-balance', /Price\/power ratio\D*([\d.]+)\D+?([\d.]+)/);
export const PRICE_RATIO = { min: Number(_pp[1]), max: Number(_pp[2]) }; // 0.8 – 1.2

// proj-economy: "the per-hour faucet and sink should stay balanced within ±15%"
const _eco = parseCanon('proj-economy', /balanced within\D*(\d+)%/);
export const FAUCET_SINK_TOL_PCT = Number(_eco[1]); // 15

// arpg-item-level: "requiredLevel ≈ ilvl − 5..15"; "APS band 1.0–1.8"
const _req = parseCanon('arpg-item-level', /requiredLevel\D+ilvl\D+(\d+)\.\.(\d+)/);
export const REQ_BELOW = { min: Number(_req[1]), max: Number(_req[2]) }; // 5 – 15 below ilvl

// arpg-item-rarity: "Magic = ≤1 prefix + ≤1 suffix; Rare = ≤3 prefix + ≤3 suffix"
const _mag = parseCanon('arpg-item-rarity', /Magic =\D*(\d+) prefix\D+(\d+) suffix/);
const _rare = parseCanon('arpg-item-rarity', /Rare =\D*(\d+) prefix\D+(\d+) suffix/);
export const AFFIX_BUDGET: Record<string, { prefix: number; suffix: number }> = {
  Normal: { prefix: 0, suffix: 0 },
  Magic: { prefix: Number(_mag[1]), suffix: Number(_mag[2]) },
  Rare: { prefix: Number(_rare[1]), suffix: Number(_rare[2]) },
};

// arpg-leveling: "XP-to-next grows roughly geometrically (≈ base × 1.08^level)"
const _xp = parseCanon('arpg-leveling', /base\D+([\d.]+)\^level/);
export const XP_GROWTH = Number(_xp[1]); // 1.08

// arpg-monster-rarity: "Magic ~×1.5–2 life ... Rare ~×4–6 life ... Unique ~×6–10 life"
function rarityLifeBand(tier: string): { min: number; max: number } {
  const m = parseCanon('arpg-monster-rarity', new RegExp(`${tier}\\D*([\\d.]+)\\D+?([\\d.]+) life`));
  return { min: Number(m[1]), max: Number(m[2]) };
}
export const MONSTER_LIFE_BAND: Record<string, { min: number; max: number }> = {
  Magic: rarityLifeBand('Magic'), // 1.5 – 2
  Rare: rarityLifeBand('Rare'), // 4 – 6
  Unique: rarityLifeBand('Unique'), // 6 – 10
};

/* ── Small helpers ─────────────────────────────────────────────────────────── */

/** Resolve a dot-path (`density.sectorBreakdown`) against the artifact data. */
function pick(data: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>(
    (acc, k) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[k] : undefined),
    data,
  );
}
function numOf(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(v);
  return v != null && v !== '' && Number.isFinite(n) ? n : null;
}
const pending = (label: string, detail: string, tier: AcceptanceResult['tier'] = 'L0'): AcceptanceResult =>
  ({ label, tier, status: 'pending', detail });
const pass = (label: string, detail: string, tier: AcceptanceResult['tier'] = 'L0'): AcceptanceResult =>
  ({ label, tier, status: 'pass', detail });
const fail = (label: string, detail: string, reason: string, tier: AcceptanceResult['tier'] = 'L0'): AcceptanceResult =>
  ({ label, tier, status: 'fail', detail, reason });

/* ── Invariants ────────────────────────────────────────────────────────────── */

/** proj-balance: a power value sits within ±POWER_TOL_PCT of its tier target (default 100). */
export function powerWithinTierTarget(field: string, label: string, targetField?: string): Checker {
  return (data) => {
    const power = numOf(pick(data, field));
    if (power == null) return pending(label, `${field} not set`);
    const target = (targetField != null ? numOf(pick(data, targetField)) : null) ?? POWER_TARGET;
    const lo = target * (1 - POWER_TOL_PCT / 100), hi = target * (1 + POWER_TOL_PCT / 100);
    return power >= lo && power <= hi
      ? pass(label, `${power} within ±${POWER_TOL_PCT}% of ${target}`)
      : fail(label, `${power} vs ${target} ±${POWER_TOL_PCT}%`,
          `proj-balance power target: ${field}=${power} is outside ±${POWER_TOL_PCT}% of ${target} (allowed ${lo.toFixed(1)}–${hi.toFixed(1)})`);
  };
}

/** proj-balance: a precomputed price/power ratio sits within the 0.8–1.2× band. */
export function priceRatioWithinBand(field: string, label: string): Checker {
  return (data) => {
    const r = numOf(pick(data, field));
    if (r == null) return pending(label, `${field} not set`);
    return r >= PRICE_RATIO.min && r <= PRICE_RATIO.max
      ? pass(label, `${r}× within ${PRICE_RATIO.min}–${PRICE_RATIO.max}×`)
      : fail(label, `${r}× vs ${PRICE_RATIO.min}–${PRICE_RATIO.max}×`,
          `proj-balance price/power: ${field}=${r}× is outside the ${PRICE_RATIO.min}–${PRICE_RATIO.max}× band`);
  };
}

/** proj-economy: per-hour faucet vs sink stay balanced within ±FAUCET_SINK_TOL_PCT. */
export function faucetSinkBalanced(objField: string, faucetKey: string, sinkKey: string, label: string): Checker {
  return (data) => {
    const f = numOf(pick(data, `${objField}.${faucetKey}`));
    const s = numOf(pick(data, `${objField}.${sinkKey}`));
    if (f == null || s == null) return pending(label, `${objField}.${faucetKey}/${sinkKey} not set`);
    if (s === 0) return fail(label, 'sink is 0', `proj-economy faucet/sink: ${objField}.${sinkKey} is 0 (no sink — every currency needs ≥1 sink)`);
    const imbalance = Math.abs((f - s) / s) * 100;
    return imbalance <= FAUCET_SINK_TOL_PCT
      ? pass(label, `${imbalance.toFixed(1)}% ≤ ±${FAUCET_SINK_TOL_PCT}%`)
      : fail(label, `${imbalance.toFixed(1)}% > ±${FAUCET_SINK_TOL_PCT}%`,
          `proj-economy faucet/sink: faucet ${f} vs sink ${s} = ${imbalance.toFixed(1)}% imbalance, exceeds ±${FAUCET_SINK_TOL_PCT}%`);
  };
}

/** arpg-item-level: requiredLevel is ~5..15 BELOW itemLevel (never above, never equal-high). */
export function requiredLevelBand(objField: string, ilvlKey: string, reqKey: string, label: string): Checker {
  return (data) => {
    const ilvl = numOf(pick(data, `${objField}.${ilvlKey}`));
    const req = numOf(pick(data, `${objField}.${reqKey}`));
    if (ilvl == null || req == null) return pending(label, `${objField}.${ilvlKey}/${reqKey} not set`);
    const below = ilvl - req;
    return below >= REQ_BELOW.min && below <= REQ_BELOW.max
      ? pass(label, `req ${req} = ilvl ${ilvl} − ${below} (in ${REQ_BELOW.min}..${REQ_BELOW.max})`)
      : fail(label, `req ${req} vs ilvl ${ilvl}`,
          `arpg-item-level: requiredLevel ${req} should be ${REQ_BELOW.min}..${REQ_BELOW.max} below itemLevel ${ilvl} (i.e. ${ilvl - REQ_BELOW.max}..${ilvl - REQ_BELOW.min}), got ${below} below`);
  };
}

/** arpg-item-rarity: prefix/suffix counts stay within the rarity's affix budget. */
export function rarityAffixBudget(objField: string, rarityKey: string, prefixKey: string, suffixKey: string, label: string): Checker {
  return (data) => {
    const rarity = String(pick(data, `${objField}.${rarityKey}`) ?? '');
    const budget = AFFIX_BUDGET[rarity];
    const pfx = numOf(pick(data, `${objField}.${prefixKey}`));
    const sfx = numOf(pick(data, `${objField}.${suffixKey}`));
    if (!rarity || pfx == null || sfx == null) return pending(label, `${objField}.${rarityKey}/${prefixKey}/${suffixKey} not set`);
    if (!budget) return fail(label, `unknown rarity ${rarity}`, `arpg-item-rarity: "${rarity}" is not a known rarity (Normal/Magic/Rare)`);
    if (pfx > budget.prefix) return fail(label, `${pfx} prefixes`, `arpg-item-rarity: ${rarity} allows ≤${budget.prefix} prefixes, got ${pfx}`);
    if (sfx > budget.suffix) return fail(label, `${sfx} suffixes`, `arpg-item-rarity: ${rarity} allows ≤${budget.suffix} suffixes, got ${sfx}`);
    return pass(label, `${rarity}: ${pfx}≤${budget.prefix} pfx · ${sfx}≤${budget.suffix} sfx`, 'L2');
  };
}

/** arpg-monster-rarity: per-tier life multipliers sit within the canon bands. */
export function monsterRarityWithinBands(objField: string, label: string): Checker {
  return (data) => {
    const scale = pick(data, `${objField}.rarityScale`);
    if (!scale || typeof scale !== 'object') return pending(label, `${objField}.rarityScale not set`);
    const s = scale as Record<string, { lifeMulti?: unknown }>;
    for (const tier of Object.keys(MONSTER_LIFE_BAND)) {
      const life = numOf(s[tier]?.lifeMulti);
      if (life == null) return pending(label, `${tier}.lifeMulti not set`);
      const band = MONSTER_LIFE_BAND[tier];
      if (life < band.min || life > band.max) {
        return fail(label, `${tier} ×${life}`,
          `arpg-monster-rarity: ${tier} life multiplier ×${life} is outside the canon ×${band.min}–${band.max} band`);
      }
    }
    return pass(label, `Magic/Rare/Unique life multipliers within canon bands`);
  };
}

/** arpg-leveling: the XP curve growth exponent is ~XP_GROWTH (geometric), within tolPct. */
export function xpGrowthWithinBand(objField: string, exponentKey: string, label: string, tolPct = 10): Checker {
  return (data) => {
    const e = numOf(pick(data, `${objField}.${exponentKey}`));
    if (e == null) return pending(label, `${objField}.${exponentKey} not set`);
    const lo = XP_GROWTH * (1 - tolPct / 100), hi = XP_GROWTH * (1 + tolPct / 100);
    return e >= lo && e <= hi
      ? pass(label, `growth ${e} ≈ ${XP_GROWTH} (±${tolPct}%)`)
      : fail(label, `growth ${e} vs ${XP_GROWTH}`,
          `arpg-leveling: XP growth exponent ${e} is outside ±${tolPct}% of the canon geometric rate ${XP_GROWTH} (${lo.toFixed(3)}–${hi.toFixed(3)})`);
  };
}

/* ── Arithmetic-reconciles (structural determinism, canon-independent) ─────── */

/** Named numeric components under `objPath` must sum (within tolAbs) to a constant `total`. */
export function componentsSumTo(objPath: string, keys: string[], total: number, label: string, tolAbs = 0.5): Checker {
  return (data) => {
    const obj = pick(data, objPath);
    if (!obj || typeof obj !== 'object') return pending(label, `${objPath} not set`);
    const o = obj as Record<string, unknown>;
    let sum = 0;
    for (const k of keys) {
      const n = numOf(o[k]);
      if (n == null) return pending(label, `${objPath}.${k} not set`);
      sum += n;
    }
    const diff = Math.abs(sum - total);
    return diff <= tolAbs
      ? pass(label, `Σ = ${sum} (target ${total})`)
      : fail(label, `Σ = ${sum} ≠ ${total}`,
          `arithmetic: ${objPath} components [${keys.join(', ')}] sum to ${sum}, expected ${total} (off by ${diff})`);
  };
}

/** A stated total (`totalPath`) must equal the sum of named parts under `partsPath`. */
export function sumReconciles(totalPath: string, partsPath: string, partKeys: string[], label: string, tolAbs = 0.5): Checker {
  return (data) => {
    const total = numOf(pick(data, totalPath));
    const parts = pick(data, partsPath);
    if (total == null || !parts || typeof parts !== 'object') return pending(label, `${totalPath}/${partsPath} not set`);
    const p = parts as Record<string, unknown>;
    let sum = 0;
    for (const k of partKeys) {
      const n = numOf(p[k]);
      if (n == null) return pending(label, `${partsPath}.${k} not set`);
      sum += n;
    }
    const diff = Math.abs(sum - total);
    return diff <= tolAbs
      ? pass(label, `${totalPath}=${total} = Σparts ${sum}`)
      : fail(label, `${total} ≠ Σ ${sum}`,
          `arithmetic: ${totalPath}=${total} does not reconcile with Σ ${partsPath}[${partKeys.join(', ')}]=${sum} (off by ${diff})`);
  };
}

export type ReconcileOp = 'product' | 'quotient' | 'sum';

/** A stated result under `objPath` must reconcile with an op over its operand fields (within tolPct). */
export function arithmeticReconciles(
  objPath: string,
  spec: { result: string; op: ReconcileOp; operands: string[] },
  label: string,
  tolPct = 1,
): Checker {
  return (data) => {
    const obj = pick(data, objPath);
    if (!obj || typeof obj !== 'object') return pending(label, `${objPath} not set`);
    const o = obj as Record<string, unknown>;
    const result = numOf(o[spec.result]);
    const ops = spec.operands.map((k) => numOf(o[k]));
    if (result == null || ops.some((n) => n == null)) return pending(label, `${objPath} operands not set`);
    const nums = ops as number[];
    let expected: number;
    if (spec.op === 'product') expected = nums.reduce((a, b) => a * b, 1);
    else if (spec.op === 'sum') expected = nums.reduce((a, b) => a + b, 0);
    else expected = nums[1] === 0 ? NaN : nums[0] / nums[1];
    if (!Number.isFinite(expected)) return fail(label, 'division by zero', `arithmetic: ${objPath}.${spec.result} — ${spec.op} is undefined (zero divisor)`);
    const diffPct = expected === 0 ? (result === 0 ? 0 : 100) : Math.abs((result - expected) / expected) * 100;
    return diffPct <= tolPct
      ? pass(label, `${spec.result}=${result} ≈ ${spec.op}(${spec.operands.join(', ')})=${expected.toFixed(3)}`)
      : fail(label, `${result} ≠ ${expected.toFixed(3)}`,
          `arithmetic: ${objPath}.${spec.result}=${result} does not reconcile with ${spec.op} of [${spec.operands.join(', ')}]=${expected.toFixed(3)} (${diffPct.toFixed(1)}% off)`);
  };
}
