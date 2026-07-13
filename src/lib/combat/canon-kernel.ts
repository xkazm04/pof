/**
 * Canon damage/mitigation kernel — the ONE typed authority for combat math.
 *
 * Encodes the ARPG-LAWS canon (docs/catalog/ARPG-LAWS.md §3–4, seeded as
 * `arpg-damage-model` / `arpg-mitigation-order` / `arpg-resists` /
 * `arpg-defenses` in src/lib/catalog/canon/canon-seed.ts):
 *
 *   OFFENSE  — per typed bucket:  (base + added)
 *                                 × (1 + Σincreased%)          ← all increases sum into ONE multiplier
 *                                 × Π each (1 + more%)          ← each "more" is its OWN multiplier
 *              crit: chance capped at 95%, base multiplier ×2.5 (+150%).
 *
 *   MITIGATION — applied strictly in order: evasion → block → armour → resist.
 *              armour reduction = (armour·weight) / (armour·weight + 5 × rawPhysicalHit)  ← soft-capped, never flat %
 *              per-type resist capped at 75% (overcap allowed as input; the cap is the applied ceiling).
 *
 * A damage number is meaningless without its type + bucket, so the kernel is
 * typed end-to-end. Engines that carry a simpler (single, untyped) model adapt
 * INTO this kernel — see `@/lib/combat/damage` (the shared calculateDamage).
 *
 * Pure and deterministic: the only source of nondeterminism is the optional
 * `rng` used for the avoidance + crit rolls, and it is drawn lazily (no roll is
 * consumed for a layer whose chance is 0/undefined) so adapters can preserve an
 * existing rng draw order.
 */

// ── Canon constants ──────────────────────────────────────────────────────────

export type DamageType = 'Physical' | 'Fire' | 'Cold' | 'Lightning' | 'Chaos';

export const DAMAGE_TYPES: readonly DamageType[] = ['Physical', 'Fire', 'Cold', 'Lightning', 'Chaos'];

/** Elemental + Chaos types are mitigated by resist; Physical is mitigated by armour. */
export const RESIST_TYPES: readonly DamageType[] = ['Fire', 'Cold', 'Lightning', 'Chaos'];

/** Crit base multiplier = ×2.5 (+150%) per canon arpg-damage-model. */
export const CRIT_MULTIPLIER = 2.5;
/** Crit chance is hard-capped at 95%. */
export const CRIT_CHANCE_CAP = 0.95;
/** Per-type resist is capped at 75% (max-res mods can raise the ceiling — pass `resistCap`). */
export const RESIST_CAP = 0.75;
/** Armour soft-cap coefficient: reduction = armour / (armour + 5 × rawPhysHit). */
export const ARMOUR_HIT_COEFF = 5;

// ── Inputs ───────────────────────────────────────────────────────────────────

export interface DamageBucket {
  /** Flat base damage of this type. */
  base: number;
  /** Added flat damage (base + added collapse before increases). */
  added?: number;
  /** Sum of all "increased" modifiers as a percent (40 → +40%). All increases sum into ONE multiplier. */
  increasedPct?: number;
  /** Each "more" modifier as a percent (30 → ×1.30), applied as its OWN multiplier. */
  morePcts?: number[];
}

export interface CritSpec {
  /** 0–1; hard-capped at 95% when rolled. */
  chance: number;
  /** Crit damage multiplier; defaults to canon ×2.5. */
  multiplier?: number;
}

export interface Offense {
  buckets: Partial<Record<DamageType, DamageBucket>>;
  crit?: CritSpec;
}

export interface Defense {
  /** Avoidance layer 1 — chance (0–1) the hit is evaded entirely (attacks only; spells/DoT never miss → 0). */
  evasionChance?: number;
  /** Avoidance layer 2 — chance (0–1) the hit is blocked. */
  blockChance?: number;
  /** Fraction of the hit removed on a successful block (default 1 = full avoid). Block chance caps at 75% upstream. */
  blockAmount?: number;
  /** Armour rating (mitigates Physical only). */
  armour?: number;
  /** Multiplier applied to armour before the soft-cap (a tuning knob; default 1). */
  armourWeight?: number;
  /** Per-type resist as a fraction 0–1; capped at `resistCap` when applied. */
  resists?: Partial<Record<DamageType, number>>;
  /** Resist ceiling (default 0.75). max-res builds raise this to ≤0.90. */
  resistCap?: number;
}

export interface HitContext {
  /** Drawn (lazily) for avoidance + crit rolls. Omit for a deterministic hit (no avoid; crit only if forced or chance≥1). */
  rng?: () => number;
  /** Force the crit outcome, skipping the roll (and consuming no rng). */
  forceCrit?: boolean;
}

// ── Output ───────────────────────────────────────────────────────────────────

export interface CanonHitResult {
  /** Total mitigated damage across all types (unrounded). */
  total: number;
  /** Mitigated damage per type (only types with a bucket are present). */
  byType: Partial<Record<DamageType, number>>;
  isCrit: boolean;
  /** Which avoidance layer voided the hit, if any. */
  avoided: 'evasion' | 'block' | null;
}

// ── Core computation ─────────────────────────────────────────────────────────

/** base+added → ×(1+Σincreased%) → ×each more% separately. */
export function bucketRaw(b: DamageBucket): number {
  const flat = b.base + (b.added ?? 0);
  const increased = 1 + (b.increasedPct ?? 0) / 100;
  let out = flat * increased;
  for (const m of b.morePcts ?? []) out *= 1 + m / 100;
  return out;
}

/** Canon armour reduction fraction (0–1) for a given raw physical hit. */
export function armourReduction(armour: number, rawPhysHit: number, weight = 1): number {
  const eff = armour * weight;
  if (eff <= 0 || rawPhysHit <= 0) return 0;
  return eff / (eff + ARMOUR_HIT_COEFF * rawPhysHit);
}

/**
 * Effective-HP multiplier from armour against a reference physical hit — EHP is
 * derived, not stored (§8). `hp / (1 − reduction)`. Because armour is soft-capped
 * against the hit size, EHP needs a reference hit; larger hits → less benefit.
 */
export function armourEffectiveHpMultiplier(armour: number, refHit: number, weight = 1): number {
  const r = armourReduction(armour, refHit, weight);
  return r >= 1 ? Infinity : 1 / (1 - r);
}

/**
 * Resolve one typed hit through the full canon pipeline: offense stacking →
 * crit → avoidance → mitigation (evasion→block→armour→resist).
 */
export function computeHit(offense: Offense, defense: Defense = {}, ctx: HitContext = {}): CanonHitResult {
  const rng = ctx.rng;

  // ── Avoidance (drawn only when a chance is set, so callers keep rng order) ──
  let avoided: 'evasion' | 'block' | null = null;
  let blockFactor = 1;
  if (rng) {
    if (defense.evasionChance && defense.evasionChance > 0 && rng() < defense.evasionChance) {
      avoided = 'evasion';
    } else if (defense.blockChance && defense.blockChance > 0 && rng() < defense.blockChance) {
      avoided = 'block';
      const amt = defense.blockAmount ?? 1;
      blockFactor = 1 - Math.min(1, Math.max(0, amt));
    }
  }
  if (avoided === 'evasion') {
    return { total: 0, byType: {}, isCrit: false, avoided };
  }

  // ── Crit (one roll, capped at 95%) ──
  let isCrit = false;
  if (ctx.forceCrit !== undefined) {
    isCrit = ctx.forceCrit;
  } else {
    const chance = Math.min(offense.crit?.chance ?? 0, CRIT_CHANCE_CAP);
    if (chance >= 1) isCrit = true;
    else if (chance > 0 && rng) isCrit = rng() < chance;
  }
  const critMul = isCrit ? offense.crit?.multiplier ?? CRIT_MULTIPLIER : 1;

  // ── Per-type raw → crit → block → mitigation ──
  const resistCap = defense.resistCap ?? RESIST_CAP;
  const byType: Partial<Record<DamageType, number>> = {};
  let total = 0;

  for (const type of DAMAGE_TYPES) {
    const bucket = offense.buckets[type];
    if (!bucket) continue;
    let dmg = bucketRaw(bucket) * critMul * blockFactor;

    if (type === 'Physical') {
      const reduction = armourReduction(defense.armour ?? 0, dmg, defense.armourWeight ?? 1);
      dmg *= 1 - reduction;
    } else {
      const resist = Math.min(defense.resists?.[type] ?? 0, resistCap);
      dmg *= 1 - resist;
    }

    if (dmg < 0) dmg = 0;
    byType[type] = dmg;
    total += dmg;
  }

  return { total, byType, isCrit, avoided };
}
