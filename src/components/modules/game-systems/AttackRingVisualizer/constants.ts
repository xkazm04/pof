import { polarSvgLayout } from '@/components/ui/svg/polar-layout';
import { EQS_ATTACK_POSITIONS } from '@/lib/ai-director/eqs-defaults';

// ── Real C++ defaults from EnvQueryGenerator_AttackPositions.h ──────────────
// Sourced from the single-source EQS defaults module so this viz can never
// silently drift from the inventory/pipeline surfaces or the engine.

export const DEFAULT_ATTACK_DISTANCE = EQS_ATTACK_POSITIONS.attackDistance;
export const DEFAULT_NUMBER_OF_POINTS = EQS_ATTACK_POSITIONS.numberOfPoints;
export const DEFAULT_INNER_RING = EQS_ATTACK_POSITIONS.generateInnerRing;
export const MIN_POINTS = EQS_ATTACK_POSITIONS.clamps.numberOfPoints.min;
export const MAX_POINTS = EQS_ATTACK_POSITIONS.clamps.numberOfPoints.max;
export const MIN_DISTANCE = EQS_ATTACK_POSITIONS.clamps.attackDistance.min;
// Upper bound of the AttackDistance slider (world units). Single source for both
// the slider's `max` and the SVG scale, so the ring can never exceed the viewBox.
export const MAX_DISTANCE = 500;

// Nav projection from constructor
export const PROJECT_DOWN = 500;
export const PROJECT_UP = 100;

// SVG layout
export const { size: SVG_SIZE, center: SVG_CENTER, padding: SVG_PADDING, radius: MAX_DRAW_RADIUS } = polarSvgLayout(340, 50);
