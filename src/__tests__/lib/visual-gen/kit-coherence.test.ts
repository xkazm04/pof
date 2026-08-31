/* eslint-disable no-restricted-syntax -- the hex literals below are MEASURED palette
   data, captured 2026-08-31 by running pof_mesh_views.py over real meshes in generated/.
   They are colorimetric fixtures for the CIELAB math, not UI theme colors, and replacing
   them with chart-colors tokens would destroy the calibration they encode. */
import { describe, it, expect } from 'vitest';
import {
  DRIFT_DELTA_E,
  KIT_COHERENCE_CALIBRATION_CAVEAT,
  hexToLab,
  deltaE76,
  paletteDistance,
  gradeKitCoherence,
  type KitMemberPalette,
} from '@/lib/visual-gen/kit-coherence';

/**
 * REAL palettes, captured 2026-08-31 by running scripts/visual-gen/pof_mesh_views.py over
 * four meshes already in generated/. Not invented — a fixture written from imagination
 * passes its test and never fires in production.
 */
const CRATE = ['#c7b7b7', '#c7b7a7', '#c7c7b7', '#d7d7d7'];
const ITEM1 = ['#b7b7c7', '#c7c7c7', '#9787a7', '#a7a7b7'];
const GRUNT = ['#8787a7', '#878797', '#b7a7a7', '#b7b7b7'];
const VAEL = ['#a79787', '#a78768', '#a79778', '#b7a797'];
/** The same crate re-rendered with one quantisation bin of difference. */
const CRATE_NEAR = ['#c7b7b7', '#c7b7a7', '#c7c7b7', '#d7d7c7'];

const m = (name: string, palette?: string[]): KitMemberPalette => ({ name, palette });

describe('colour conversion', () => {
  it('parses hex, with or without the hash', () => {
    expect(hexToLab('#ffffff')!.L).toBeCloseTo(100, 1);
    expect(hexToLab('000000')!.L).toBeCloseTo(0, 1);
  });

  it('rejects a malformed hex rather than returning black', () => {
    expect(hexToLab('#gg0000')).toBeUndefined();
    expect(hexToLab('#fff')).toBeUndefined();
    expect(hexToLab('')).toBeUndefined();
  });

  it('gives identical colours a distance of zero', () => {
    expect(deltaE76(hexToLab('#c7b7b7')!, hexToLab('#c7b7b7')!)).toBe(0);
  });
});

describe('paletteDistance — measured against real renders', () => {
  it('is zero for a palette against itself', () => {
    expect(paletteDistance(CRATE, CRATE)).toBeCloseTo(0, 6);
  });

  it('is symmetric', () => {
    expect(paletteDistance(CRATE, VAEL)).toBeCloseTo(paletteDistance(VAEL, CRATE)!, 6);
  });

  it('stays near zero for the same asset re-rendered (measured 1.8)', () => {
    const d = paletteDistance(CRATE, CRATE_NEAR)!;
    expect(d).toBeGreaterThan(0);
    expect(d).toBeLessThan(3);
  });

  it('separates independently generated assets (measured 8.0-21.5)', () => {
    expect(paletteDistance(ITEM1, GRUNT)!).toBeGreaterThan(6);
    expect(paletteDistance(ITEM1, VAEL)!).toBeGreaterThan(20);
  });

  it('is undefined — not zero — when a palette has no usable colour', () => {
    expect(paletteDistance([], CRATE)).toBeUndefined();
    expect(paletteDistance(['nonsense'], CRATE)).toBeUndefined();
  });
});

describe('DRIFT_DELTA_E sits in the measured gap', () => {
  it('is above a re-render of the same asset and below the closest distinct pair', () => {
    expect(DRIFT_DELTA_E).toBeGreaterThan(paletteDistance(CRATE, CRATE_NEAR)!);
    expect(DRIFT_DELTA_E).toBeLessThan(paletteDistance(ITEM1, GRUNT)!);
  });
});

describe('gradeKitCoherence', () => {
  it('calls a kit of the same asset coherent', () => {
    const g = gradeKitCoherence([m('crate_a', CRATE), m('crate_b', CRATE_NEAR)]);
    expect(g.verdict).toBe('coherent');
    expect(g.worstPair!.deltaE).toBeLessThan(DRIFT_DELTA_E);
  });

  it('flags four independently generated assets as drifting', () => {
    const g = gradeKitCoherence([m('crate', CRATE), m('item1', ITEM1), m('grunt', GRUNT), m('vael', VAEL)]);
    expect(g.verdict).toBe('drifting');
  });

  it('names the worst PAIR, which is the actionable fact', () => {
    const g = gradeKitCoherence([m('crate', CRATE), m('item1', ITEM1), m('grunt', GRUNT), m('vael', VAEL)]);
    expect([g.worstPair!.a, g.worstPair!.b].sort()).toEqual(['item1', 'vael']);
    expect(g.worstPair!.deltaE).toBeGreaterThan(20);
  });

  it('names the single member furthest from the rest — the one to re-generate', () => {
    const g = gradeKitCoherence([m('crate', CRATE), m('item1', ITEM1), m('grunt', GRUNT), m('vael', VAEL)]);
    expect(g.outlier).toBe('vael');
  });

  it('always carries the calibration caveat and never claims to be a hard gate', () => {
    const g = gradeKitCoherence([m('a', CRATE), m('b', VAEL)]);
    expect(g.advisory).toBe(true);
    expect(g.caveat).toBe(KIT_COHERENCE_CALIBRATION_CAVEAT);
  });

  it('is unmeasured with fewer than two measured members', () => {
    expect(gradeKitCoherence([m('only', CRATE)]).verdict).toBe('unmeasured');
    expect(gradeKitCoherence([]).verdict).toBe('unmeasured');
  });

  it('lists a member it could not measure instead of dropping it silently', () => {
    const g = gradeKitCoherence([m('crate', CRATE), m('vael', VAEL), m('ghost')]);
    expect(g.unmeasuredMembers).toEqual(['ghost']);
    expect(g.reason).toMatch(/ghost/);
  });

  it('is unmeasured when every member failed to render, not coherent', () => {
    const g = gradeKitCoherence([m('a'), m('b')]);
    expect(g.verdict).toBe('unmeasured');
  });
});
