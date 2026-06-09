import { describe, test, expect } from 'vitest';
import { generatePatrolPoints } from '@/components/modules/game-systems/PatrolPointsDistribution';
import {
  generateCoverPoints,
  MOCK_OBSTACLES,
} from '@/components/modules/game-systems/TacticalCoverAnalysis';

describe('generatePatrolPoints (seeded)', () => {
  test('is deterministic for the same seed', () => {
    const a = generatePatrolPoints(15, 500, 1500, 0);
    const b = generatePatrolPoints(15, 500, 1500, 0);
    expect(b).toEqual(a);
  });

  test('produces a different distribution for a different seed', () => {
    const a = generatePatrolPoints(15, 500, 1500, 0);
    const b = generatePatrolPoints(15, 500, 1500, 1);
    expect(b).not.toEqual(a);
  });

  test('respects point count and radius bounds', () => {
    const pts = generatePatrolPoints(15, 500, 1500, 3);
    expect(pts).toHaveLength(15);
    for (const p of pts) {
      expect(p.radius).toBeGreaterThanOrEqual(500);
      expect(p.radius).toBeLessThanOrEqual(1500);
    }
  });
});

describe('generateCoverPoints (seeded)', () => {
  test('is deterministic for the same seed', () => {
    const a = generateCoverPoints(36, 3, 300, 1200, MOCK_OBSTACLES, 0);
    const b = generateCoverPoints(36, 3, 300, 1200, MOCK_OBSTACLES, 0);
    expect(b).toEqual(a);
  });

  test('produces a different distribution for a different seed', () => {
    const a = generateCoverPoints(36, 3, 300, 1200, MOCK_OBSTACLES, 0);
    const b = generateCoverPoints(36, 3, 300, 1200, MOCK_OBSTACLES, 1);
    expect(b).not.toEqual(a);
  });

  test('produces sampleCount × rings points with scores in [0, 1]', () => {
    const pts = generateCoverPoints(36, 3, 300, 1200, MOCK_OBSTACLES, 2);
    expect(pts).toHaveLength(36 * 3);
    for (const p of pts) {
      expect(p.coverScore).toBeGreaterThanOrEqual(0);
      expect(p.coverScore).toBeLessThanOrEqual(1);
      expect(p.combinedScore).toBeGreaterThanOrEqual(0);
      expect(p.combinedScore).toBeLessThanOrEqual(1);
    }
  });
});
