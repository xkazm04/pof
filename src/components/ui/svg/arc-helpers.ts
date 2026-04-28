/**
 * SVG arc/heatmap helpers shared by tactical/heatmap visualizers.
 *
 * `arcPath()` produces a closed SVG `<path d="…">` string for an annular arc
 * (donut wedge) bounded by two radii and two angles. This is the math
 * duplicated across FlankAngleHeatmap and TacticalCoverAnalysis (and likely
 * SquadChoreographyEditor / AttackRingVisualizer when those add arc rendering).
 *
 * Refs: docs/harness/ui-perfectionist-2026-04-28/18-ai-behavior-tactics.md (18.5)
 */

/**
 * Build an SVG path for an annular arc (donut wedge) between two angles.
 *
 * Angles are in radians, with 0 = +x axis (standard SVG convention).
 * The path starts at the outer-radius/start-angle point and goes:
 * outer-arc → inner-line → inner-arc back → close.
 */
export function arcPath(
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  startAngle: number,
  endAngle: number,
): string {
  const cos1 = Math.cos(startAngle);
  const sin1 = Math.sin(startAngle);
  const cos2 = Math.cos(endAngle);
  const sin2 = Math.sin(endAngle);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;

  const outerX1 = cx + outerR * cos1;
  const outerY1 = cy + outerR * sin1;
  const outerX2 = cx + outerR * cos2;
  const outerY2 = cy + outerR * sin2;
  const innerX1 = cx + innerR * cos1;
  const innerY1 = cy + innerR * sin1;
  const innerX2 = cx + innerR * cos2;
  const innerY2 = cy + innerR * sin2;

  return [
    `M ${outerX1} ${outerY1}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${outerX2} ${outerY2}`,
    `L ${innerX2} ${innerY2}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${innerX1} ${innerY1}`,
    `Z`,
  ].join(' ');
}
