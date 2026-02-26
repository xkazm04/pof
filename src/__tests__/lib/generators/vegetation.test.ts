import { describe, it, expect } from 'vitest';
import {
  generateVegetation,
  DEFAULT_VEGETATION_CONFIG,
  DEFAULT_SPECIES,
} from '@/lib/visual-gen/generators/vegetation';

describe('generateVegetation', () => {
  it('generates scatter points', () => {
    const points = generateVegetation(DEFAULT_VEGETATION_CONFIG);
    expect(points.length).toBeGreaterThan(0);
  });

  it('points are within bounds', () => {
    const config = { ...DEFAULT_VEGETATION_CONFIG, width: 50, height: 50 };
    const points = generateVegetation(config);

    for (const point of points) {
      expect(point.x).toBeGreaterThanOrEqual(0);
      expect(point.x).toBeLessThan(config.width);
      expect(point.y).toBeGreaterThanOrEqual(0);
      expect(point.y).toBeLessThan(config.height);
    }
  });

  it('points have valid rotation and scale', () => {
    const points = generateVegetation(DEFAULT_VEGETATION_CONFIG);

    for (const point of points) {
      expect(point.rotation).toBeGreaterThanOrEqual(0);
      expect(point.rotation).toBeLessThan(360);
      expect(point.scale).toBeGreaterThanOrEqual(0.5);
      expect(point.scale).toBeLessThanOrEqual(1.5);
    }
  });

  it('points reference valid species ids', () => {
    const speciesIds = DEFAULT_VEGETATION_CONFIG.species.map((s) => s.id);
    const points = generateVegetation(DEFAULT_VEGETATION_CONFIG);

    for (const point of points) {
      expect(speciesIds).toContain(point.speciesId);
    }
  });

  it('is deterministic for the same seed', () => {
    const config = { ...DEFAULT_VEGETATION_CONFIG, seed: 42 };
    const a = generateVegetation(config);
    const b = generateVegetation(config);

    expect(a).toEqual(b);
  });

  it('produces different results for different seeds', () => {
    const a = generateVegetation({ ...DEFAULT_VEGETATION_CONFIG, seed: 1 });
    const b = generateVegetation({ ...DEFAULT_VEGETATION_CONFIG, seed: 2 });

    // Point count or positions should differ
    const differs =
      a.length !== b.length ||
      a.some((p, i) => p.x !== b[i]?.x || p.y !== b[i]?.y);
    expect(differs).toBe(true);
  });

  it('generates points for each species', () => {
    const config = {
      ...DEFAULT_VEGETATION_CONFIG,
      species: DEFAULT_SPECIES.slice(0, 3),
    };
    const points = generateVegetation(config);

    const speciesSeen = new Set(points.map((p) => p.speciesId));
    for (const sp of config.species) {
      expect(speciesSeen.has(sp.id)).toBe(true);
    }
  });

  it('generates more points with higher maxAttempts', () => {
    const low = generateVegetation({ ...DEFAULT_VEGETATION_CONFIG, maxAttempts: 5 });
    const high = generateVegetation({ ...DEFAULT_VEGETATION_CONFIG, maxAttempts: 50 });

    expect(high.length).toBeGreaterThanOrEqual(low.length);
  });

  it('generates more points for larger areas', () => {
    const small = generateVegetation({ ...DEFAULT_VEGETATION_CONFIG, width: 30, height: 30 });
    const large = generateVegetation({ ...DEFAULT_VEGETATION_CONFIG, width: 150, height: 150 });

    expect(large.length).toBeGreaterThan(small.length);
  });

  it('respects species radius (Poisson disk property)', () => {
    // For a single species, no two points should be closer than the species radius
    const singleSpecies = DEFAULT_SPECIES[0]; // Oak Tree, radius=8
    const config = {
      ...DEFAULT_VEGETATION_CONFIG,
      species: [singleSpecies],
      width: 100,
      height: 100,
    };
    const points = generateVegetation(config);

    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const dx = points[i].x - points[j].x;
        const dy = points[i].y - points[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        expect(dist).toBeGreaterThanOrEqual(singleSpecies.radius * 0.99); // small tolerance
      }
    }
  });
});
