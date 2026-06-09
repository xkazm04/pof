/**
 * Pure chart-math guards shared by the progression analysis charts.
 *
 * These normalize-against-max / normalize-by-index charts (DiminishingReturns,
 * PowerCurveDangerZones) divide by a series maximum or by `count - 1`. When a
 * series is flat, all-zero, single-point or empty — all legitimate during early
 * authoring — those divisions silently produce NaN / ±Infinity coordinates and
 * a broken or invisible polyline. The helpers below floor every divisor and let
 * callers detect "no spread" so they can render an explicit empty state instead.
 *
 * The sparkline helpers at the bottom reuse the same guards to lay out the
 * shared line/area SVG geometry — used by the progression charts and the
 * evaluator quality sparklines so the point/path math lives in one tested place.
 *
 * DOM-free on purpose so it can be unit-tested in isolation.
 */

/** Smallest divisor magnitude treated as real spread; below this a series is "flat". */
export const CHART_EPSILON = 1e-6;

/** Clamp `value` into `[min, max]`. A NaN value collapses to `min`. */
export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(Math.max(value, min), max);
}

/**
 * Divide `numerator` by `divisor`, flooring the divisor magnitude to `epsilon`
 * so the result is never NaN or ±Infinity. A non-finite result collapses to 0.
 */
export function safeDivide(numerator: number, divisor: number, epsilon = CHART_EPSILON): number {
  const safeDivisor = Math.abs(divisor) < epsilon ? epsilon : divisor;
  const result = numerator / safeDivisor;
  return Number.isFinite(result) ? result : 0;
}

/**
 * Fractional position (0..1) of index `i` across `count` evenly-spaced points.
 * Returns 0 — never NaN — for single-point (`count <= 1`) or empty series.
 */
export function normalizedIndex(i: number, count: number): number {
  if (count <= 1) return 0;
  return i / (count - 1);
}

/**
 * A series can be normalized against its own maximum only when it has at least
 * two points and a positive maximum. Empty, single-point and all-zero (≤ epsilon)
 * series have no spread to plot and should fall back to an empty state.
 */
export function hasPlottableSpread(values: number[], epsilon = CHART_EPSILON): boolean {
  if (values.length < 2) return false;
  const max = Math.max(...values);
  return Number.isFinite(max) && max > epsilon;
}

// ── Sparkline geometry ──────────────────────────────────────────────────────

/** A laid-out point in SVG pixel coordinates. */
export interface SparklinePoint {
  x: number;
  y: number;
}

/** Padded plot box for a sparkline (outer SVG size + uniform inner padding). */
export interface SparklineBox {
  width: number;
  height: number;
  pad: number;
}

/**
 * Pad a series' `[min, max]` outward by `padding`, clamped to `[floor, ceil]`,
 * so the line has breathing room above/below. Empty series fall back to the
 * full `[floor, ceil]` domain.
 */
export function paddedDomain(
  values: number[],
  padding: number,
  floor: number,
  ceil: number,
): { min: number; max: number } {
  if (values.length === 0) return { min: floor, max: ceil };
  return {
    min: Math.max(floor, Math.min(...values) - padding),
    max: Math.min(ceil, Math.max(...values) + padding),
  };
}

/**
 * Map a numeric series to evenly-spaced SVG points inside a padded box. X uses
 * `normalizedIndex` (even spread), Y uses `safeDivide` against the domain range
 * with the inverted "min at bottom" convention — so a flat/single-point/empty
 * series never produces NaN coordinates.
 */
export function sparklinePoints(
  values: number[],
  { width, height, pad }: SparklineBox,
  min: number,
  max: number,
): SparklinePoint[] {
  const plotW = width - pad * 2;
  const plotH = height - pad * 2;
  const range = max - min;
  return values.map((v, i) => ({
    x: pad + normalizedIndex(i, values.length) * plotW,
    y: height - pad - safeDivide(v - min, range) * plotH,
  }));
}

/** SVG path data ("M..L..") connecting the points into an open polyline. */
export function sparklineLinePath(points: SparklinePoint[]): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
}

/** Close the polyline down to `baselineY` and back to form an area-fill path. */
export function sparklineAreaPath(points: SparklinePoint[], baselineY: number): string {
  if (points.length === 0) return '';
  return `${sparklineLinePath(points)} L${points[points.length - 1].x},${baselineY} L${points[0].x},${baselineY} Z`;
}
