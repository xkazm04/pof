// ── EQS C++ UPROPERTY Defaults ────────────────────────────────────────────────
// Single source of truth for the default values (and meta clamp ranges) of the
// custom EQS generators and tests in `Source/PoF/AI/EQS/`.
//
// These numbers are advertised verbatim across the AI-behavior visualizers
// (AttackRingVisualizer, FlankAngleHeatmap, PatrolPointsDistribution,
// TacticalCoverAnalysis) and the EQS reference views (EQSComponentInventory,
// EQSPipelineDiagram). Before this module each surface hard-coded its own copy,
// so a single engine tweak silently desynced four-to-six places with no compiler
// help. Keep this in lockstep with the C++ UPROPERTY defaults so every view
// stays honest. Mirrors the geometry single-source in `eqs-geometry.ts`.

/** A UPROPERTY `meta = (ClampMin=…, ClampMax=…)` range. Either bound is optional. */
export interface ClampRange {
  readonly min?: number;
  readonly max?: number;
}

/**
 * `UEnvQueryGenerator_AttackPositions` — ring of nav-projected attack points.
 *
 * Its clamp bounds are typed as concrete `number`s (not the open `ClampRange`)
 * because the AttackRingVisualizer reads them arithmetically as slider bounds —
 * a definite-presence guarantee the open range type can't give. They remain
 * assignable to `ClampRange` for `eqsClampMeta`.
 */
export interface AttackPositionsDefaults {
  readonly attackDistance: number;
  readonly numberOfPoints: number;
  readonly generateInnerRing: boolean;
  readonly clamps: {
    readonly attackDistance: { readonly min: number };
    readonly numberOfPoints: { readonly min: number; readonly max: number };
  };
}

export const EQS_ATTACK_POSITIONS: AttackPositionsDefaults = {
  attackDistance: 200,
  numberOfPoints: 12,
  generateInnerRing: false,
  clamps: {
    attackDistance: { min: 50 },
    numberOfPoints: { min: 4, max: 36 },
  },
};

/** `UEnvQueryGenerator_PatrolPoints` — random points in an annular ring. */
export interface PatrolPointsDefaults {
  readonly numberOfPoints: number;
  readonly minRadius: number;
  readonly maxRadius: number;
  readonly clamps: {
    readonly numberOfPoints: ClampRange;
    readonly minRadius: ClampRange;
    readonly maxRadius: ClampRange;
  };
}

export const EQS_PATROL_POINTS: PatrolPointsDefaults = {
  numberOfPoints: 15,
  minRadius: 500,
  maxRadius: 1500,
  clamps: {
    numberOfPoints: { min: 1, max: 50 },
    minRadius: { min: 0 },
    maxRadius: { min: 100 },
  },
};

/** `UEnvQueryGenerator_CoverPositions` — geometry-traced cover positions. */
export interface CoverPositionsDefaults {
  readonly sampleCount: number;
  readonly minRadius: number;
  readonly maxRadius: number;
  readonly numberOfRings: number;
  readonly coverCheckDistance: number;
  readonly clamps: {
    readonly sampleCount: ClampRange;
    readonly minRadius: ClampRange;
    readonly maxRadius: ClampRange;
    readonly numberOfRings: ClampRange;
    readonly coverCheckDistance: ClampRange;
  };
}

export const EQS_COVER_POSITIONS: CoverPositionsDefaults = {
  sampleCount: 36,
  minRadius: 300,
  maxRadius: 1200,
  numberOfRings: 3,
  coverCheckDistance: 150,
  clamps: {
    sampleCount: { min: 8, max: 72 },
    minRadius: { min: 100 },
    maxRadius: { min: 200 },
    numberOfRings: { min: 1, max: 5 },
    coverCheckDistance: { min: 50 },
  },
};

/** `UEnvQueryTest_LineOfSight` — multi-height occlusion scoring. */
export interface LineOfSightDefaults {
  readonly numberOfTraceHeights: number;
  readonly minTraceHeight: number;
  readonly maxTraceHeight: number;
  readonly clamps: {
    readonly numberOfTraceHeights: ClampRange;
    readonly minTraceHeight: ClampRange;
    readonly maxTraceHeight: ClampRange;
  };
}

export const EQS_LINE_OF_SIGHT: LineOfSightDefaults = {
  numberOfTraceHeights: 3,
  minTraceHeight: 40,
  maxTraceHeight: 170,
  clamps: {
    numberOfTraceHeights: { min: 1, max: 5 },
    minTraceHeight: { min: 0 },
    maxTraceHeight: { min: 50 },
  },
};

/** `UEnvQueryTest_ElevationAdvantage` — high-ground scoring. */
export interface ElevationAdvantageDefaults {
  readonly maxElevationBonus: number;
  readonly clamps: {
    readonly maxElevationBonus: ClampRange;
  };
}

export const EQS_ELEVATION_ADVANTAGE: ElevationAdvantageDefaults = {
  maxElevationBonus: 300,
  clamps: {
    maxElevationBonus: { min: 50 },
  },
};

// ── Display formatters ───────────────────────────────────────────────────────
// The views advertise these defaults as C++-style strings. Centralize the
// formatting so a float always renders with its trailing `.0`, and a clamp meta
// always reads `ClampMin = X, ClampMax = Y`, exactly as the source does.

/** Render a `float` UPROPERTY default the way C++ source shows it (trailing `.0`). */
export function eqsFloat(value: number): string {
  return Number.isInteger(value) ? `${value}.0` : String(value);
}

/** Render a UPROPERTY clamp `meta` string, e.g. `ClampMin = 4, ClampMax = 36`. */
export function eqsClampMeta(range: ClampRange): string {
  const parts: string[] = [];
  if (range.min !== undefined) parts.push(`ClampMin = ${range.min}`);
  if (range.max !== undefined) parts.push(`ClampMax = ${range.max}`);
  return parts.join(', ');
}
