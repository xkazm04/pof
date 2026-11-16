/**
 * Polar SVG layout — the `SVG_SIZE` / `SVG_CENTER` / `SVG_PADDING` / `DRAW_RADIUS`
 * block that the tactical/EQS visualizers (FlankAngleHeatmap, SquadChoreography,
 * TacticalCoverAnalysis, PatrolPointsDistribution, AttackRingVisualizer) each
 * copy-pasted verbatim. One source of truth for the math so a tweak (e.g. how
 * padding eats into the draw radius) lands everywhere at once.
 */

export interface PolarSvgLayout {
  /** Full viewBox edge length (square). */
  size: number;
  /** Center coordinate (`size / 2`) — the polar origin. */
  center: number;
  /** Padding reserved on every edge for labels/markers. */
  padding: number;
  /** Drawable radius from center out to the padded edge. */
  radius: number;
}

/**
 * Compute a square polar SVG layout from its edge length and edge padding.
 *
 * `radius` is the distance from center to the inner edge of the padding, i.e.
 * the largest ring that still fits inside the padded box: `(size - padding*2)/2`.
 */
export function polarSvgLayout(size: number, padding: number): PolarSvgLayout {
  return {
    size,
    center: size / 2,
    padding,
    radius: (size - padding * 2) / 2,
  };
}

/** A point on a ring; `angle` is the ring angle in radians (0 = +x, counter-clockwise on screen y-down). */
export interface RingPoint {
  x: number;
  y: number;
  angle: number;
}

/**
 * `count` points at even angles (`2π·i/count`, starting at +x) around a ring of
 * `radius`, offset by `center` on both axes (omit for an origin-centred ring).
 * The one ring rule shared by AttackRingVisualizer and FlankAngleHeatmap.
 */
export function ringPoints(count: number, radius: number, center = 0): RingPoint[] {
  const step = (2 * Math.PI) / count;
  return Array.from({ length: count }, (_, i) => {
    const angle = step * i;
    return {
      x: center + Math.cos(angle) * radius,
      y: center + Math.sin(angle) * radius,
      angle,
    };
  });
}
