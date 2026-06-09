import { describe, it, expect } from 'vitest';
import {
  CHART_EPSILON,
  clamp,
  safeDivide,
  normalizedIndex,
  hasPlottableSpread,
  paddedDomain,
  sparklinePoints,
  sparklineLinePath,
  sparklineAreaPath,
} from '@/components/modules/core-engine/sub_progression/_shared/chartMath';
import {
  generateChartData,
  BASE_XP_RANGE,
  CURVE_EXP_RANGE,
  calculateXpForLevel,
} from '@/components/modules/core-engine/sub_progression/_shared/data';

describe('safeDivide', () => {
  it('divides normally when the divisor has magnitude', () => {
    expect(safeDivide(10, 4)).toBe(2.5);
  });

  it('never returns NaN for a zero divisor (0 / 0)', () => {
    const result = safeDivide(0, 0);
    expect(Number.isNaN(result)).toBe(false);
    expect(Number.isFinite(result)).toBe(true);
  });

  it('never returns Infinity for a zero divisor with a non-zero numerator', () => {
    const result = safeDivide(5, 0);
    expect(Number.isFinite(result)).toBe(true);
  });

  it('collapses a non-finite numerator to 0', () => {
    expect(safeDivide(Infinity, 1)).toBe(0);
    expect(safeDivide(NaN, 1)).toBe(0);
  });
});

describe('normalizedIndex', () => {
  it('spreads indices evenly across 0..1', () => {
    expect(normalizedIndex(0, 5)).toBe(0);
    expect(normalizedIndex(2, 5)).toBe(0.5);
    expect(normalizedIndex(4, 5)).toBe(1);
  });

  it('returns 0 (never NaN) for a single-point series', () => {
    const result = normalizedIndex(0, 1);
    expect(Number.isNaN(result)).toBe(false);
    expect(result).toBe(0);
  });

  it('returns 0 (never NaN) for an empty series', () => {
    expect(normalizedIndex(0, 0)).toBe(0);
  });
});

describe('hasPlottableSpread', () => {
  it('is true for a normal multi-point series with a positive max', () => {
    expect(hasPlottableSpread([1, 2, 3])).toBe(true);
  });

  it('is false for an empty series', () => {
    expect(hasPlottableSpread([])).toBe(false);
  });

  it('is false for a single-point series', () => {
    expect(hasPlottableSpread([42])).toBe(false);
  });

  it('is false for an all-zero series (no spread to normalize against)', () => {
    expect(hasPlottableSpread([0, 0, 0])).toBe(false);
  });

  it('treats values below epsilon as no spread', () => {
    expect(hasPlottableSpread([CHART_EPSILON / 2, CHART_EPSILON / 2])).toBe(false);
  });
});

describe('clamp', () => {
  it('returns the value when in range', () => {
    expect(clamp(100, 50, 500)).toBe(100);
  });

  it('clamps below the minimum', () => {
    expect(clamp(10, 50, 500)).toBe(50);
  });

  it('clamps above the maximum', () => {
    expect(clamp(9999, 50, 500)).toBe(500);
  });

  it('collapses NaN to the minimum', () => {
    expect(clamp(NaN, 50, 500)).toBe(50);
  });
});

describe('paddedDomain', () => {
  it('pads the series min/max outward by `padding`', () => {
    expect(paddedDomain([1, 2, 3], 0.5, 0, 5)).toEqual({ min: 0.5, max: 3.5 });
  });

  it('clamps the padded domain to [floor, ceil]', () => {
    expect(paddedDomain([0.2, 5], 0.5, 0, 5)).toEqual({ min: 0, max: 5 });
  });

  it('falls back to the full [floor, ceil] domain for an empty series', () => {
    expect(paddedDomain([], 0.5, 0, 5)).toEqual({ min: 0, max: 5 });
  });
});

describe('sparklinePoints', () => {
  const box = { width: 48, height: 16, pad: 1 };

  it('anchors the first/last x to the padded plot edges', () => {
    const pts = sparklinePoints([1, 2, 3], box, 0.5, 3.5);
    expect(pts).toHaveLength(3);
    expect(pts[0].x).toBe(box.pad);
    expect(pts[pts.length - 1].x).toBe(box.width - box.pad);
  });

  it('inverts the y-axis (higher value → smaller y) and stays within the box', () => {
    const pts = sparklinePoints([1, 3, 5], box, 0.5, 5.5);
    expect(pts[0].y).toBeGreaterThan(pts[2].y); // value rose, y dropped
    for (const p of pts) {
      expect(p.y).toBeGreaterThanOrEqual(box.pad);
      expect(p.y).toBeLessThanOrEqual(box.height - box.pad);
    }
  });

  it('never produces NaN coordinates for a flat series (zero range)', () => {
    const pts = sparklinePoints([3, 3, 3], box, 3, 3);
    for (const p of pts) {
      expect(Number.isNaN(p.x)).toBe(false);
      expect(Number.isNaN(p.y)).toBe(false);
    }
  });

  it('handles a single-point series without NaN', () => {
    const pts = sparklinePoints([4], box, 3.5, 4.5);
    expect(pts).toHaveLength(1);
    expect(pts[0].x).toBe(box.pad); // normalizedIndex(0,1) === 0
    expect(Number.isNaN(pts[0].y)).toBe(false);
  });

  it('returns an empty array for an empty series', () => {
    expect(sparklinePoints([], box, 0, 5)).toEqual([]);
  });
});

describe('sparklineLinePath', () => {
  it('starts with M and connects subsequent points with L', () => {
    const path = sparklineLinePath([
      { x: 0, y: 0 },
      { x: 10, y: 5 },
      { x: 20, y: 2 },
    ]);
    expect(path).toBe('M0,0 L10,5 L20,2');
  });
});

describe('sparklineAreaPath', () => {
  it('closes the polyline down to the baseline and back', () => {
    const path = sparklineAreaPath(
      [
        { x: 0, y: 0 },
        { x: 10, y: 5 },
      ],
      16,
    );
    expect(path).toBe('M0,0 L10,5 L10,16 L0,16 Z');
  });

  it('returns an empty string when there are no points', () => {
    expect(sparklineAreaPath([], 16)).toBe('');
  });
});

describe('generateChartData clamps curve params to documented ranges', () => {
  it('clamps an out-of-range baseXp to BASE_XP_RANGE before computing XP', () => {
    const tooHigh = generateChartData(100000, 1.5);
    const clamped = generateChartData(BASE_XP_RANGE.max, 1.5);
    expect(tooHigh).toEqual(clamped);
  });

  it('clamps an out-of-range curveExp to CURVE_EXP_RANGE before computing XP', () => {
    const tooSteep = generateChartData(100, 10);
    const clamped = generateChartData(100, CURVE_EXP_RANGE.max);
    expect(tooSteep).toEqual(clamped);
  });

  it('never produces non-finite XP for degenerate inputs', () => {
    for (const row of generateChartData(NaN, NaN)) {
      expect(Number.isFinite(row.xp)).toBe(true);
    }
  });

  it('still computes the expected value for an in-range input', () => {
    const [first] = generateChartData(100, 1.5);
    expect(first.xp).toBe(calculateXpForLevel(1, 100, 1.5));
  });
});
