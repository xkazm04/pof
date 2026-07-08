import { polarSvgLayout } from '@/components/ui/svg/polar-layout';
import { EQS_COVER_POSITIONS } from '@/lib/ai-director/eqs-defaults';
import type { Obstacle } from './types';

// ── Constants ───────────────────────────────────────────────────────────────

export const { size: SVG_SIZE, center: SVG_CENTER, radius: DRAW_RADIUS } = polarSvgLayout(380, 44);

// World-space defaults from the single-source EQS defaults module (see
// `eqs-defaults.ts`) — mirrors UEnvQueryGenerator_CoverPositions.
export const DEFAULT_MIN_RADIUS = EQS_COVER_POSITIONS.minRadius;
export const DEFAULT_MAX_RADIUS = EQS_COVER_POSITIONS.maxRadius;
export const DEFAULT_SAMPLE_COUNT = EQS_COVER_POSITIONS.sampleCount;
export const DEFAULT_COVER_CHECK = EQS_COVER_POSITIONS.coverCheckDistance;
export const DEFAULT_RINGS = EQS_COVER_POSITIONS.numberOfRings;

export const MOCK_OBSTACLES: Obstacle[] = [
  { id: 'wall-1', label: 'Stone Wall', type: 'wall', x: -400, y: -300, w: 250, h: 40 },
  { id: 'wall-2', label: 'Barricade', type: 'wall', x: 500, y: 200, w: 180, h: 35 },
  { id: 'pillar-1', label: 'Pillar A', type: 'pillar', x: -200, y: 500, w: 45, h: 45 },
  { id: 'pillar-2', label: 'Pillar B', type: 'pillar', x: 600, y: -400, w: 50, h: 50 },
  { id: 'pillar-3', label: 'Pillar C', type: 'pillar', x: -700, y: 100, w: 40, h: 40 },
  { id: 'elev-1', label: 'Ledge', type: 'elevation', x: 300, y: -600, w: 200, h: 100, elevation: 250 },
  { id: 'elev-2', label: 'Stairway', type: 'elevation', x: -500, y: -700, w: 150, h: 80, elevation: 180 },
];
