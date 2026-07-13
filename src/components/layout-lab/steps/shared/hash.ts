/**
 * One shared string hash for the lab's deterministic candidate generators.
 *
 * FNV-1a → unsigned 32-bit int. Pure + deterministic (no `Math.random`), so it is
 * safe to call from event handlers and stable under test: the same direction/seed
 * always yields the same swatch. Single-sourced here so the generic gallery
 * (`genericGalleryCandidates`) and the bespoke Items generators (`itemGenCandidates`)
 * can't drift apart with two near-identical copies.
 */
export function fnv1a(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
