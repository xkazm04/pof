import { describe, it, expect } from 'vitest';
import { scoreMesh, type MeshMetrics } from '@/lib/visual-gen/mesh-critique';
import { critiqueDepsForSpec } from '@/lib/visual-gen/tripo-job-store';
import { critiqueDepsForFinish } from '@/lib/visual-gen/mesh-finish-job-store';
import type { TripoSpec } from '@/lib/visual-gen/tripo-runner';
import type { MeshFinishSpec } from '@/lib/visual-gen/mesh-finish';

const mesh = (bbox: [number, number, number]): MeshMetrics => ({
  verts: 5_000,
  faces: 10_000,
  watertight: true,
  windingConsistent: true,
  components: 1,
  euler: 2,
  bbox,
  volume: 1,
  area: 6,
  degenerateFaces: 0,
});

const spec = (over: Partial<TripoSpec> = {}): TripoSpec =>
  ({ mode: 'text-to-3d', prompt: 'x', outputPath: 'o.glb', ...over });

const finish = (over: Partial<MeshFinishSpec> = {}): MeshFinishSpec =>
  ({ highPolyPath: 'hi.glb', outputPath: 'lo.glb', ...over });

// Fixture captured from generated/tripo3d/jinx.glb (trimesh extents, 2026-08-17).
const JINX_BBOX: [number, number, number] = [0.392, 1.0, 0.588];

describe('scoreMesh — world scale', () => {
  it('makes no scale claim when no size was requested (but still says it is normalised)', () => {
    const card = scoreMesh(mesh(JINX_BBOX), {});
    expect(card.verdict).toBe('pass');
    expect(card.scale?.verdict).toBe('unmeasured');
    expect(card.scale?.normalized).toBe(true);
    expect(card.reasons.join(' ')).not.toContain('target');
  });

  it('warns when a 1 m delivery is graded against a 1.8 m target, and names the fix', () => {
    // Before this grade the hero passed clean at 100 cm — the whole point of the check.
    const card = scoreMesh(mesh(JINX_BBOX), {}, undefined, { targetExtentM: 1.8 });
    expect(card.verdict).toBe('warn');
    expect(card.scale?.verdict).toBe('off');
    expect(card.scale?.importUniformScale).toBeCloseTo(1.8, 3);
    expect(card.reasons.join(' ')).toContain('ImportUniformScale 1.80');
  });

  it('passes a delivery at its intended size', () => {
    const card = scoreMesh(mesh([0.6, 1.78, 0.4]), {}, undefined, { targetExtentM: 1.8 });
    expect(card.verdict).toBe('pass');
    expect(card.scale?.verdict).toBe('matches');
  });

  it('keeps the scale grade separate from the face-budget grade', () => {
    const card = scoreMesh(mesh(JINX_BBOX), {}, { triangleBudget: 40_000, topology: 'triangles' }, { targetExtentM: 1.8 });
    expect(card.budget?.verdict).toBe('honored');
    expect(card.scale?.verdict).toBe('off');
    expect(card.verdict).toBe('warn');
  });
});

describe('critiqueDepsForSpec — size threading', () => {
  it('threads an explicit targetExtentM through to the gate', () => {
    expect(critiqueDepsForSpec(spec({ targetExtentM: 0.3 })).size).toEqual({ targetExtentM: 0.3 });
  });

  it('defaults a character to the Mannequin height when no size is given', () => {
    expect(critiqueDepsForSpec(spec({ assetClass: 'character' })).size?.targetExtentM).toBeCloseTo(1.8);
  });

  it('invents no size for a class without an honest nominal', () => {
    expect(critiqueDepsForSpec(spec({ assetClass: 'prop' })).size).toBeUndefined();
    expect(critiqueDepsForSpec(spec()).size).toBeUndefined();
  });

  it('lets an explicit size override the class nominal', () => {
    expect(critiqueDepsForSpec(spec({ assetClass: 'character', targetExtentM: 2.4 })).size?.targetExtentM).toBe(2.4);
  });
});

describe('critiqueDepsForFinish — size threading', () => {
  it('threads an explicit targetExtentM through to the gate', () => {
    expect(critiqueDepsForFinish(finish({ targetExtentM: 0.3 }), 'prop').size).toEqual({ targetExtentM: 0.3 });
  });

  it('defaults a character finish to the Mannequin height', () => {
    expect(critiqueDepsForFinish(finish(), 'character').size?.targetExtentM).toBeCloseTo(1.8);
  });

  it('invents no size otherwise', () => {
    expect(critiqueDepsForFinish(finish(), 'prop').size).toBeUndefined();
    expect(critiqueDepsForFinish(finish()).size).toBeUndefined();
  });
});
