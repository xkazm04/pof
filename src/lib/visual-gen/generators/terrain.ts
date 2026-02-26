/**
 * Procedural terrain heightmap generation.
 * Implements Diamond-Square and Perlin noise algorithms.
 */

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

export interface TerrainConfig {
  /** Size of the heightmap (must be power of 2 + 1, e.g., 129, 257, 513) */
  size: number;
  /** Roughness factor (0-1). Higher = more rough terrain */
  roughness: number;
  /** Minimum height value */
  minHeight: number;
  /** Maximum height value */
  maxHeight: number;
  /** Random seed for reproducibility */
  seed: number;
}

export const DEFAULT_TERRAIN_CONFIG: TerrainConfig = {
  size: 129,
  roughness: 0.5,
  minHeight: 0,
  maxHeight: 1,
  seed: 42,
};

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
