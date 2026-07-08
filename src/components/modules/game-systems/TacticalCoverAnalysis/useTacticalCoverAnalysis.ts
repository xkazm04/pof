import { useState, useMemo, useCallback, useRef } from 'react';
import {
  DRAW_RADIUS,
  DEFAULT_MIN_RADIUS,
  DEFAULT_MAX_RADIUS,
  DEFAULT_SAMPLE_COUNT,
  DEFAULT_COVER_CHECK,
  DEFAULT_RINGS,
  MOCK_OBSTACLES,
} from './constants';
import { generateCoverPoints, coverColor } from './helpers';
import type { CoverPoint, ScoreMode } from './types';

export function useTacticalCoverAnalysis() {
  const [sampleCount] = useState(DEFAULT_SAMPLE_COUNT);
  const [rings] = useState(DEFAULT_RINGS);
  const [minRadius] = useState(DEFAULT_MIN_RADIUS);
  const [maxRadius] = useState(DEFAULT_MAX_RADIUS);
  const [coverCheck] = useState(DEFAULT_COVER_CHECK);
  const [scoreMode, setScoreMode] = useState<ScoreMode>('combined');
  const [showLOSTraces, setShowLOSTraces] = useState(true);
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);
  const [seed, setSeed] = useState(0);
  const svgRef = useRef<SVGSVGElement>(null);

  const scale = DRAW_RADIUS / maxRadius;

  const points = useMemo(
    () => generateCoverPoints(sampleCount, rings, minRadius, maxRadius, MOCK_OBSTACLES, seed),
    [sampleCount, rings, minRadius, maxRadius, seed],
  );

  const getScore = useCallback((pt: CoverPoint) => {
    if (scoreMode === 'cover') return pt.coverScore;
    if (scoreMode === 'elevation') return pt.elevationScore;
    return pt.combinedScore;
  }, [scoreMode]);

  const bestPoint = useMemo(
    () => points.reduce((best, p) => (getScore(p) > getScore(best) ? p : best), points[0]),
    [points, getScore],
  );

  const coveredCount = useMemo(
    () => points.filter((p) => p.coverScore > 0.5).length,
    [points],
  );

  const elevatedCount = useMemo(
    () => points.filter((p) => p.elevationScore > 0.2).length,
    [points],
  );

  const regenerate = useCallback(() => setSeed((s) => s + 1), []);

  // Heatmap arcs — coverage quality around the ring
  const heatmapArcs = useMemo(() => {
    const segments = 72;
    const step = (2 * Math.PI) / segments;
    return Array.from({ length: segments }, (_, i) => {
      const midAngle = step * i + step / 2;
      // Find closest point to this arc to estimate coverage
      const closest = points.reduce((best, p) => {
        const angleDiff = Math.abs(
          ((p.angle - midAngle + Math.PI) % (2 * Math.PI)) - Math.PI,
        );
        const bestDiff = Math.abs(
          ((best.angle - midAngle + Math.PI) % (2 * Math.PI)) - Math.PI,
        );
        return angleDiff < bestDiff ? p : best;
      }, points[0]);
      const score = getScore(closest);
      return {
        startAngle: step * i,
        endAngle: step * (i + 1),
        score,
        color: coverColor(score),
      };
    });
  }, [points, getScore]);

  // LOS-trace candidates — covered points only. Depends solely on `points`,
  // so hover state does not recompute this filter.
  const losTracePoints = useMemo(
    () => points.filter((p) => p.coverScore > 0.5),
    [points],
  );

  // Best positions (top 5 by current score mode). Keyed on `points`/`getScore`
  // so hovering a dot no longer re-sorts the whole cloud.
  const bestPositions = useMemo(
    () => [...points].sort((a, b) => getScore(b) - getScore(a)).slice(0, 5),
    [points, getScore],
  );

  return {
    sampleCount, rings, minRadius, maxRadius, coverCheck,
    scoreMode, setScoreMode,
    showLOSTraces, setShowLOSTraces,
    hoveredPoint, setHoveredPoint,
    seed, setSeed,
    svgRef, scale, points, getScore, bestPoint,
    coveredCount, elevatedCount, regenerate,
    heatmapArcs, losTracePoints, bestPositions,
  };
}
