'use client';

import { useState, useMemo, useCallback } from 'react';
import { Target, RotateCcw } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { ACCENT_CYAN, OPACITY_10 } from '@/lib/chart-colors';
import {
  DEFAULT_ATTACK_DISTANCE, DEFAULT_NUMBER_OF_POINTS, DEFAULT_INNER_RING,
  MAX_DISTANCE, SVG_CENTER, MAX_DRAW_RADIUS,
} from './constants';
import { AttackRingSvg } from './AttackRingSvg';
import { AttackRingControls } from './AttackRingControls';

export function AttackRingVisualizer() {
  const [numPoints, setNumPoints] = useState(DEFAULT_NUMBER_OF_POINTS);
  const [attackDist, setAttackDist] = useState(DEFAULT_ATTACK_DISTANCE);
  const [innerRing, setInnerRing] = useState(DEFAULT_INNER_RING);

  const reset = useCallback(() => {
    setNumPoints(DEFAULT_NUMBER_OF_POINTS);
    setAttackDist(DEFAULT_ATTACK_DISTANCE);
    setInnerRing(DEFAULT_INNER_RING);
  }, []);

  // Scale: map world-space attack distance to SVG radius. Derived from the
  // slider's max (MAX_DISTANCE) so the outer ring lands exactly on MAX_DRAW_RADIUS
  // at full distance and always fits inside the viewBox.
  const scale = MAX_DRAW_RADIUS / MAX_DISTANCE;
  const outerR = attackDist * scale;
  const innerR = (attackDist * 0.5) * scale;

  const outerPoints = useMemo(() => {
    const pts: { x: number; y: number; angle: number }[] = [];
    const step = (2 * Math.PI) / numPoints;
    for (let i = 0; i < numPoints; i++) {
      const angle = step * i;
      pts.push({
        x: SVG_CENTER + Math.cos(angle) * outerR,
        y: SVG_CENTER + Math.sin(angle) * outerR,
        angle: (angle * 180) / Math.PI,
      });
    }
    return pts;
  }, [numPoints, outerR]);

  const innerPoints = useMemo(() => {
    if (!innerRing) return [];
    const pts: { x: number; y: number; angle: number }[] = [];
    const step = (2 * Math.PI) / numPoints;
    for (let i = 0; i < numPoints; i++) {
      const angle = step * i;
      pts.push({
        x: SVG_CENTER + Math.cos(angle) * innerR,
        y: SVG_CENTER + Math.sin(angle) * innerR,
        angle: (angle * 180) / Math.PI,
      });
    }
    return pts;
  }, [numPoints, innerR, innerRing]);

  const totalPoints = numPoints * (innerRing ? 2 : 1);

  return (
    <div className="p-4 space-y-3 overflow-y-auto h-full">
      <SurfaceCard level={2} className="p-3 relative overflow-hidden" data-testid="attack-ring-visualizer">
        <div className="absolute right-0 top-0 w-40 h-40 blur-3xl rounded-full pointer-events-none" style={{ backgroundColor: `${ACCENT_CYAN}08` }} />

        {/* Header */}
        <div className="flex items-center gap-2 mb-1">
          <span className="p-1 rounded" style={{ backgroundColor: `${ACCENT_CYAN}${OPACITY_10}` }}>
            <Target className="w-4 h-4" style={{ color: ACCENT_CYAN }} />
          </span>
          <div>
            <div className="text-sm font-bold text-text">Attack Ring Positions</div>
            <div className="text-xs font-mono text-text-muted">UEnvQueryGenerator_AttackPositions — real C++ defaults</div>
          </div>
          <button
            onClick={reset}
            className="ml-auto text-xs font-mono flex items-center gap-1 px-2 py-1 rounded border border-border/40 text-text-muted hover:text-text transition-colors"
            data-testid="attack-ring-reset"
          >
            <RotateCcw className="w-3 h-3" /> Reset
          </button>
        </div>

        <div className="flex flex-col xl:flex-row gap-3 mt-2">
          {/* SVG Visualization */}
          <AttackRingSvg
            outerPoints={outerPoints}
            innerPoints={innerPoints}
            innerRing={innerRing}
            outerR={outerR}
            innerR={innerR}
            attackDist={attackDist}
            totalPoints={totalPoints}
          />

          {/* Controls panel */}
          <AttackRingControls
            numPoints={numPoints}
            setNumPoints={setNumPoints}
            attackDist={attackDist}
            setAttackDist={setAttackDist}
            innerRing={innerRing}
            setInnerRing={setInnerRing}
          />
        </div>
      </SurfaceCard>
    </div>
  );
}
