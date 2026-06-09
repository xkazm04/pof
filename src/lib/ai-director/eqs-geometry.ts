// ── EQS Flank-Angle Geometry ──────────────────────────────────────────────────
// Pure 2D geometry helpers shared by the squad simulation engine
// (`squad-engine.ts`) and the `FlankAngleHeatmap` visualizer.
//
// The flank-angle scoring math MUST stay in lockstep with the C++
// `UEnvQueryTest_FlankAngle::RunTest`
// (Source/PoF/AI/EQS/EnvQueryTest_FlankAngle.cpp). Keep this the single source
// of truth so the simulator, the heatmap, and the real engine can never silently
// drift apart.

/** A point/vector in the target-local 2D plane (target at the origin). */
export interface Vec2 {
  x: number;
  y: number;
}

/**
 * Flank angle (degrees) of a point relative to the target's forward vector.
 *
 * Mirrors `UEnvQueryTest_FlankAngle`: `DirToItem = normalize(point - origin)`,
 * then `angle = acos(clamp(dot(forward, dir), -1, 1))`. Result is `0°` directly
 * in front of the target and `180°` directly behind it. Returns `0` for a point
 * at (≈) the origin, matching the C++ `IsNearlyZero` guard. The clamp keeps
 * `acos` defined when float math nudges the dot product past ±1, so this never
 * returns `NaN`.
 */
export function computeFlankAngle(
  fwdX: number, fwdY: number,
  px: number, py: number,
): number {
  const len = Math.sqrt(px * px + py * py);
  if (len < 0.001) return 0;
  const dirX = px / len;
  const dirY = py / len;
  const dot = fwdX * dirX + fwdY * dirY;
  return Math.acos(Math.max(-1, Math.min(1, dot))) * (180 / Math.PI);
}

/** Euclidean distance between two 2D points. */
export function distance(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

/** A point on a ring of radius `dist` at `angleRad`, centered on the origin. */
export function ringPoint(angleRad: number, dist: number): Vec2 {
  return { x: Math.cos(angleRad) * dist, y: Math.sin(angleRad) * dist };
}

/** Unit forward vector for a heading angle in radians. */
export function forwardVector(angleRad: number): Vec2 {
  return { x: Math.cos(angleRad), y: Math.sin(angleRad) };
}
