import type { AcceptanceResult, Checker } from './types';
import { tagRequiredFields } from './requiredFields';
import { isDeclaredGap } from './markers';
import { markContentInvariant } from './contentInvariant';

/**
 * What limits how often an ability is cast (/diablo W12, operator decision D4 — adapt). PoF's schema assumed every
 * ability is cooldown-gated; Diablo I has no cooldown at all — casting is limited by the cast animation and by MANA.
 * Neither checker lowers the bar for a cooldown ability: a cooldown ability grades exactly as before.
 */

function num(v: unknown): number | null {
  if (v == null || v === '' || isDeclaredGap(v)) return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Effect rules: a cast gate is stated. Either `cooldown` > 0 (s), or — for an ability that a RESOURCE gates instead —
 * no cooldown (absent or 0) with an explicit `gatedBy: "resource"` and `manaCost` > 0. The declaration is required
 * so a FORGOTTEN cooldown still reads as missing (a silent omission would otherwise grade as a resource gate).
 */
export function cooldownOrResourceGate(field: string, label: string): Checker {
  const shape = `"${field}.cooldown" is the ability's cooldown in seconds (> 0) — or, for an ability that a resource and not a timer limits (no cooldown), omit it and write "${field}.gatedBy: \\"resource\\"" beside a manaCost > 0`;
  return tagRequiredFields((data) => {
    const obj = (data[field] ?? {}) as Record<string, unknown>;
    const cooldown = num(obj.cooldown);
    const manaCost = num(obj.manaCost);
    const gated = obj.gatedBy === 'resource';
    const noCooldown = obj.cooldown == null || cooldown === 0;
    let result: Pick<AcceptanceResult, 'status' | 'detail' | 'reason'>;
    if (cooldown != null && cooldown > 0) {
      result = { status: 'pass', detail: `cooldown ${cooldown} s` };
    } else if (gated && noCooldown && manaCost != null && manaCost > 0) {
      result = { status: 'pass', detail: `resource-gated: ${manaCost} mana per cast, no cooldown` };
    } else if (gated && noCooldown) {
      result = { status: 'pending', detail: 'resource gate without a cost', reason: `field "${field}": gatedBy "resource" needs manaCost > 0 — ${shape}` };
    } else {
      const why = obj.cooldown == null ? 'missing: cooldown' : isDeclaredGap(obj.cooldown) ? 'cooldown is a declared gap' : `cooldown ${String(obj.cooldown)} is not a positive number of seconds`;
      result = { status: 'pending', detail: 'no cast gate', reason: `field "${field}" ${why} — ${shape}` };
    }
    return { label, tier: 'L0', ...result };
  }, { field, shape });
}

/**
 * Balance: the hit rate comes from the limiter that actually BINDS, not from a quoted constant (registry
 * judgeable-spec-authoring · simulate-the-mechanism-not-the-constant). Each declared limiter is an interval —
 * `cooldown` (s), `castTime` (s), and the mana sustain interval `manaCost / manaRegenPerSec` — and the ability can cast
 * no faster than the LONGEST of them; `hitDPS` must equal `baseDamage / that interval` (±tolPct). An optional
 * `limiter` names which one the author believes binds, and is held to it. A cooldown-only artifact reconciles exactly
 * as `hitDPS = baseDamage / cooldown` did.
 */
export function hitRateFromLimiter(field: string, label: string, tolPct = 1): Checker {
  return markContentInvariant((data) => {
    const obj = data[field];
    if (!obj || typeof obj !== 'object') return { label, tier: 'L0', status: 'pending', detail: `${field} not set` };
    const o = obj as Record<string, unknown>;
    const baseDamage = num(o.baseDamage);
    const hitDPS = num(o.hitDPS);
    if (baseDamage == null || hitDPS == null) return { label, tier: 'L0', status: 'pending', detail: `${field}.baseDamage/hitDPS not set` };
    const limits: Array<{ name: string; interval: number; how: string }> = [];
    const cooldown = num(o.cooldown);
    if (cooldown != null && cooldown > 0) limits.push({ name: 'cooldown', interval: cooldown, how: `cooldown ${cooldown} s` });
    const castTime = num(o.castTime);
    if (castTime != null && castTime > 0) limits.push({ name: 'castTime', interval: castTime, how: `castTime ${castTime} s` });
    const manaCost = num(o.manaCost);
    const regen = num(o.manaRegenPerSec);
    if (manaCost != null && manaCost > 0 && regen != null && regen > 0) {
      limits.push({ name: 'resource', interval: manaCost / regen, how: `manaCost ${manaCost} / regen ${regen}/s = ${(manaCost / regen).toFixed(3)} s` });
    }
    if (limits.length === 0) {
      return { label, tier: 'L0', status: 'pending', detail: 'no cast limiter', reason: `${field}: no cast limiter declared — state cooldown (s), castTime (s), or manaCost + manaRegenPerSec` };
    }
    const binding = limits.reduce((a, b) => (b.interval > a.interval ? b : a));
    const declared = typeof o.limiter === 'string' ? o.limiter : null;
    if (declared && declared !== binding.name) {
      return {
        label, tier: 'L0', status: 'fail', detail: `limiter ${declared} ≠ ${binding.name}`,
        reason: `${field}.limiter says "${declared}" but ${binding.how} binds (the longest interval of: ${limits.map((l) => l.how).join('; ')})`,
      };
    }
    const expected = baseDamage / binding.interval;
    const diffPct = expected === 0 ? (hitDPS === 0 ? 0 : 100) : Math.abs((hitDPS - expected) / expected) * 100;
    return diffPct <= tolPct
      ? { label, tier: 'L0', status: 'pass', detail: `hitDPS=${hitDPS} ≈ baseDamage ${baseDamage} / ${binding.how} = ${expected.toFixed(3)}` }
      : {
          label, tier: 'L0', status: 'fail', detail: `${hitDPS} ≠ ${expected.toFixed(3)}`,
          reason: `arithmetic: ${field}.hitDPS=${hitDPS} does not reconcile with baseDamage ${baseDamage} / the binding limiter (${binding.how}) = ${expected.toFixed(3)} (${diffPct.toFixed(1)}% off)`,
        };
  });
}
