import { describe, it, expect } from 'vitest';
import {
  parseCritiqueMetrics, scoreMesh, critiqueMesh, classifyComponents, faceRigReadiness,
  type MeshMetrics,
} from '@/lib/visual-gen/mesh-critique';
import { critiqueThresholdsFor } from '@/lib/visual-gen/polycount-presets';

const CLEAN: MeshMetrics = {
  verts: 42000, faces: 84000, watertight: true, windingConsistent: true,
  components: 1, euler: 2, bbox: [1, 1.2, 0.9], volume: 0.5, area: 3.2, degenerateFaces: 0,
};

describe('parseCritiqueMetrics', () => {
  it('parses the marker block into typed metrics', () => {
    const out = [
      'POF_CRITIQUE_VERTS=42000', 'POF_CRITIQUE_FACES=84000',
      'POF_CRITIQUE_WATERTIGHT=1', 'POF_CRITIQUE_WINDING_CONSISTENT=0',
      'POF_CRITIQUE_COMPONENTS=3', 'POF_CRITIQUE_EULER=2',
      'POF_CRITIQUE_BBOX=1.0000,1.2000,0.9000', 'POF_CRITIQUE_VOLUME=nan',
      'POF_CRITIQUE_AREA=3.2000', 'POF_CRITIQUE_DEGENERATE_FACES=4', 'POF_CRITIQUE_DONE=ok',
    ].join('\n');
    const r = parseCritiqueMetrics(out);
    expect(r.ok).toBe(true);
    expect(r.metrics?.verts).toBe(42000);
    expect(r.metrics?.componentFaces).toBeUndefined(); // absent marker => unmeasured, not []
    expect(r.metrics?.watertight).toBe(true);
    expect(r.metrics?.windingConsistent).toBe(false);
    expect(r.metrics?.components).toBe(3);
    expect(r.metrics?.bbox).toEqual([1, 1.2, 0.9]);
    expect(r.metrics?.volume).toBeNull(); // nan
    expect(r.metrics?.degenerateFaces).toBe(4);
  });

  it('parses the per-component face histogram when the script emits it', () => {
    const out = [
      'POF_CRITIQUE_VERTS=42000', 'POF_CRITIQUE_FACES=9010', 'POF_CRITIQUE_COMPONENTS=4',
      'POF_CRITIQUE_COMPONENT_FACES=6000,3000,7,3', 'POF_CRITIQUE_DONE=ok',
    ].join('\n');
    expect(parseCritiqueMetrics(out).metrics?.componentFaces).toEqual([6000, 3000, 7, 3]);
  });

  it('reports error when the script failed', () => {
    expect(parseCritiqueMetrics("POF_CRITIQUE_ERROR=ValueError('bad glb')").ok).toBe(false);
  });
});

describe('scoreMesh', () => {
  it('passes a clean watertight single-component mesh', () => {
    const v = scoreMesh(CLEAN);
    expect(v.verdict).toBe('pass');
    expect(v.score).toBeGreaterThanOrEqual(80);
  });

  it('fails an empty mesh', () => {
    expect(scoreMesh({ ...CLEAN, verts: 0, faces: 0 }).verdict).toBe('fail');
  });

  it('fails a heavily-fragmented mesh (floaters)', () => {
    const v = scoreMesh({ ...CLEAN, components: 25 });
    expect(v.verdict).toBe('fail');
    expect(v.reasons.join(' ')).toMatch(/component|floater/i);
  });

  it('warns (not fails) on a non-watertight mesh with a few components', () => {
    const v = scoreMesh({ ...CLEAN, watertight: false, components: 3, degenerateFaces: 10 });
    expect(v.verdict).toBe('warn');
    expect(v.reasons.join(' ')).toMatch(/watertight|hole/i);
  });

  it('fails a degenerate (flat) bounding box', () => {
    expect(scoreMesh({ ...CLEAN, bbox: [1, 0, 0.9] }).verdict).toBe('fail');
  });
});

// An assembled character is legitimately multi-shell — head, lashes, brows, eye
// layers, mouth interior, teeth, tongue, body, two hands, hair, cape, crown. Counting
// those as "fragmented / floaters" rejects a correct mesh. The signal that separates
// a body part from a speck is the component's SHARE OF THE FACES, not the count.
describe('classifyComponents', () => {
  it('separates substantial parts from specks by face share', () => {
    const c = classifyComponents([4000, 3000, 2500, 12, 4]);
    expect(c.parts).toBe(3);
    expect(c.floaters).toBe(2);
    expect(c.floaterFaces).toBe(16);
  });

  it('reports unmeasured when the script emitted no per-component faces', () => {
    expect(classifyComponents(undefined).measured).toBe(false);
    expect(classifyComponents([4000, 3000]).measured).toBe(true);
  });

  // The histogram is capped, and it is sorted largest-first — so what gets dropped is
  // always the SMALLEST components, i.e. exactly the specks the floater rule counts.
  // Omitted components must never simply vanish into a cleaner verdict.
  it('counts omitted components as floaters when the smallest kept one is already a speck', () => {
    const c = classifyComponents([9000, 4, 3], 40);
    expect(c.floaters).toBe(42); // 2 kept specks + 40 omitted, all smaller still
    expect(c.parts).toBe(1);
  });

  it('counts omitted components as parts when the smallest kept one is substantial', () => {
    // Cannot prove they are specks, so bias toward the harsher verdict, never a pass.
    const c = classifyComponents([9000, 8000, 7000], 40);
    expect(c.parts).toBe(43);
    expect(c.floaters).toBe(0);
  });
});

describe('scoreMesh — multi-part characters', () => {
  const assembled = (partFaces: number[]): MeshMetrics => ({
    ...CLEAN,
    watertight: false, // an assembled character never is
    faces: partFaces.reduce((a, b) => a + b, 0),
    components: partFaces.length,
    componentFaces: partFaces,
  });

  it('does not fail an 18-part character whose components are all real body parts', () => {
    const character = assembled(Array.from({ length: 18 }, (_, i) => 6000 - i * 100));
    expect(scoreMesh(character, critiqueThresholdsFor('character')).verdict).not.toBe('fail');
  });

  it('still fails a mesh shattered into specks even under the component budget', () => {
    const shattered = assembled([9000, ...Array.from({ length: 6 }, () => 3)]);
    const v = scoreMesh(shattered, critiqueThresholdsFor('character'));
    expect(v.verdict).toBe('fail');
    expect(v.reasons.join(' ')).toMatch(/floater/i);
  });

  it('falls back to the blunt count rule when per-component faces are absent', () => {
    // No componentFaces => the old behaviour must be untouched (no silent loosening).
    expect(scoreMesh({ ...CLEAN, components: 25 }).verdict).toBe('fail');
  });
});

// Expressions need separable eyes / lashes / brows / an interior mouth. A head that
// arrived as one welded shell cannot be blend-shaped or gaze-rigged, and that is
// knowable from the geometry alone — before any MetaHuman or Faceit work is attempted.
describe('faceRigReadiness', () => {
  it('reports a single-shell head as not rig-ready, naming what is missing', () => {
    const r = faceRigReadiness({ ...CLEAN, components: 1, componentFaces: [84000] });
    expect(r.ready).toBe(false);
    expect(r.reason).toMatch(/single|one shell|separable/i);
  });

  it('reports a head with separable facial shells as rig-ready', () => {
    const r = faceRigReadiness({ ...CLEAN, components: 6, componentFaces: [40000, 2000, 1800, 900, 850, 400] });
    expect(r.ready).toBe(true);
    expect(r.separableParts).toBe(6);
  });

  it('never claims readiness it did not measure', () => {
    const r = faceRigReadiness({ ...CLEAN, components: 6, componentFaces: undefined });
    expect(r.ready).toBeNull();
    expect(r.reason).toMatch(/unmeasured|not measured/i);
  });
});

describe('critiqueMesh (deps-seam)', () => {
  it('runs the script, parses metrics, and scores', async () => {
    const stdout = ['POF_CRITIQUE_VERTS=42000', 'POF_CRITIQUE_FACES=84000', 'POF_CRITIQUE_WATERTIGHT=1',
      'POF_CRITIQUE_WINDING_CONSISTENT=1', 'POF_CRITIQUE_COMPONENTS=1', 'POF_CRITIQUE_EULER=2',
      'POF_CRITIQUE_BBOX=1,1,1', 'POF_CRITIQUE_VOLUME=0.5', 'POF_CRITIQUE_AREA=3', 'POF_CRITIQUE_DEGENERATE_FACES=0',
      'POF_CRITIQUE_DONE=ok'].join('\n');
    const res = await critiqueMesh('m.glb', { run: async () => ({ stdout, code: 0 }), fileExists: () => true, env: { POF_TRIPOSR_ROOT: 'C:/triposr' } });
    expect(res.ok).toBe(true);
    expect(res.verdict).toBe('pass');
    expect(res.metrics?.faces).toBe(84000);
  });
});
