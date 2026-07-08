import { useState, useMemo, useCallback, useRef } from 'react';
import { useDragAngle } from '@/hooks/useDragAngle';
import {
  ATTACK_DISTANCE, NUMBER_OF_POINTS, SVG_CENTER, DRAW_RADIUS,
} from './constants';
import { generateRingPoints, generateHeatmapArcs } from './helpers';

export function useFlankAngleHeatmap() {
  // Forward direction as angle in radians (0 = right/east, PI/2 = down/south in SVG)
  // Default: pointing up (north) = -PI/2
  const [forwardAngle, setForwardAngle] = useState(-Math.PI / 2);
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Drag the cyan handle to rotate the forward vector — shared pointer math.
  const drag = useDragAngle(svgRef, SVG_CENTER, setForwardAngle);

  const scale = DRAW_RADIUS / ATTACK_DISTANCE;

  const points = useMemo(
    () => generateRingPoints(NUMBER_OF_POINTS, forwardAngle),
    [forwardAngle],
  );

  const heatmapArcs = useMemo(
    () => generateHeatmapArcs(forwardAngle),
    [forwardAngle],
  );

  const bestPoint = useMemo(
    () => points.reduce((best, p) => (p.flankDeg > best.flankDeg ? p : best), points[0]),
    [points],
  );

  const resetForward = useCallback(() => setForwardAngle(-Math.PI / 2), []);

  // Forward arrow endpoint
  const arrowLen = DRAW_RADIUS * 0.85;
  const arrowEndX = SVG_CENTER + Math.cos(forwardAngle) * arrowLen;
  const arrowEndY = SVG_CENTER + Math.sin(forwardAngle) * arrowLen;

  // Forward degrees for display (0=up, clockwise)
  const forwardDeg = ((forwardAngle * 180 / Math.PI) + 90 + 360) % 360;

  return {
    forwardAngle,
    hoveredPoint,
    setHoveredPoint,
    svgRef,
    drag,
    scale,
    points,
    heatmapArcs,
    bestPoint,
    resetForward,
    arrowLen,
    arrowEndX,
    arrowEndY,
    forwardDeg,
  };
}
