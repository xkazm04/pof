/**
 * Mulberry32 seeded PRNG.
 * Returns a closure that produces deterministic floats in [0, 1).
 */
export function createRNG(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * XORShift32 seeded PRNG — a distinct stream from {@link createRNG} (mulberry32).
 * Returns a closure that produces deterministic floats.
 *
 * `normalize` is the divisor applied to the 32-bit state. It defaults to 2^32
 * (`4294967296`), the canonical [0, 1) form used by the combat predictive-balance
 * sweep and the loot drop simulator. The squad director was authored against the
 * legacy 2^32-1 (`0xFFFFFFFF`) divisor and passes it explicitly so its
 * deterministic output is preserved byte-for-byte.
 */
export function createXorShift32RNG(seed: number, normalize = 4294967296): () => number {
  let s = seed | 0 || 1;
  return () => {
    s ^= s << 13;
    // Unsigned shift: XORShift32 requires `>>>`. The signed `>>` sign-extends the negative
    // 32-bit state, biasing the stream and shortening its period — corrupting every statistic
    // the loot drop simulator / combat sweep compute from it.
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / normalize;
  };
}
