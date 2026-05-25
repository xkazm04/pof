/** Defensive division: returns `fallback` when the denominator is 0, NaN,
 *  or non-finite, or when the numerator is non-finite. Keeps HUD readouts
 *  from rendering "Infinity" or "NaN" on edge-value inputs. */
export function safeDivide(numerator: number, denominator: number, fallback = 0): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return fallback;
  }
  return numerator / denominator;
}
