import { describe, it, expect } from 'vitest';
import {
  FACE_BUDGET_UNIT,
  BUDGET_OVERRUN_TOLERANCE,
  quadBudgetFromTriangles,
  trianglesFromQuads,
  providerFaceLimit,
  gradeFaceBudget,
  type BudgetRequest,
} from '@/lib/visual-gen/face-budget';

const tri = (triangleBudget: number): BudgetRequest => ({ triangleBudget, topology: 'triangles' });
const quad = (triangleBudget: number): BudgetRequest => ({ triangleBudget, topology: 'quads' });

describe('face budget unit', () => {
  it('declares triangles as the authored unit', () => {
    expect(FACE_BUDGET_UNIT).toBe('triangles');
  });

  it('halves a triangle budget into quads (one quad = two triangles)', () => {
    expect(quadBudgetFromTriangles(40_000)).toBe(20_000);
    expect(quadBudgetFromTriangles(15_000)).toBe(7_500);
  });

  it('never rounds a quad budget UP past the triangle budget it came from', () => {
    // 15_001 tris cannot afford 7_501 quads (15_002 tris) — floor, not round.
    const quads = quadBudgetFromTriangles(15_001);
    expect(quads).toBe(7_500);
    expect(trianglesFromQuads(quads!)).toBeLessThanOrEqual(15_001);
  });

  it('converts quads back to triangles', () => {
    expect(trianglesFromQuads(20_000)).toBe(40_000);
  });

  it('refuses a non-positive or non-finite budget rather than inventing one', () => {
    expect(quadBudgetFromTriangles(0)).toBeUndefined();
    expect(quadBudgetFromTriangles(-5)).toBeUndefined();
    expect(quadBudgetFromTriangles(Number.NaN)).toBeUndefined();
    expect(trianglesFromQuads(0)).toBeUndefined();
  });
});

describe('providerFaceLimit', () => {
  it('passes a triangle budget straight through for triangle topology', () => {
    expect(providerFaceLimit(tri(40_000))).toBe(40_000);
  });

  it('halves the budget when quad topology is requested', () => {
    // The provider counts FACES; asking for 40k faces in quad mode delivers ~80k
    // triangles — twice the authored budget. This is the whole finding.
    expect(providerFaceLimit(quad(40_000))).toBe(20_000);
  });

  it('returns undefined for an unusable budget', () => {
    expect(providerFaceLimit(quad(0))).toBeUndefined();
  });
});

describe('gradeFaceBudget', () => {
  it('honors a delivery inside the requested budget', () => {
    const g = gradeFaceBudget(38_000, tri(40_000));
    expect(g.verdict).toBe('honored');
    expect(g.requestedTriangles).toBe(40_000);
    expect(g.measuredTriangles).toBe(38_000);
    expect(g.ratio).toBeCloseTo(0.95, 2);
  });

  it('honors a small overrun inside the documented tolerance', () => {
    expect(gradeFaceBudget(41_000, tri(40_000)).verdict).toBe('honored');
    expect(BUDGET_OVERRUN_TOLERANCE).toBeGreaterThan(1);
  });

  it('flags a delivery past the tolerance and names the ratio', () => {
    const g = gradeFaceBudget(80_000, tri(40_000));
    expect(g.verdict).toBe('over');
    expect(g.ratio).toBeCloseTo(2, 2);
    expect(g.reason).toContain('80000');
    expect(g.reason).toContain('40000');
    expect(g.reason).toContain('triangle');
  });

  it('names the quad/triangle unit trap on a ~2x overrun', () => {
    // The signature failure: face_limit counted quads, the budget was authored in
    // triangles, and the delivery is silently double.
    const g = gradeFaceBudget(79_000, tri(40_000));
    expect(g.verdict).toBe('over');
    expect(g.reason).toMatch(/quad/i);
  });

  it('does not blame quads for an overrun that is not ~2x', () => {
    const g = gradeFaceBudget(600_000, tri(40_000));
    expect(g.verdict).toBe('over');
    expect(g.reason).not.toMatch(/quad/i);
  });

  it('grades a quad request against the TRIANGLES it should have produced', () => {
    // quad(40_000) asks the provider for 20_000 quads == 40_000 triangles.
    expect(gradeFaceBudget(40_000, quad(40_000)).verdict).toBe('honored');
    expect(gradeFaceBudget(80_000, quad(40_000)).verdict).toBe('over');
  });

  it('is unmeasured — never honored — when the measurement is missing', () => {
    const g = gradeFaceBudget(undefined, tri(40_000));
    expect(g.verdict).toBe('unmeasured');
    expect(g.reason).toBeTruthy();
    expect(g.ratio).toBeUndefined();
  });

  it('is unmeasured when no budget was requested', () => {
    expect(gradeFaceBudget(80_000, undefined).verdict).toBe('unmeasured');
  });

  it('is unmeasured for a nonsense measurement rather than claiming an overrun', () => {
    expect(gradeFaceBudget(0, tri(40_000)).verdict).toBe('unmeasured');
    expect(gradeFaceBudget(Number.NaN, tri(40_000)).verdict).toBe('unmeasured');
  });
});
