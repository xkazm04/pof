import { gradeGallerySelection } from './galleryArtifact';
import type { Checker } from './types';

/**
 * Resolve a field reference against a step's artifact data. A plain name (`gpuPct`) reads a
 * top-level key exactly as before; a DOT-PATH (`gpuBudget.gpuMs`) walks into the nested object.
 *
 * Why: several `balance` steps chart an object (`view.field = 'gpuBudget'`) while grading a
 * DUPLICATED top-level scalar — so the number on screen was not the number being graded and the
 * two could drift apart silently. A dot-path lets the checker grade the exact datum the View
 * renders. Backward compatible: a name with no `.` behaves identically to `data[field]`.
 */
export function pickField(data: Record<string, unknown>, field: string): unknown {
  if (!field.includes('.')) return data[field];
  return field.split('.').reduce<unknown>(
    (acc, k) => (acc != null && typeof acc === 'object' ? (acc as Record<string, unknown>)[k] : undefined),
    data,
  );
}

export function minLength(field: string, label: string, n: number): Checker {
  return (data) => {
    const len = String(data[field] ?? '').length;
    const ok = len >= n;
    return { label, tier: 'L0', status: ok ? 'pass' : 'pending', detail: `${len} / ${n} chars`, ...(ok ? {} : { reason: `field "${field}" is ${len} characters, needs ≥ ${n}` }) };
  };
}

export function fieldsPopulated(field: string, label: string, keys: string[]): Checker {
  return (data) => {
    const obj = (data[field] ?? {}) as Record<string, unknown>;
    const missing = keys.filter((k) => obj[k] == null);
    const ok = missing.length === 0;
    return { label, tier: 'L0', status: ok ? 'pass' : 'pending', detail: `${keys.length - missing.length} / ${keys.length} populated`, ...(ok ? {} : { reason: `field "${field}" missing: ${missing.join(', ')}` }) };
  };
}

/** Numeric ±% band. `field` may be a dot-path (see `pickField`) so a step can grade the very
 *  value its chart renders instead of a duplicated top-level mirror. */
export function withinPercent(field: string, label: string, target: number, pct: number): Checker {
  return (data) => {
    const v = pickField(data, field);
    if (v == null) return { label, tier: 'L0', status: 'pending', detail: 'not set', reason: `field "${field}" is not set (expected a value within ±${pct}% of ${target})` };
    const n = Number(v);
    const ok = n >= target * (1 - pct / 100) && n <= target * (1 + pct / 100);
    return { label, tier: 'L0', status: ok ? 'pass' : 'fail', detail: `${n} vs ${target} ±${pct}%`, ...(ok ? {} : { reason: `${n} is outside ±${pct}% of ${target}` }) };
  };
}

/**
 * Absolute-tolerance numeric band: passes when `|value − target| ≤ tol`. Unlike
 * `withinPercent` (whose ±% band flips its ordering for a negative target, making a
 * signed value like −16 LUFS unrepresentable), this gates directly on the signed value,
 * so a true negative target (dBLUFS, temperature, offset) is checked honestly.
 */
export function withinAbsolute(field: string, label: string, target: number, tol: number): Checker {
  return (data) => {
    const v = data[field];
    if (v == null) return { label, tier: 'L0', status: 'pending', detail: 'not set', reason: `field "${field}" is not set (expected a value within ±${tol} of ${target})` };
    const n = Number(v);
    const ok = Math.abs(n - target) <= tol;
    return { label, tier: 'L0', status: ok ? 'pass' : 'fail', detail: `${n} vs ${target} ±${tol}`, ...(ok ? {} : { reason: `${n} is outside ±${tol} of ${target}` }) };
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
      const missing: string[] = ['damageMin', 'damageMax', 'attackSpeed'].filter((k) => !Number.isFinite(num(k)));
      if (!Number.isFinite(dps)) missing.push('baseDPS');
      return { label, tier: 'L0', status: 'pending', detail: 'damageMin / damageMax / attackSpeed / baseDPS required', reason: `missing numeric field(s): ${missing.join(', ')} (in "${damageField}" / "${dpsField}")` };
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

/**
 * L1 gallery selection gate — grades the SELECTED CANDIDATE, not merely that an index exists.
 *
 * This used to be `typeof v === 'number' && v >= 0` → pass, and nothing else was examined:
 * all 47 gallery steps went green whether or not anything had ever been generated. The rules
 * (real asset → pass · swatch placeholder → deferred+reason · unresolved/mismatched selection
 * → fail) and the reasoning behind them live in `galleryArtifact.ts`, next to the `gallerySeed`
 * that writes the shape this reads.
 */
export function selected(field: string, label: string): Checker {
  return (data) => gradeGallerySelection(data, field, label);
}

/**
 * items Material shape — accepts EITHER the legacy single-master shape
 * (`material.parentMaterial` + `material.textures`, identical null-strictness to
 * `fieldsPopulated` on those keys) OR a multi-master `material.parentMaterials[]` where
 * EVERY entry carries `surface` + `parentMaterial` + `textures`. On the array path a
 * missing field FAILS naming the offending index; the single-master path is unchanged.
 */
export function materialShape(field: string, label: string): Checker {
  return (data) => {
    const obj = (data[field] ?? {}) as Record<string, unknown>;
    const masters = obj.parentMaterials;
    if (Array.isArray(masters)) {
      if (masters.length === 0) {
        return { label, tier: 'L0', status: 'pending', detail: '0 masters', reason: `field "${field}.parentMaterials" is empty (need ≥1 master, each with surface / parentMaterial / textures)` };
      }
      const req = ['surface', 'parentMaterial', 'textures'];
      for (let i = 0; i < masters.length; i++) {
        const m = (masters[i] ?? {}) as Record<string, unknown>;
        const missing = req.filter((k) => m[k] == null);
        if (missing.length) {
          return { label, tier: 'L0', status: 'fail', detail: `master[${i}] incomplete`, reason: `field "${field}.parentMaterials[${i}]" missing: ${missing.join(', ')}` };
        }
      }
      return { label, tier: 'L0', status: 'pass', detail: `${masters.length} master(s), each surface / parentMaterial / textures populated` };
    }
    // Legacy single-master shape (parentMaterial + textures), same strictness as fieldsPopulated.
    const req = ['parentMaterial', 'textures'];
    const missing = req.filter((k) => obj[k] == null);
    const ok = missing.length === 0;
    return { label, tier: 'L0', status: ok ? 'pass' : 'pending', detail: `${req.length - missing.length} / ${req.length} populated`, ...(ok ? {} : { reason: `field "${field}" missing: ${missing.join(', ')}` }) };
  };
}

/**
 * CONTENT check for an array of structured entries: every entry must carry `keys`, non-null.
 *
 * `minCount` only proves an array is long enough — a row of seven empty objects passes it. This
 * asserts the SHAPE of what's inside, and names the offending index + missing keys when it
 * doesn't. Compose it over the existing count check with `allOf(minCount(...), entriesHaveFields(...))`
 * so a step keeps its length floor AND gains a content assertion. An absent/empty array is
 * `pending` (nothing produced yet), never a false pass.
 */
export function entriesHaveFields(field: string, label: string, keys: string[]): Checker {
  return (data) => {
    const arr = Array.isArray(data[field]) ? (data[field] as unknown[]) : null;
    if (arr == null) return { label, tier: 'L0', status: 'pending', detail: 'not an array', reason: `field "${field}" is not an array of entries` };
    if (arr.length === 0) return { label, tier: 'L0', status: 'pending', detail: '0 entries', reason: `field "${field}" is empty — nothing to check` };
    for (let i = 0; i < arr.length; i++) {
      const e = arr[i];
      if (e == null || typeof e !== 'object' || Array.isArray(e)) {
        return { label, tier: 'L0', status: 'fail', detail: `entry ${i} is not an object`, reason: `field "${field}"[${i}] must be an object carrying ${keys.join(' / ')}` };
      }
      const missing = keys.filter((k) => (e as Record<string, unknown>)[k] == null);
      if (missing.length) {
        return { label, tier: 'L0', status: 'fail', detail: `entry ${i} incomplete`, reason: `field "${field}"[${i}] missing: ${missing.join(', ')}` };
      }
    }
    return { label, tier: 'L0', status: 'pass', detail: `${arr.length} entr${arr.length === 1 ? 'y' : 'ies'} × ${keys.length} field(s)` };
  };
}

export function minCount(field: string, label: string, n: number): Checker {
  return (data) => {
    const arr = Array.isArray(data[field]) ? (data[field] as unknown[]) : [];
    const ok = arr.length >= n;
    return { label, tier: 'L0', status: ok ? 'pass' : 'pending', detail: `${arr.length} / ${n}`, ...(ok ? {} : { reason: `field "${field}" has ${arr.length} item(s), needs ≥ ${n}` }) };
  };
}
