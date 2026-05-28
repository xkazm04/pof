import type { GenCandidate } from './genHistory';

/** Pure FNV-1a-style string hash → unsigned 32-bit int. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Deterministic placeholder candidates for the generic `gallery` archetype
 * (ArchetypeStep). Each candidate gets an `hsl()` swatch hashed from
 * direction+field+batch+index — computed, so it never trips the no-hardcoded-hex
 * rule and is reproducible — plus a `{ [field]: index }` payload so selecting it
 * projects a numeric index ≥ 0 (the `selected(field)` acceptance is unchanged).
 * Pure + framework-free so it is unit-testable.
 */
export function genericGalleryCandidates(
  field: string,
  count: number,
  direction: string,
  seq: number,
): Omit<GenCandidate, 'id'>[] {
  return Array.from({ length: Math.max(0, count) }, (_, i) => {
    const seed = hash(`${direction}|${field}|${seq}|${i}`);
    const hue = seed % 360;
    const sat = 45 + ((seed >> 9) % 35);    // 45–79%
    const light = 40 + ((seed >> 17) % 25); // 40–64%
    return {
      swatch: `linear-gradient(135deg, hsl(${hue} ${sat}% ${light}%), hsl(${(hue + 28) % 360} ${sat}% ${Math.max(20, light - 12)}%))`,
      caption: `Variant ${i + 1}`,
      payload: { [field]: i },
    };
  });
}
