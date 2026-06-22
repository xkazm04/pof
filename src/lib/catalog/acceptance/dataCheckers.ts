import type { Checker } from './types';

export function minLength(field: string, label: string, n: number): Checker {
  return (data) => {
    const len = String(data[field] ?? '').length;
    return { label, tier: 'L0', status: len >= n ? 'pass' : 'pending', detail: `${len} / ${n} chars` };
  };
}

export function fieldsPopulated(field: string, label: string, keys: string[]): Checker {
  return (data) => {
    const obj = (data[field] ?? {}) as Record<string, unknown>;
    const have = keys.filter((k) => obj[k] != null).length;
    return { label, tier: 'L0', status: have === keys.length ? 'pass' : 'pending', detail: `${have} / ${keys.length} populated` };
  };
}

export function withinPercent(field: string, label: string, target: number, pct: number): Checker {
  return (data) => {
    const v = data[field];
    if (v == null) return { label, tier: 'L0', status: 'pending', detail: 'not set' };
    const n = Number(v);
    const ok = n >= target * (1 - pct / 100) && n <= target * (1 + pct / 100);
    return { label, tier: 'L0', status: ok ? 'pass' : 'fail', detail: `${n} vs ${target} ±${pct}%`, ...(ok ? {} : { reason: `${n} is outside ±${pct}% of ${target}` }) };
  };
}

/**
 * Validate that a weapon's recorded base DPS is internally CONSISTENT with its own
 * declared damage range and attack speed — `baseDPS ≈ ((damageMin + damageMax) / 2) × attackSpeed`
 * — rather than against a fixed global power target. Tier-agnostic: a tier-1 sword (≈12.5)
 * and a Legendary energy blade (≈38) both pass as long as their DPS math is correct.
 * Power-budget validation is the Economy step's job (pricePowerRatio), not this step's —
 * a fixed target here wrongly fails every above-tier-1 weapon.
 *
 * Reads damageMin/damageMax/attackSpeed from `data[damageField]` (falling back to top-level)
 * and the DPS from `data[dpsField]`.
 */
export function dpsConsistent(
  damageField: string,
  dpsField: string,
  label: string,
  tolerancePct = 12,
): Checker {
  return (data) => {
    const dmg = (data[damageField] ?? {}) as Record<string, unknown>;
    const num = (k: string): number => Number(dmg[k] ?? (data as Record<string, unknown>)[k]);
    const min = num('damageMin');
    const max = num('damageMax');
    const aps = num('attackSpeed');
    const dps = Number(data[dpsField]);
    if (![min, max, aps, dps].every((n) => Number.isFinite(n))) {
      return { label, tier: 'L0', status: 'pending', detail: 'damageMin / damageMax / attackSpeed / baseDPS required' };
    }
    const expected = ((min + max) / 2) * aps;
    const ok = expected === 0 ? dps === 0 : Math.abs(dps - expected) <= expected * (tolerancePct / 100);
    return {
      label,
      tier: 'L0',
      status: ok ? 'pass' : 'fail',
      detail: `baseDPS ${dps} vs computed ${expected.toFixed(2)} (±${tolerancePct}%)`,
      ...(ok ? {} : { reason: `baseDPS ${dps} is inconsistent with avg-damage × APS = ${expected.toFixed(2)}` }),
    };
  };
}

export function selected(field: string, label: string): Checker {
  return (data) => {
    const v = data[field];
    const ok = typeof v === 'number' && v >= 0;
    return { label, tier: 'L1', status: ok ? 'pass' : 'pending', detail: ok ? `candidate ${v}` : 'none selected' };
  };
}

export function minCount(field: string, label: string, n: number): Checker {
  return (data) => {
    const arr = Array.isArray(data[field]) ? (data[field] as unknown[]) : [];
    return { label, tier: 'L0', status: arr.length >= n ? 'pass' : 'pending', detail: `${arr.length} / ${n}` };
  };
}
