/**
 * Deterministic waveform thumbnail generator.
 *
 * We don't decode the mp3/wav PCM client-side (that needs the async Web Audio
 * API and won't run in tests); instead each asset gets a *stable visual
 * fingerprint* derived from its prompt hash / id. The same seed always yields
 * the same bars, so a variation looks identical across renders and two distinct
 * variations look different — enough to scan a library at a glance.
 */

/** FNV-1a string hash → unsigned 32-bit. Stable, no crypto, runs anywhere. */
function hashSeed(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Normalised bar heights in [0.08, 1] for a waveform sparkline. Deterministic
 * for a given `seed`. A soft envelope tapers the ends so it reads as a clip
 * rather than noise.
 */
export function waveformBars(seed: string, count = 32): number[] {
  const safeCount = Math.max(1, Math.floor(count));
  let state = hashSeed(seed || 'audio') || 1;
  const bars: number[] = [];
  for (let i = 0; i < safeCount; i++) {
    // xorshift32 PRNG — deterministic from the seed.
    state ^= state << 13; state >>>= 0;
    state ^= state >> 17;
    state ^= state << 5; state >>>= 0;
    const r = state / 0xffffffff; // 0..1

    // Envelope: fade in/out across the clip (sine arch), keep a noise floor.
    const t = safeCount === 1 ? 0.5 : i / (safeCount - 1);
    const envelope = 0.35 + 0.65 * Math.sin(Math.PI * t);
    const height = 0.08 + 0.92 * r * envelope;
    bars.push(Math.min(1, Math.max(0.08, height)));
  }
  return bars;
}
