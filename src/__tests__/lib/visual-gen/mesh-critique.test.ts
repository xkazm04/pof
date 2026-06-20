import { describe, it, expect } from 'vitest';
import { parseCritiqueMetrics, scoreMesh, critiqueMesh, type MeshMetrics } from '@/lib/visual-gen/mesh-critique';

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
    expect(r.metrics?.watertight).toBe(true);
    expect(r.metrics?.windingConsistent).toBe(false);
    expect(r.metrics?.components).toBe(3);
    expect(r.metrics?.bbox).toEqual([1, 1.2, 0.9]);
    expect(r.metrics?.volume).toBeNull(); // nan
    expect(r.metrics?.degenerateFaces).toBe(4);
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
