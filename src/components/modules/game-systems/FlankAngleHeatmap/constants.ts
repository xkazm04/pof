import { polarSvgLayout } from '@/components/ui/svg/polar-layout';
import { EQS_ATTACK_POSITIONS } from '@/lib/ai-director/eqs-defaults';

// ── Constants matching C++ defaults ──────────────────────────────────────────
// From the single-source EQS defaults module (see `eqs-defaults.ts`).

export const ATTACK_DISTANCE = EQS_ATTACK_POSITIONS.attackDistance;
export const NUMBER_OF_POINTS = EQS_ATTACK_POSITIONS.numberOfPoints;

// SVG layout
export const { size: SVG_SIZE, center: SVG_CENTER, radius: DRAW_RADIUS } = polarSvgLayout(360, 40);
