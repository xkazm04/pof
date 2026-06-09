/* ------------------------------------------------------------------ */
/*  Localization Pipeline — Stable String Hash                         */
/* ------------------------------------------------------------------ */

/**
 * Deterministic 32-bit string hash (djb2-style) returning a non-negative
 * integer. Used to seed stable IDs and lookup keys across the localization
 * pipeline (scan + translation engines), so the value MUST stay constant —
 * changing the algorithm would re-key every previously generated string ID.
 */
export function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}
