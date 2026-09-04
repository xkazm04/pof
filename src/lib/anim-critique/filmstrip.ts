/**
 * Resolve an ordered filmstrip from a list of capture filenames. Pure. Handles both the
 * observation capture (`frame_NN.png` / `frame_NN_side.png`) and the L4 scenario capture
 * (`shot_NN.png`) naming, numeric-sorted (so frame_10 follows frame_2, not frame_1).
 *
 * A capture dir often holds BOTH families — we pick ONE source (frame_ preferred) rather
 * than interleaving them, and can subsample to a max so the model gets a clean motion arc.
 */

const FRAME_RE = /^(frame|shot)_(\d+)(_side)?\.png$/i;

export interface FilmstripOptions {
  /** Which camera's frames to use. Default 'main' (the side cam `_side` frames are dropped). */
  cam?: 'main' | 'side';
  /** Cap the strip to this many frames, subsampled evenly (first + last kept). */
  maxFrames?: number;
}

/**
 * How the strip that reaches the judge relates to the strip that was captured.
 *
 * "The sampling is part of the instrument": a judge asked to score TIMING on a strip whose
 * spacing the sampler made uneven is being asked to grade the sampler. The real cap (10)
 * against a common 14-frame capture keeps source indices 0,1,3,4,6,7,9,10,12,13 — gaps of
 * 1,2,1,2,1,2,1,2,1 — so `uniform` is false and every consumer must say so.
 */
export interface FilmstripSampling {
  /** Frames actually sent to the judge. */
  kept: number;
  /** Frames the capture held for this cam/family. */
  available: number;
  /** True when consecutive kept frames sit a CONSTANT distance apart in the source. */
  uniform: boolean;
  /** That constant source-frame distance when uniform; null when the spacing varies. */
  stride: number | null;
  /** The distinct source-frame gaps present, ascending. `[1]` = every frame kept. */
  gaps: number[];
}

export interface FilmstripSample extends FilmstripSampling {
  /** The chosen filenames, in time order. */
  frames: string[];
}

/** Which source indices an even-as-possible pick of `n` from `len` keeps. Pure. */
function sampleIndices(len: number, n: number): number[] {
  if (n >= len || n <= 1) return n <= 1 && len ? [0] : Array.from({ length: len }, (_, i) => i);
  return Array.from({ length: n }, (_, i) => Math.round((i * (len - 1)) / (n - 1)));
}

function describeSpacing(indices: number[]): Pick<FilmstripSampling, 'uniform' | 'stride' | 'gaps'> {
  const gapList = indices.slice(1).map((v, i) => v - indices[i]);
  const gaps = [...new Set(gapList)].sort((a, b) => a - b);
  // A single kept frame (or a single gap value) is evenly spaced by definition.
  const uniform = gaps.length <= 1;
  return { uniform, stride: uniform ? (gaps[0] ?? 1) : null, gaps: gaps.length ? gaps : [1] };
}

/** Frames ONLY (the original seam). Identical selection to `sampleFilmstrip().frames`. */
export function resolveFilmstrip(files: string[], opts: FilmstripOptions = {}): string[] {
  return sampleFilmstrip(files, opts).frames;
}

/**
 * Resolve the filmstrip AND report how it was sampled. Pure.
 *
 * The selection is byte-identical to what `resolveFilmstrip` has always returned — this adds
 * only the honesty: a non-uniform strip may not be presented to a judge as an evenly-spaced
 * filmstrip, and the response/CLI must say kept-of-available rather than a bare frame count.
 */
export function sampleFilmstrip(files: string[], opts: FilmstripOptions = {}): FilmstripSample {
  const cam = opts.cam ?? 'main';
  const parsed = files
    .map((f) => ({ f, m: f.match(FRAME_RE) }))
    .filter((x): x is { f: string; m: RegExpMatchArray } => x.m !== null)
    .filter((x) => (cam === 'side' ? x.m[3] !== undefined : x.m[3] === undefined));

  // One source only: prefer the observation `frame_` family, else `shot_`.
  const prefix = parsed.some((x) => x.m[1].toLowerCase() === 'frame') ? 'frame' : 'shot';
  const ordered = parsed
    .filter((x) => x.m[1].toLowerCase() === prefix)
    .sort((a, b) => Number(a.m[2]) - Number(b.m[2]))
    .map((x) => x.f);

  const indices = opts.maxFrames
    ? sampleIndices(ordered.length, opts.maxFrames)
    : ordered.map((_, i) => i);
  return {
    frames: indices.map((i) => ordered[i]),
    kept: indices.length,
    available: ordered.length,
    ...describeSpacing(indices),
  };
}
