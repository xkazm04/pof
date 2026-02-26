/**
 * Vegetation scatter generation using Poisson disk sampling (Bridson's algorithm).
 */

export interface VegetationSpecies {
  id: string;
  name: string;
  /** Minimum distance between points of this species */
  radius: number;
  /** Hex color for preview */
  color: string;
}

export interface ScatterPoint {
  x: number;
  y: number;
  speciesId: string;
  rotation: number;  // 0-360 degrees
  scale: number;     // 0.5-1.5
}

export interface VegetationConfig {
  /** Area width */
  width: number;
  /** Area height */
  height: number;
  /** Species to scatter */
  species: VegetationSpecies[];
  /** Random seed */
  seed: number;
  /** Max attempts per active point (higher = denser fill) */
  maxAttempts: number;
}

export const DEFAULT_SPECIES: VegetationSpecies[] = [
  { id: 'tree-oak', name: 'Oak Tree', radius: 8, color: '#22c55e' },
  { id: 'tree-pine', name: 'Pine Tree', radius: 6, color: '#15803d' },
  { id: 'bush', name: 'Bush', radius: 3, color: '#84cc16' },
  { id: 'rock', name: 'Rock', radius: 4, color: '#6b7280' },
  { id: 'grass-clump', name: 'Grass Clump', radius: 1.5, color: '#a3e635' },
];

export const DEFAULT_VEGETATION_CONFIG: VegetationConfig = {
  width: 100,
  height: 100,
  species: DEFAULT_SPECIES.slice(0, 3),
  seed: 42,
  maxAttempts: 30,
};

/** Seeded RNG */
function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Bridson's algorithm for Poisson disk sampling.
 */
function poissonDisk(
  width: number,
  height: number,
  radius: number,
  rng: () => number,
  maxAttempts: number,
): Array<[number, number]> {
  const cellSize = radius / Math.SQRT2;
  const gridW = Math.ceil(width / cellSize);
  const gridH = Math.ceil(height / cellSize);
  const grid: (number | null)[][] = Array.from({ length: gridH }, () =>
    new Array(gridW).fill(null),
  );

  const points: Array<[number, number]> = [];
  const active: number[] = [];

  // First point
  const x0 = rng() * width;
  const y0 = rng() * height;
  const gi0 = Math.floor(x0 / cellSize);
  const gj0 = Math.floor(y0 / cellSize);
  grid[gj0][gi0] = 0;
  points.push([x0, y0]);
  active.push(0);

  while (active.length > 0) {
    const idx = Math.floor(rng() * active.length);
    const pointIdx = active[idx];
    const [px, py] = points[pointIdx];
    let found = false;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const angle = rng() * Math.PI * 2;
      const dist = radius + rng() * radius;
      const nx = px + Math.cos(angle) * dist;
      const ny = py + Math.sin(angle) * dist;

      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;

      const gi = Math.floor(nx / cellSize);
      const gj = Math.floor(ny / cellSize);

      // Check neighbors
      let tooClose = false;
      for (let dj = -2; dj <= 2 && !tooClose; dj++) {
        for (let di = -2; di <= 2 && !tooClose; di++) {
          const cj = gj + dj;
          const ci = gi + di;
          if (cj < 0 || cj >= gridH || ci < 0 || ci >= gridW) continue;
          const neighbor = grid[cj][ci];
          if (neighbor === null) continue;
          const [ox, oy] = points[neighbor];
          const dx = nx - ox;
          const dy = ny - oy;
          if (dx * dx + dy * dy < radius * radius) {
            tooClose = true;
          }
        }
      }

      if (!tooClose) {
        grid[gj][gi] = points.length;
        points.push([nx, ny]);
        active.push(points.length - 1);
        found = true;
        break;
      }
    }

    if (!found) {
      active.splice(idx, 1);
    }
  }

  return points;
}

/**
 * Generate vegetation scatter points for multiple species.
 */
export function generateVegetation(config: VegetationConfig): ScatterPoint[] {
  const { width, height, species, seed, maxAttempts } = config;
  const rng = mulberry32(seed);
  const allPoints: ScatterPoint[] = [];

  for (const sp of species) {
    const speciesSeed = seed + sp.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const speciesRng = mulberry32(speciesSeed);
    const positions = poissonDisk(width, height, sp.radius, speciesRng, maxAttempts);

    for (const [x, y] of positions) {
      allPoints.push({
        x,
        y,
        speciesId: sp.id,
        rotation: rng() * 360,
        scale: 0.7 + rng() * 0.6,
      });
    }
  }

  return allPoints;
}
