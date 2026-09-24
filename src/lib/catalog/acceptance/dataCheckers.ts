import { gradeGallerySelection } from './galleryArtifact';
import type { Checker } from './types';
import { tagRequiredFields } from './requiredFields';
import { REFERENCE_GAP, isDeclaredGap } from './markers';
import { ELEMENTS_BY_PROFILE, elementsOf, resistanceKey } from '@/lib/catalog/canon/elements';

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
  // Tagged so the produce prompt NAMES the text field it grades (`requiredFields.ts`).
  return tagRequiredFields((data) => {
    const len = String(data[field] ?? '').length;
    const ok = len >= n;
    return { label, tier: 'L0', status: ok ? 'pass' : 'pending', detail: `${len} / ${n} chars`, ...(ok ? {} : { reason: `field "${field}" is ${len} characters, needs ≥ ${n}` }) };
  }, { field, minChars: n });
}

export function fieldsPopulated(field: string, label: string, keys: string[]): Checker {
  // Tagged so the produce prompt can NAME the keys it will be graded on (`requiredFields.ts`).
  return tagRequiredFields((data) => {
    const obj = (data[field] ?? {}) as Record<string, unknown>;
    // A DECLARED gap ("not in the reference") is not a value — it must not read as populated.
    const missing = keys.filter((k) => obj[k] == null || isDeclaredGap(obj[k]));
    const gaps = missing.filter((k) => obj[k] != null);
    const ok = missing.length === 0;
    const note = gaps.length ? ` (declared gap: ${gaps.join(', ')} — "${REFERENCE_GAP}")` : '';
    return { label, tier: 'L0', status: ok ? 'pass' : 'pending', detail: `${keys.length - missing.length} / ${keys.length} populated`, ...(ok ? {} : { reason: `field "${field}" missing: ${missing.join(', ')}${note}` }) };
  }, { field, keys });
}

/**
 * Each of `keys` inside `field` holds ONE number (/diablo W08, D27). Presence stays with {@link fieldsPopulated};
 * this grades SHAPE only, so an absent key or a declared gap is left to it (one verdict per defect). Measured: five
 * produced Stat Blocks held `damage` in three shapes (`damage.minimum`, `damage.standard.minimum`, …) and a
 * consumer guessing the shape silently fell back to a C++ default.
 */
export function keysNumeric(field: string, label: string, keys: string[], canonical: Record<string, RegExp> = {}): Checker {
  const names = Object.keys(canonical);
  const shape = `each of ${keys.join(', ')} holds ONE number, or a range written exactly {minimum, maximum} (two numbers, minimum <= maximum) — no other object and no string; a value the source does not state is written "${REFERENCE_GAP}"`
    + (names.length ? `; ${names.map((n) => `a ${n} value is named exactly "${n}" (one number)`).join('; ')}` : '');
  return tagRequiredFields((data) => {
    const obj = (data[field] ?? {}) as Record<string, unknown>;
    const bad = keys.filter((k) => obj[k] != null && !isDeclaredGap(obj[k]) && statNumber(obj[k]) === undefined);
    const misnamed = Object.keys(obj).flatMap((k) => names.filter((n) => k !== n && canonical[n].test(k)).map((n) => `${k} should be named "${n}"`));
    const ok = bad.length === 0 && misnamed.length === 0;
    const what = (v: unknown) => (Array.isArray(v) ? 'a list' : typeof v === 'object' ? 'an object' : `a ${typeof v}`);
    const problems = [...bad.map((k) => `${k} is ${what(obj[k])}`), ...misnamed];
    return {
      label, tier: 'L0', status: ok ? 'pass' : 'pending',
      detail: `${keys.length - bad.length} / ${keys.length} numeric${misnamed.length ? `, ${misnamed.length} misnamed` : ''}`,
      ...(ok ? {} : { reason: `field "${field}": ${problems.join(', ')} — ${shape}` }),
    };
  }, { field, keys, shape });
}

/**
 * Each present value in `field` names its UNIT in `field.units` (/diablo D30): an ingested monster's moveSpeed is
 * 2.22 (tiles/s) and PoF's own is 300 (cm/s) — both bare numbers under one key until the unit travels with them.
 * A declared gap or an absent value needs none. Composes with {@link keysNumeric} (shape) and fieldsPopulated.
 */
export function unitsDeclared(field: string, label: string, allowed: Record<string, readonly string[]>): Checker {
  const keys = Object.keys(allowed);
  const shape = `beside the values, "${field}.units" names each value's unit — ${keys.map((k) => `${k}: ${allowed[k].join(' | ')}`).join('; ')} (a value written "${REFERENCE_GAP}" needs no unit)`;
  return tagRequiredFields((data) => {
    const obj = (data[field] ?? {}) as Record<string, unknown>;
    const units = (obj.units && typeof obj.units === 'object' ? obj.units : {}) as Record<string, unknown>;
    const bad = keys.filter((k) => obj[k] != null && !isDeclaredGap(obj[k]) && !(typeof units[k] === 'string' && allowed[k].includes(units[k] as string)));
    const ok = bad.length === 0;
    return {
      label, tier: 'L0', status: ok ? 'pass' : 'pending',
      detail: `${keys.length - bad.length} / ${keys.length} units`,
      ...(ok ? {} : { reason: `field "${field}": ${bad.map((k) => `${k} has ${units[k] == null ? 'no unit' : `unit "${String(units[k])}"`} (allowed: ${allowed[k].join(', ')})`).join('; ')} — ${shape}` }),
    };
  }, { field, keys, shape });
}

/**
 * The ONE reader for a stat value (D27): a finite number, or the mean of a `{minimum, maximum}` range with no other
 * keys. Anything else is `undefined` — a consumer must not guess a producer's invented nesting.
 */
export function statNumber(v: unknown): number | undefined {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined;
  const o = v as Record<string, unknown>;
  const keys = Object.keys(o);
  if (keys.length !== 2 || typeof o.minimum !== 'number' || typeof o.maximum !== 'number') return undefined;
  if (!Number.isFinite(o.minimum) || !Number.isFinite(o.maximum) || o.minimum > o.maximum) return undefined;
  return (o.minimum + o.maximum) / 2;
}

/**
 * A per-element resistance profile, graded against the ELEMENT SET of the entity's canon profile
 * (/diablo W03, D14): PoF's fire/ice/lightning/chaos, Diablo I's magic/fire/lightning. The keys are
 * `<element>Res`; everything else behaves exactly like {@link fieldsPopulated}.
 */
export function resistancesPopulated(field: string, label: string): Checker {
  const keysByProfile = Object.fromEntries(
    Object.entries(ELEMENTS_BY_PROFILE).map(([p, els]) => [p, els.map(resistanceKey)]),
  );
  const checker: Checker = (data, ctx) =>
    fieldsPopulated(field, label, elementsOf(ctx?.canonProfile).map(resistanceKey))(data, ctx);
  return tagRequiredFields(checker, { field, keys: elementsOf().map(resistanceKey), keysByProfile });
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
  // Tagged with the single-master (default) shape's keys — a producer following them passes.
  return tagRequiredFields((data) => {
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
  }, { field, keys: ['parentMaterial', 'textures'] });
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

/**
 * Every entry's SPOKEN text is at most `max` words.
 *
 * Built for steps that state a line-length rule in their own produced data and
 * then accept with a count check that cannot see it: the dialog-trees VO Script
 * step declares `voDirection.maxLineLength: 10` ("≤10 words per VO line — a VO
 * timing constraint") while accepting on `minCount('voLines', 1)`, so a single
 * over-long line passed the step that declares the cap. A rule a step writes
 * down and never enforces is indistinguishable from no rule at all.
 *
 * Entries are `KEY: "spoken text"` — only the quoted half is counted, because
 * the localization key is not spoken and is deliberately long. An entry with no
 * quoted section is counted whole (a bare line is still a line). An absent or
 * empty array is `pending`, never a false pass.
 */
export function maxWordsPerEntry(field: string, label: string, max: number): Checker {
  return (data) => {
    const arr = Array.isArray(data[field]) ? (data[field] as unknown[]) : null;
    if (arr == null) return { label, tier: 'L0', status: 'pending', detail: 'not an array', reason: `field "${field}" is not an array of entries` };
    if (arr.length === 0) return { label, tier: 'L0', status: 'pending', detail: '0 entries', reason: `field "${field}" is empty — nothing to check` };

    let worst = 0;
    for (let i = 0; i < arr.length; i++) {
      const raw = typeof arr[i] === 'string' ? (arr[i] as string) : String(arr[i] ?? '');
      // Prefer the quoted spoken half; fall back to the whole entry.
      const quoted = raw.match(/"([^"]*)"/);
      const spoken = quoted ? quoted[1] : raw;
      const words = spoken.trim().split(/\s+/).filter(Boolean);
      if (words.length > worst) worst = words.length;
      if (words.length > max) {
        return {
          label,
          tier: 'L0',
          status: 'fail',
          detail: `entry ${i}: ${words.length} words > ${max}`,
          reason: `field "${field}"[${i}] speaks ${words.length} words, over the ${max}-word cap this step declares: "${spoken.slice(0, 80)}"`,
        };
      }
    }
    return { label, tier: 'L0', status: 'pass', detail: `${arr.length} entr${arr.length === 1 ? 'y' : 'ies'}, longest ${worst} / ${max} words` };
  };
}

export function minCount(field: string, label: string, n: number): Checker {
  // Tagged so the produce prompt NAMES the list it counts (`requiredFields.ts`).
  return tagRequiredFields((data) => {
    const arr = Array.isArray(data[field]) ? (data[field] as unknown[]) : [];
    const ok = arr.length >= n;
    return { label, tier: 'L0', status: ok ? 'pass' : 'pending', detail: `${arr.length} / ${n}`, ...(ok ? {} : { reason: `field "${field}" has ${arr.length} item(s), needs ≥ ${n}` }) };
  }, { field, minItems: n });
}
