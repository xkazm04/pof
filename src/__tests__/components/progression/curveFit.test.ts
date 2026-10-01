import { describe, it, expect } from 'vitest';
import {
  fitCurveToTargets, curveTuningReducer, initialCurveTuning, parsePaceTargets,
  type CurveFit, type PaceTarget,
} from '@/components/modules/core-engine/sub_progression/_shared/curveFit';
import { cumulativeMinutes, pacingModel } from '@/components/modules/core-engine/sub_progression/_shared/rewardPacing';
import { BASE_XP_RANGE, CURVE_EXP_RANGE } from '@/components/modules/core-engine/sub_progression/_shared/data';

const CASES: Record<string, PaceTarget[]> = {
  defaults: [{ level: 50, hours: 3.984 }, { level: 10, hours: 0.374 }],
  steep: [{ level: 50, hours: 42.5 }, { level: 10, hours: 1.833 }],
  threeOk: [{ level: 10, hours: 1 }, { level: 25, hours: 5 }, { level: 50, hours: 20 }],
  threeShape: [{ level: 10, hours: 1 }, { level: 25, hours: 2 }, { level: 50, hours: 20 }],
  outOfRange: [{ level: 50, hours: 1000 }, { level: 10, hours: 0.1 }],
};

const pct1 = (fit: CurveFit) => fit.residuals.map((r) => Number(r.errPct.toFixed(1)));

describe('fitCurveToTargets — pace targets to (base, exponent) on the slider lattice', () => {
  it('case 1: the default curve\'s own hours fit back to 100 / 1.5', () => {
    const fit = fitCurveToTargets(CASES.defaults);
    expect(fit.baseXp).toBe(100);
    expect(fit.curveExp).toBe(1.5);
    expect(fit.verdict).toBe('fit');
  });

  it('case 2: 200 / 2.0 hours fit back to 200 / 2.0 with every residual under 1%', () => {
    const fit = fitCurveToTargets(CASES.steep);
    expect(fit.baseXp).toBe(200);
    expect(fit.curveExp).toBe(2);
    fit.residuals.forEach((r) => expect(Math.abs(r.errPct)).toBeLessThan(1));
    expect(fit.verdict).toBe('fit');
  });

  it('case 3: three reachable targets fit to 130 / 1.9 within 10%', () => {
    const fit = fitCurveToTargets(CASES.threeOk);
    expect(fit.baseXp).toBe(130);
    expect(fit.curveExp).toBe(1.9);
    expect(pct1(fit)).toEqual([-0.9, 7.2, -1.8]);
    expect(fit.verdict).toBe('fit');
  });

  it('case 4: an interior best that misses L25 by ~98% is a shape verdict, never a fit', () => {
    const fit = fitCurveToTargets(CASES.threeShape);
    expect(fit.baseXp).toBe(110);
    expect(fit.curveExp).toBe(1.85);
    expect(fit.baseXp).toBeGreaterThan(BASE_XP_RANGE.min);
    expect(fit.baseXp).toBeLessThan(BASE_XP_RANGE.max);
    expect(fit.curveExp).toBeGreaterThan(CURVE_EXP_RANGE.min);
    expect(fit.curveExp).toBeLessThan(CURVE_EXP_RANGE.max);
    expect(fit.worst.level).toBe(25);
    expect(fit.worst.errPct).toBeCloseTo(98.1, 0);
    expect(fit.limitedBy).toEqual([]);
    expect(fit.verdict).toBe('shape');
  });

  it('case 5: targets past the exponent slider pin to 2.5 and say range (curveExp.max)', () => {
    const fit = fitCurveToTargets(CASES.outOfRange);
    expect(fit.curveExp).toBe(CURVE_EXP_RANGE.max);
    expect(fit.verdict).toBe('range');
    expect(fit.limitedBy).toContain('curveExp.max');
  });

  it('case 6: every result is a reachable slider setting and its hours are the Rewards-tab clock', () => {
    for (const targets of Object.values(CASES)) {
      const fit = fitCurveToTargets(targets);
      expect(fit.baseXp).toBeGreaterThanOrEqual(BASE_XP_RANGE.min);
      expect(fit.baseXp).toBeLessThanOrEqual(BASE_XP_RANGE.max);
      expect(fit.baseXp % 10).toBe(0);
      expect(fit.curveExp).toBeGreaterThanOrEqual(CURVE_EXP_RANGE.min);
      expect(fit.curveExp).toBeLessThanOrEqual(CURVE_EXP_RANGE.max);
      expect(fit.curveExp).toBe(Math.round(fit.curveExp * 20) / 20);
      const cum = cumulativeMinutes(pacingModel(fit.baseXp, fit.curveExp));
      expect(fit.residuals.map((r) => r.level)).toEqual(targets.map((t) => t.level));
      fit.residuals.forEach((r, i) => {
        expect(r.targetHours).toBe(targets[i].hours);
        expect(r.achievedHours).toBe(cum[r.level] / 60);
      });
    }
  });
});

describe('curveTuningReducer — preview / apply / revert', () => {
  const start = initialCurveTuning({ baseXp: 100, curveExp: 1.5 });
  const fitted = { baseXp: 130, curveExp: 1.9 };

  it('case 7: previewFit opens compare against the current curve; revert and apply are explicit', () => {
    expect(start).toMatchObject({ live: { baseXp: 100, curveExp: 1.5 }, snapshot: { baseXp: 100, curveExp: 1.5 }, compareMode: false });

    const previewed = curveTuningReducer(start, { type: 'previewFit', params: fitted });
    expect(previewed.compareMode).toBe(true);
    expect(previewed.previewing).toBe(true);
    expect(previewed.snapshot).toEqual({ baseXp: 100, curveExp: 1.5 });
    expect(previewed.live).toEqual(fitted);

    const reverted = curveTuningReducer(previewed, { type: 'revert' });
    expect(reverted.live).toEqual({ baseXp: 100, curveExp: 1.5 });
    expect(reverted.compareMode).toBe(false);
    expect(reverted.previewing).toBe(false);

    const applied = curveTuningReducer(previewed, { type: 'apply' });
    expect(applied.live).toEqual(fitted);
    expect(applied.compareMode).toBe(false);
    expect(applied.previewing).toBe(false);
  });

  it('case 7 [guard]: toggleCompare from off snapshots the live curve (old index.tsx behaviour)', () => {
    const moved = curveTuningReducer(start, { type: 'setLive', params: { baseXp: 240 } });
    const on = curveTuningReducer(moved, { type: 'toggleCompare' });
    expect(on.compareMode).toBe(true);
    expect(on.snapshot).toEqual({ baseXp: 240, curveExp: 1.5 });
    const off = curveTuningReducer(on, { type: 'toggleCompare' });
    expect(off.compareMode).toBe(false);
    expect(off.live).toEqual({ baseXp: 240, curveExp: 1.5 });
  });

  it('a second fit while previewing keeps the pre-fit curve to revert to; compare cannot silently apply', () => {
    const first = curveTuningReducer(start, { type: 'previewFit', params: fitted });
    const second = curveTuningReducer(first, { type: 'previewFit', params: { baseXp: 200, curveExp: 2 } });
    expect(second.snapshot).toEqual({ baseXp: 100, curveExp: 1.5 });
    expect(curveTuningReducer(second, { type: 'toggleCompare' })).toBe(second);
    expect(curveTuningReducer(second, { type: 'revert' }).live).toEqual({ baseXp: 100, curveExp: 1.5 });
  });
});

describe('parsePaceTargets', () => {
  it('accepts level/hours text rows and rejects bad ones with a reason', () => {
    const ok = parsePaceTargets([{ level: '10', hours: '1' }, { level: '50', hours: '20' }]);
    expect(ok).toEqual({ ok: true, data: [{ level: 10, hours: 1 }, { level: 50, hours: 20 }] });
    expect(parsePaceTargets([]).ok).toBe(false);
    expect(parsePaceTargets([{ level: '0', hours: '1' }]).ok).toBe(false);
    expect(parsePaceTargets([{ level: '51', hours: '1' }]).ok).toBe(false);
    expect(parsePaceTargets([{ level: '10', hours: '0' }]).ok).toBe(false);
    expect(parsePaceTargets([{ level: '10', hours: 'x' }]).ok).toBe(false);
    expect(parsePaceTargets([{ level: '10', hours: '1' }, { level: '10', hours: '2' }]).ok).toBe(false);
  });
});
