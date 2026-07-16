import { heatmapScale } from '@/lib/chart-colors';
import { createRNG } from '@/lib/seeded-rng';
import type { Obstacle, CoverPoint } from './types';

function isPointBehindObstacle(
  px: number, py: number,
  threatX: number, threatY: number,
  obstacles: Obstacle[],
): { covered: boolean; nearestId: string | null; elevBonus: number } {
  let bestCover = false;
  let nearestId: string | null = null;
  let bestDist = Infinity;
  let elevBonus = 0;

  for (const obs of obstacles) {
    // Direction from threat to candidate point
    const dirX = px - threatX;
    const dirY = py - threatY;
    const dirLen = Math.sqrt(dirX * dirX + dirY * dirY);
    if (dirLen < 1) continue;

    // Check if the obstacle lies between threat and point
    const toObsX = obs.x - threatX;
    const toObsY = obs.y - threatY;

    // Project obstacle onto threat->point line
    const ndx = dirX / dirLen;
    const ndy = dirY / dirLen;
    const proj = toObsX * ndx + toObsY * ndy;

    if (proj < 0 || proj > dirLen) continue; // Obstacle not between them

    // Perpendicular distance from obstacle center to the line
    const perpX = toObsX - proj * ndx;
    const perpY = toObsY - proj * ndy;
    const perpDist = Math.sqrt(perpX * perpX + perpY * perpY);

    // `w` is a diameter for pillars (rendered as r = w / 2 in CoverObstacles),
    // so the blocking radius is half of it — same convention as walls/elevation.
    const blockRadius = obs.type === 'pillar' ? obs.w * 0.5 : Math.max(obs.w, obs.h) * 0.5;

    if (perpDist < blockRadius + 30) {
      // This obstacle provides cover
      const dist = Math.sqrt(
        (px - obs.x) * (px - obs.x) + (py - obs.y) * (py - obs.y),
      );
      if (dist < bestDist) {
        bestDist = dist;
        nearestId = obs.id;
        bestCover = true;
      }
    }

    // Elevation bonus
    if (obs.type === 'elevation' && obs.elevation) {
      const distToElev = Math.sqrt(
        (px - obs.x) * (px - obs.x) + (py - obs.y) * (py - obs.y),
      );
      if (distToElev < Math.max(obs.w, obs.h) * 1.2) {
        elevBonus = Math.max(elevBonus, Math.min(obs.elevation / 300, 1));
      }
    }
  }

  return { covered: bestCover, nearestId, elevBonus };
}

export function generateCoverPoints(
  sampleCount: number,
  rings: number,
  minRadius: number,
  maxRadius: number,
  obstacles: Obstacle[],
  seed: number,
): CoverPoint[] {
  const points: CoverPoint[] = [];
  const threatX = 0;
  const threatY = 0;
  const rng = createRNG(seed);

  for (let ringIdx = 0; ringIdx < rings; ringIdx++) {
    const alpha = rings === 1 ? 0.5 : ringIdx / (rings - 1);
    const ringRadius = minRadius + (maxRadius - minRadius) * alpha;
    const angleStep = (2 * Math.PI) / sampleCount;

    for (let i = 0; i < sampleCount; i++) {
      const angle = angleStep * i;
      const x = Math.cos(angle) * ringRadius;
      const y = Math.sin(angle) * ringRadius;

      const { covered, nearestId, elevBonus } = isPointBehindObstacle(
        x, y, threatX, threatY, obstacles,
      );

      const coverScore = covered ? 0.7 + rng() * 0.3 : rng() * 0.15;
      const elevationScore = elevBonus;
      const combinedScore = coverScore * 0.6 + elevationScore * 0.4;

      points.push({
        x, y, ring: ringIdx, angle,
        coverScore,
        elevationScore,
        combinedScore,
        nearestObstacle: nearestId,
      });
    }
  }

  return points;
}

// ── Color mapping ───────────────────────────────────────────────────────────

export function coverColor(score: number): string {
  // 0 (exposed) → low end of heatmap; 1 (good cover) → high end.
  return heatmapScale(Math.min(Math.max(score, 0), 1));
}
