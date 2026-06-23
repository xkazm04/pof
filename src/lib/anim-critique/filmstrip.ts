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

/** Evenly pick `n` items from `arr`, always keeping the first and last. Pure. */
function subsample<T>(arr: T[], n: number): T[] {
  if (n >= arr.length || n <= 1) return n <= 1 && arr.length ? [arr[0]] : arr;
  const out: T[] = [];
  for (let i = 0; i < n; i++) {
    out.push(arr[Math.round((i * (arr.length - 1)) / (n - 1))]);
  }
  return out;
}

export function resolveFilmstrip(files: string[], opts: FilmstripOptions = {}): string[] {
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

  return opts.maxFrames ? subsample(ordered, opts.maxFrames) : ordered;
}
