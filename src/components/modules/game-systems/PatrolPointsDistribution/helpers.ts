import { createRNG } from '@/lib/seeded-rng';

// ── Point generation (mirrors UEnvQueryGenerator_PatrolPoints::GenerateItems) ─

export interface PatrolPoint {
  x: number;
  y: number;
  angle: number;
  radius: number;
}

export function generatePatrolPoints(
  numPoints: number,
  minRadius: number,
  maxRadius: number,
  seed: number,
): PatrolPoint[] {
  const points: PatrolPoint[] = [];
  const minR = Math.max(minRadius, 0);
  const maxR = Math.max(maxRadius, minR + 1);
  const rng = createRNG(seed);

  for (let i = 0; i < numPoints; i++) {
    const angle = rng() * 2 * Math.PI;
    const radius = minR + rng() * (maxR - minR);
    points.push({
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      angle,
      radius,
    });
  }
  return points;
}
