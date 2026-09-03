/**
 * Procedural terrain heightmap generation.
 * Implements Diamond-Square and Perlin noise algorithms.
 *
 * A heightfield is two grids wearing one array — a horizontal one defined by how far
 * apart the samples sit, and a vertical one defined by what the sample values mean —
 * and neither is recoverable from the numbers. A 129x129 field of values in [0, 1] is
 * equally a mountain range across forty kilometres and a gravel pile across four metres.
 * So the samples stay in their normalised numeric band and the basis travels BESIDE them
 * as `cellSizeM` / `verticalRangeM` (see `resolveTerrainBasis`), the same discipline
 * `linear-prop.ts` applies with "in metres" and `texel-density.ts` with `TEXEL_DENSITY_UNIT`.
 *
 * Slope — the only thing that decides whether ground is playable — is a ratio of vertical
 * to horizontal, so a field without this basis has no slope, and any traversability
 * verdict computed over it is a confident number about an assumption.
 */
import type { Result } from '@/types/result';
import { ok, err } from '@/types/result';

/** Seeded pseudo-random number generator (Mulberry32) */
function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The unit every spatial quantity in a TerrainConfig or TerrainBasis is written in. */
export const TERRAIN_UNIT = 'm' as const;

/** Levels a 16-bit heightmap export (`heightmapToUint16`) can represent. */
const UINT16_LEVELS = 65535;

export interface TerrainConfig {
  /**
   * SAMPLE COUNT per side (must be power of 2 + 1, e.g., 129, 257, 513).
   * This is NOT a resolution and NOT an extent — two grids of the same count over
   * different extents describe entirely different landscapes. The resolution is
   * `cellSizeM`.
   */
  size: number;
  /** Roughness factor (0-1). Higher = more rough terrain */
  roughness: number;
  /** Floor of the NORMALISED sample band. Unitless — `verticalRangeM` gives it meaning. */
  minHeight: number;
  /** Ceiling of the NORMALISED sample band. Unitless — `verticalRangeM` gives it meaning. */
  maxHeight: number;
  /** Random seed for reproducibility */
  seed: number;
  /**
   * Horizontal distance between two adjacent samples, in metres — the field's real
   * resolution. Optional only so configs persisted before the basis existed still load;
   * such a field resolves with `declared: false` and is not gradeable for slope.
   */
  cellSizeM?: number;
  /**
   * Metres of elevation the full `[minHeight, maxHeight]` sample band covers, with any
   * vertical exaggeration ALREADY folded in. One number describes the vertical after
   * generation — an exaggeration factor is a legitimate authoring control and an
   * illegitimate secret, and a second copy of it downstream is the duplicated-authority
   * defect whose signature is a world subtly and uniformly too dramatic.
   */
  verticalRangeM?: number;
}

/**
 * The basis the pipeline behaved as if it had before anything declared one:
 * `spacing = grid_size / max(rows, cols)` evaluated to 1 with the sample count passed as
 * the grid size, and the store hand-typed `heightScale: 10`. Kept as the fallback for
 * configs persisted before `cellSizeM` / `verticalRangeM` existed, so those reproduce
 * their previous world coordinates exactly — but they resolve `declared: false`.
 */
export const LEGACY_TERRAIN_BASIS = {
  cellSizeM: 1,
  verticalRangeM: 10,
} as const;

/** The resolved horizontal and vertical basis of a heightfield, in metres. */
export interface TerrainBasis {
  /** Horizontal distance between adjacent samples, in metres. */
  cellSizeM: number;
  /** Metres the full `[minHeight, maxHeight]` sample band covers (exaggeration folded in). */
  verticalRangeM: number;
  /** Metres per one unit of sample value — the ONE multiplier a consumer applies. */
  metresPerSampleM: number;
  /** Ground the grid covers per side, in metres: `(size - 1) * cellSizeM`. */
  extentM: number;
  /** Smallest elevation step a 16-bit export can express, in metres. */
  quantizationStepM: number;
  /** The unit both distances are written in. */
  unit: typeof TERRAIN_UNIT;
  /**
   * False when the config carried no basis and `LEGACY_TERRAIN_BASIS` was used. A field
   * resolved this way renders and exports, but slope, drainage, playable-area and any
   * elevation-keyed mask over it are NOT GRADEABLE — the basis was assumed, not stated.
   */
  declared: boolean;
}

export const DEFAULT_TERRAIN_CONFIG: TerrainConfig = {
  size: 129,
  roughness: 0.5,
  minHeight: 0,
  maxHeight: 1,
  seed: 42,
  // 128 cells at 1 m → a 128 m square field. Matches the spacing the Blender export
  // arrived at by accident before the basis was declared.
  cellSizeM: LEGACY_TERRAIN_BASIS.cellSizeM,
  // The store's old hand-typed `heightScale: 10`, folded in at the point the vertical is
  // CHOSEN instead of the point it is applied.
  verticalRangeM: LEGACY_TERRAIN_BASIS.verticalRangeM,
};

/**
 * Resolve the basis every downstream measurement reads. Fails rather than guessing when a
 * declared value is unusable: an inferred vertical is always plausible, and a plausible
 * number ships where an absent one blocks.
 */
export function resolveTerrainBasis(config: TerrainConfig): Result<TerrainBasis, string> {
  const declared = config.cellSizeM !== undefined || config.verticalRangeM !== undefined;
  const cellSizeM = config.cellSizeM ?? LEGACY_TERRAIN_BASIS.cellSizeM;
  const verticalRangeM = config.verticalRangeM ?? LEGACY_TERRAIN_BASIS.verticalRangeM;

  if (!Number.isFinite(cellSizeM) || cellSizeM <= 0) {
    return err(`cellSizeM must be a positive number of ${TERRAIN_UNIT} (got ${config.cellSizeM})`);
  }
  if (!Number.isFinite(verticalRangeM) || verticalRangeM <= 0) {
    return err(
      `verticalRangeM must be a positive number of ${TERRAIN_UNIT} (got ${config.verticalRangeM})`,
    );
  }

  const sampleSpan = config.maxHeight - config.minHeight;
  if (!Number.isFinite(sampleSpan) || sampleSpan <= 0) {
    return err(
      `maxHeight (${config.maxHeight}) must exceed minHeight (${config.minHeight}) — ` +
        'a zero sample band has no vertical to scale',
    );
  }

  return ok({
    cellSizeM,
    verticalRangeM,
    metresPerSampleM: verticalRangeM / sampleSpan,
    extentM: Math.max(0, config.size - 1) * cellSizeM,
    quantizationStepM: verticalRangeM / UINT16_LEVELS,
    unit: TERRAIN_UNIT,
    declared,
  });
}

/** One-line provenance for a resolved basis — carried into exports so a mesh is never anonymous. */
export function describeTerrainBasis(basis: TerrainBasis): string {
  const source = basis.declared ? 'declared' : 'UNDECLARED (legacy fallback — not gradeable)';
  return (
    `${basis.cellSizeM} ${basis.unit}/sample, ` +
    `${basis.verticalRangeM} ${basis.unit} vertical range ` +
    `(${basis.metresPerSampleM} ${basis.unit} per sample unit), ` +
    `extent ${basis.extentM} ${basis.unit} — ${source}`
  );
}

/**
 * Generate a heightmap using the Diamond-Square algorithm.
 * Returns a 2D array of float values between minHeight and maxHeight.
 */
export function generateDiamondSquare(config: TerrainConfig): number[][] {
  const { size, roughness, minHeight, maxHeight, seed } = config;
  const rng = mulberry32(seed);

  // Initialize grid
  const grid: number[][] = Array.from({ length: size }, () =>
    new Array(size).fill(0),
  );

  // Seed corners
  grid[0][0] = rng();
  grid[0][size - 1] = rng();
  grid[size - 1][0] = rng();
  grid[size - 1][size - 1] = rng();

  let step = size - 1;
  let scale = roughness;

  while (step > 1) {
    const half = step >> 1;

    // Diamond step
    for (let y = half; y < size; y += step) {
      for (let x = half; x < size; x += step) {
        const avg =
          (grid[y - half][x - half] +
            grid[y - half][x + half] +
            grid[y + half][x - half] +
            grid[y + half][x + half]) /
          4;
        grid[y][x] = avg + (rng() - 0.5) * scale;
      }
    }

    // Square step
    for (let y = 0; y < size; y += half) {
      for (let x = (y + half) % step; x < size; x += step) {
        let sum = 0;
        let count = 0;
        if (y - half >= 0) { sum += grid[y - half][x]; count++; }
        if (y + half < size) { sum += grid[y + half][x]; count++; }
        if (x - half >= 0) { sum += grid[y][x - half]; count++; }
        if (x + half < size) { sum += grid[y][x + half]; count++; }
        grid[y][x] = sum / count + (rng() - 0.5) * scale;
      }
    }

    step = half;
    scale *= roughness;
  }

  // Normalize to [minHeight, maxHeight]
  let min = Infinity;
  let max = -Infinity;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      min = Math.min(min, grid[y][x]);
      max = Math.max(max, grid[y][x]);
    }
  }

  const range = max - min || 1;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      grid[y][x] = minHeight + ((grid[y][x] - min) / range) * (maxHeight - minHeight);
    }
  }

  return grid;
}

/**
 * Convert a heightmap to a flat Uint16Array for PNG export.
 */
export function heightmapToUint16(heightmap: number[][]): Uint16Array {
  const size = heightmap.length;
  const data = new Uint16Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      data[y * size + x] = Math.round(heightmap[y][x] * 65535);
    }
  }
  return data;
}
