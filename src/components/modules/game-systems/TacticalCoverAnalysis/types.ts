// ── Mock obstacles (walls, pillars) for visualization ───────────────────────

export interface Obstacle {
  id: string;
  label: string;
  type: 'wall' | 'pillar' | 'elevation';
  /** World-space position relative to threat center */
  x: number;
  y: number;
  /**
   * For walls: width/height; for elevation: footprint width/height.
   * For pillars: `w` is a DIAMETER (rendered as r = w / 2 in CoverObstacles,
   * and halved the same way for the cover-check blocking radius in helpers.ts)
   * — not a radius, despite the field name.
   */
  w: number;
  h: number;
  elevation?: number;
}

// ── Cover position computation ──────────────────────────────────────────────

export interface CoverPoint {
  x: number;
  y: number;
  ring: number;
  angle: number;
  coverScore: number;     // 0.0=exposed, 1.0=full cover (LOS)
  elevationScore: number; // 0.0=flat, 1.0=max height advantage
  combinedScore: number;
  nearestObstacle: string | null;
}

export type ScoreMode = 'cover' | 'elevation' | 'combined';
