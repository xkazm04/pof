import { describe, it, expect } from 'vitest';
import {
  computeFlankAngle,
  distance,
  ringPoint,
  forwardVector,
} from '@/lib/ai-director/eqs-geometry';

describe('computeFlankAngle', () => {
  // Mirrors C++ UEnvQueryTest_FlankAngle: 0° = in front, 180° = behind.
  it('returns 0° for a point directly in front of the forward vector', () => {
    expect(computeFlankAngle(1, 0, 10, 0)).toBeCloseTo(0, 6);
  });

  it('returns 180° for a point directly behind the forward vector', () => {
    expect(computeFlankAngle(1, 0, -10, 0)).toBeCloseTo(180, 6);
  });

  it('returns 90° for a point to the side', () => {
    expect(computeFlankAngle(1, 0, 0, 10)).toBeCloseTo(90, 6);
    expect(computeFlankAngle(1, 0, 0, -10)).toBeCloseTo(90, 6);
  });

  it('is invariant to the point distance (only direction matters)', () => {
    expect(computeFlankAngle(0, 1, 5, 5)).toBeCloseTo(
      computeFlankAngle(0, 1, 50, 50),
      6,
    );
  });

  it('returns 0 for a point at (≈) the origin, matching the C++ IsNearlyZero guard', () => {
    expect(computeFlankAngle(1, 0, 0, 0)).toBe(0);
    expect(computeFlankAngle(1, 0, 0.0001, 0.0001)).toBe(0);
  });

  it('never returns NaN even when the dot product overshoots ±1', () => {
    // Co-linear unit vectors can produce a dot of 1.0000000002 in float math;
    // the clamp must keep acos defined.
    const angle = computeFlankAngle(1, 0, 1, 0);
    expect(Number.isNaN(angle)).toBe(false);
    expect(angle).toBeCloseTo(0, 6);
  });
});

describe('distance', () => {
  it('computes the Euclidean distance between two points', () => {
    expect(distance(0, 0, 3, 4)).toBe(5);
  });

  it('returns 0 for coincident points', () => {
    expect(distance(7, -2, 7, -2)).toBe(0);
  });
});

describe('ringPoint', () => {
  it('places a point on a ring of the given radius at the given angle', () => {
    expect(ringPoint(0, 200)).toEqual({ x: 200, y: 0 });
    const p = ringPoint(Math.PI / 2, 100);
    expect(p.x).toBeCloseTo(0, 6);
    expect(p.y).toBeCloseTo(100, 6);
  });
});

describe('forwardVector', () => {
  it('returns the unit vector for a heading angle', () => {
    expect(forwardVector(0)).toEqual({ x: 1, y: 0 });
    const up = forwardVector(-Math.PI / 2);
    expect(up.x).toBeCloseTo(0, 6);
    expect(up.y).toBeCloseTo(-1, 6);
  });
});
