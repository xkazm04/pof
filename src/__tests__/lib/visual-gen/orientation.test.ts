import { describe, it, expect } from 'vitest';
import {
  GLTF_UP_AXIS_INDEX,
  ORIENTATION_TOLERANCE,
  upExtent,
  dominantAxis,
  expectsUprightFor,
  gradeOrientation,
} from '@/lib/visual-gen/world-scale';
import { scoreMesh, type MeshMetrics } from '@/lib/visual-gen/mesh-critique';

/**
 * REAL bboxes, measured 2026-08-31 with scripts/visual-gen/pof_mesh_critique.py.
 * The COLUMN is the control that fixes the axis convention: a 0.1 x 0.1 x 1.0 box built
 * standing along Blender +Z and exported to glb comes back from trimesh as
 * [0.1, 1.0, 0.1] — so index 1 is up, and this is verified, not assumed.
 */
const COLUMN: [number, number, number] = [0.1, 1.0, 0.1];
const CHAIR_FG070: [number, number, number] = [0.95, 0.4967, 0.5216];
const CHAIR: [number, number, number] = [1.0691, 0.5687, 0.5991];
const SABER_HILT: [number, number, number] = [1.0172, 0.1613, 0.277];
/** Suzanne: genuinely upright, but a head is wider ear-to-ear than it is tall. */
const SUZANNE: [number, number, number] = [1.3282, 0.9555, 0.8004];
const upright = { expectUpright: true };

describe('the up axis is a measured fact, not an assumption', () => {
  it('is glTF Y — index 1', () => {
    expect(GLTF_UP_AXIS_INDEX).toBe(1);
  });

  it('reads the up extent off that axis', () => {
    expect(upExtent(COLUMN)).toBe(1.0);
    expect(upExtent(CHAIR_FG070)).toBeCloseTo(0.4967, 4);
  });

  it('names the axis carrying the longest extent', () => {
    expect(dominantAxis(COLUMN)).toBe('y');
    expect(dominantAxis(CHAIR_FG070)).toBe('x');
    expect(dominantAxis([0.2, 0.3, 1.4])).toBe('z');
  });

  it('has no up extent for an unmeasured mesh', () => {
    expect(upExtent(undefined)).toBeUndefined();
    expect(upExtent([0, 0, 0])).toBeUndefined();
  });
});

describe('gradeOrientation', () => {
  it('passes the control column that stands on its up axis', () => {
    const g = gradeOrientation(COLUMN, upright);
    expect(g.verdict).toBe('upright');
    expect(g.dominantAxis).toBe('y');
  });

  it('catches the chair lying on its side', () => {
    const g = gradeOrientation(CHAIR_FG070, upright);
    expect(g.verdict).toBe('lying');
    expect(g.dominantAxis).toBe('x');
    expect(g.reason).toMatch(/lying|on its side|not.*up/i);
  });

  it('catches it on the second real chair too', () => {
    expect(gradeOrientation(CHAIR, upright).verdict).toBe('lying');
  });

  it('reports the numbers that make the call checkable', () => {
    const g = gradeOrientation(CHAIR_FG070, upright);
    expect(g.upExtentM).toBeCloseTo(0.4967, 4);
    expect(g.longestExtentM).toBeCloseTo(0.95, 4);
    expect(g.ratio).toBeCloseTo(0.4967 / 0.95, 4);
  });

  it('hands back the rotation that would stand it up', () => {
    // Dominant X -> rotate about Z to bring X onto Y.
    expect(gradeOrientation(CHAIR_FG070, upright).suggestedRotation).toEqual({ axis: 'z', degrees: 90 });
    // Dominant Z -> rotate about X to bring Z onto Y.
    expect(gradeOrientation([0.2, 0.3, 1.4], upright).suggestedRotation).toEqual({ axis: 'x', degrees: -90 });
  });

  it('does not flag a near-cube on measurement noise', () => {
    // A crate 1.00 wide and 0.98 tall is not lying down.
    expect(gradeOrientation([1.0, 0.98, 1.0], upright).verdict).toBe('upright');
  });

  it('needs a real margin before calling it lying', () => {
    const g = gradeOrientation([1.0, 1.0 / (1 + ORIENTATION_TOLERANCE) - 0.01, 1.0], upright);
    expect(g.verdict).toBe('lying');
  });

  it('is unmeasured — never upright — with no expectation stated', () => {
    const g = gradeOrientation(CHAIR_FG070, undefined);
    expect(g.verdict).toBe('unmeasured');
    expect(g.reason).toBeTruthy();
    // The numbers are still reported, so a caller can judge for itself.
    expect(g.dominantAxis).toBe('x');
    expect(g.upExtentM).toBeCloseTo(0.4967, 4);
  });

  it('is unmeasured when the subject is not expected to stand', () => {
    expect(gradeOrientation(SABER_HILT, { expectUpright: false }).verdict).toBe('unmeasured');
  });

  it('is unmeasured for a mesh with no bounding box', () => {
    expect(gradeOrientation(undefined, upright).verdict).toBe('unmeasured');
    expect(gradeOrientation([0, 0, 0], upright).verdict).toBe('unmeasured');
  });
});

describe('expectsUprightFor — only where it is honest', () => {
  it('expects a character to stand, like NOMINAL_EXTENT_M gives it a height', () => {
    expect(expectsUprightFor('character')).toBe(true);
  });

  it('claims nothing for a class that has no one honest answer', () => {
    // A prop can be a coin, a wagon or a rug; a weapon lies along its blade.
    for (const c of ['prop', 'weapon', 'environment', 'modular-part', undefined]) {
      expect(expectsUprightFor(c)).toBeUndefined();
    }
  });

  it('is the reason a wide subject is never auto-flagged', () => {
    // Suzanne is upright yet wider ear-to-ear than tall: asserting expectUpright on a
    // subject that is not genuinely tall is what would produce a false positive, so the
    // expectation is opt-in and defaults to nothing.
    expect(expectsUprightFor('prop')).toBeUndefined();
    expect(gradeOrientation(SUZANNE, undefined).verdict).toBe('unmeasured');
    // Stated wrongly, it does flag — documented, not hidden.
    expect(gradeOrientation(SUZANNE, upright).verdict).toBe('lying');
  });
});

describe('scoreMesh surfaces orientation the way it surfaces scale', () => {
  const mesh = (bbox: [number, number, number]): MeshMetrics => ({
    verts: 5_000, faces: 10_000, watertight: true, windingConsistent: true,
    components: 1, euler: 2, bbox, volume: 1, area: 6, degenerateFaces: 0,
  });

  it('warns on a structurally perfect mesh that is lying down', () => {
    // This is the real defect: chair.glb scores 100/100 and is on its side.
    const card = scoreMesh(mesh(CHAIR), {}, undefined, undefined, upright);
    expect(card.orientation!.verdict).toBe('lying');
    expect(card.findings.some((f) => f.code === 'orientation-lying')).toBe(true);
    expect(card.verdict).toBe('warn');
    expect(card.score).toBeLessThan(100);
  });

  it('leaves a clean upright mesh at a clean card', () => {
    const card = scoreMesh(mesh(COLUMN), {}, undefined, undefined, upright);
    expect(card.orientation!.verdict).toBe('upright');
    expect(card.findings.some((f) => f.code === 'orientation-lying')).toBe(false);
    expect(card.verdict).toBe('pass');
  });

  it('changes nothing for callers that state no expectation', () => {
    const card = scoreMesh(mesh(CHAIR));
    expect(card.orientation!.verdict).toBe('unmeasured');
    expect(card.findings.some((f) => f.code === 'orientation-lying')).toBe(false);
    expect(card.score).toBe(100);
  });

  it('always reports the measured numbers, even when it claims nothing', () => {
    const card = scoreMesh(mesh(CHAIR));
    expect(card.orientation!.dominantAxis).toBe('x');
    expect(card.orientation!.upExtentM).toBeCloseTo(0.5687, 4);
  });
});
