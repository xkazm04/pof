/**
 * A faithful TypeScript port of Unreal Engine's `FRandomStream` — the exact
 * seeded RNG the procedural-level C++ codegen targets (see
 * `buildProceduralLevelPrompt`, which instructs "Use FRandomStream with seed
 * for all random operations"). Running the same RNG client-side means the live
 * in-browser preview is faithful to what UE will produce for a given seed.
 *
 * UE's implementation (Engine/Source/Runtime/Core/Public/Math/RandomStream.h):
 *   void  MutateSeed()  { Seed = (Seed * 196314165) + 907633515; }
 *   float GetFraction() { MutateSeed(); return (Seed reinterpreted) … in [0,1) }
 *   int32 RandHelper(A) { return A > 0 ? min(trunc(GetFraction()*A), A-1) : 0; }
 *   int32 RandRange(Min,Max) { return Min + RandHelper((Max-Min)+1); }
 *
 * The fraction uses UE's float-bit trick `0x3F800000 | (Seed >> 9)`, which is
 * algebraically `(Seed >>> 9) / 2^23`, reproduced here without bit-casting.
 */
export class FRandomStream {
  private seed: number;

  constructor(seed: number) {
    // Coerce to int32, matching UE's int32 Seed field.
    this.seed = seed | 0;
  }

  /** UE: Seed = (Seed * 196314165) + 907633515, wrapped to int32. */
  private mutate(): void {
    this.seed = (Math.imul(this.seed, 196314165) + 907633515) | 0;
  }

  /** Deterministic float in [0, 1) — UE's FRandomStream::GetFraction. */
  getFraction(): number {
    this.mutate();
    // (uint32(Seed) >> 9) / 2^23 — `>>> 9` gives the unsigned shift UE relies on.
    return (this.seed >>> 9) / 8388608;
  }

  /** Integer in [0, n) — UE's FRandomStream::RandHelper. */
  randHelper(n: number): number {
    return n > 0 ? Math.min(Math.trunc(this.getFraction() * n), n - 1) : 0;
  }

  /** Inclusive integer in [min, max] — UE's FRandomStream::RandRange. */
  randRange(min: number, max: number): number {
    const range = max - min + 1;
    return min + this.randHelper(range);
  }

  /** Convenience: a coin flip biased by `p` (probability of true). */
  chance(p: number): boolean {
    return this.getFraction() < p;
  }
}

/** Default seed used for the live preview when the designer leaves the seed blank. */
export const DEFAULT_PREVIEW_SEED = 1337;

/**
 * Resolve the wizard's free-text seed field into a stable int32 seed for
 * {@link FRandomStream}. Numeric and `0x`-hex strings parse directly; anything
 * else is hashed with FNV-1a so any label ("dark-keep") maps to a fixed seed.
 * An empty/whitespace field falls back to {@link DEFAULT_PREVIEW_SEED} so the
 * preview stays deterministic (never wall-clock random) before the seed is set.
 */
export function hashSeed(raw: string): number {
  const trimmed = raw.trim();
  if (trimmed === '') return DEFAULT_PREVIEW_SEED;

  // Plain or hex integer → use directly.
  if (/^-?\d+$/.test(trimmed)) return Number(trimmed) | 0;
  if (/^0x[0-9a-fA-F]+$/.test(trimmed)) return Number.parseInt(trimmed.slice(2), 16) | 0;

  // Otherwise FNV-1a hash the string into an int32.
  let h = 0x811c9dc5;
  for (let i = 0; i < trimmed.length; i++) {
    h ^= trimmed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h | 0;
}
