import { polarSvgLayout } from '@/components/ui/svg/polar-layout';
import { EQS_PATROL_POINTS } from '@/lib/ai-director/eqs-defaults';

// ── Constants matching C++ defaults ──────────────────────────────────────────
// From the single-source EQS defaults module (see `eqs-defaults.ts`).

export const DEFAULT_MIN_RADIUS = EQS_PATROL_POINTS.minRadius;
export const DEFAULT_MAX_RADIUS = EQS_PATROL_POINTS.maxRadius;
export const DEFAULT_NUM_POINTS = EQS_PATROL_POINTS.numberOfPoints;

// SVG layout
export const { size: SVG_SIZE, center: SVG_CENTER, radius: DRAW_RADIUS } = polarSvgLayout(320, 20);
