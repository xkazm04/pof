/**
 * Mesh quality gates must not read "nothing was measured" as a clean result. Each block
 * pins one way a gate could pass, or go silent, without a measurement behind it.
 */
import { describe, it, expect } from 'vitest';
import { parseCritiqueMetrics, scoreMesh, type CritiqueResult } from '@/lib/visual-gen/mesh-critique';
import { generateUntilAcceptable, failureShape } from '@/lib/visual-gen/best-of-n';
import { assessStage } from '@/lib/visual-gen/critique-stage';
import { planKitAtlas } from '@/lib/visual-gen/texel-density';
import { fetchMeshForGrading } from '@/lib/visual-gen/mesh-fetch';
import { runMeshViews } from '@/lib/visual-gen/mesh-views';

describe('parseCritiqueMetrics refuses counts it cannot read', () => {
  const block = (over: Record<string, string>) => {
    const fields: Record<string, string> = {
      VERTS: '5000', FACES: '9000', WATERTIGHT: '1', WINDING_CONSISTENT: '1', COMPONENTS: '1',
      EULER: '2', BBOX: '1,1,1', AREA: '6', DEGENERATE_FACES: '0', DONE: 'ok', ...over,
    };
    return Object.entries(fields).map(([k, v]) => `POF_CRITIQUE_${k}=${v}`).join('\n');
  };

  it('a NaN count would otherwise clear every comparison and score 100', () => {
    const m = { verts: NaN, faces: NaN, watertight: true, windingConsistent: true, components: 1, euler: 2, bbox: [1, 1, 1] as [number, number, number], volume: null, area: 6, degenerateFaces: 0 };
    expect(scoreMesh(m).verdict).toBe('pass'); // the hazard the parser has to stop at the door
  });

  it.each(['VERTS', 'FACES', 'COMPONENTS', 'DEGENERATE_FACES'])('%s=nan is no measurement', (key) => {
    const r = parseCritiqueMetrics(block({ [key]: 'nan' }));
    expect(r.ok).toBe(false);
    expect(r.error).toContain(key);
  });

  it('an unreadable bounding box is no measurement', () => {
    const r = parseCritiqueMetrics(block({ BBOX: 'nan,nan,nan' }));
    expect(r.ok).toBe(false);
    expect(r.error).toContain('BBOX');
  });

  it('a finished block with no FACES or COMPONENTS line is no measurement', () => {
    const noFaces = block({}).replace('POF_CRITIQUE_FACES=9000\n', '');
    const noComponents = block({}).replace('POF_CRITIQUE_COMPONENTS=1\n', '');
    expect(parseCritiqueMetrics(noFaces).ok).toBe(false);
    expect(parseCritiqueMetrics(noComponents).ok).toBe(false);
  });

  it('still parses an ordinary block', () => {
    expect(parseCritiqueMetrics(block({})).ok).toBe(true);
  });
});

describe('generateUntilAcceptable does not pay for rolls a broken critic can never grade', () => {
  const roll = () => {
    const calls = { n: 0 };
    return { calls, fn: async () => { calls.n += 1; return { ok: true, meshPath: `m${calls.n}.glb` }; } };
  };

  it('stops after the second roll when the critic throws, and says the mesh was ungraded', async () => {
    const { calls, fn } = roll();
    const out = await generateUntilAcceptable(fn, { maxAttempts: 5, critic: async () => { throw new Error('trimesh import failed'); } });
    expect(calls.n).toBe(2);
    expect(out.accepted).toBe(false);
    expect(out.ungated).toBe(true);
    expect(out.reason).toContain('trimesh import failed');
  });

  it('stops after the second roll when the critic keeps returning the same error', async () => {
    const { calls, fn } = roll();
    const critic = async (): Promise<CritiqueResult> => ({ ok: false, error: 'no critique markers in output' });
    const out = await generateUntilAcceptable(fn, { maxAttempts: 5, critic });
    expect(calls.n).toBe(2);
    expect(out.ungated).toBe(true);
    expect(out.reason).toContain('no critique markers');
  });

  it('a reproduced failing verdict is still graded, not ungated', async () => {
    const { calls, fn } = roll();
    const critic = async (): Promise<CritiqueResult> => ({ ok: true, verdict: 'fail', score: 0, reasons: ['12 bad'] });
    const out = await generateUntilAcceptable(fn, { maxAttempts: 5, critic });
    expect(calls.n).toBe(2);
    expect(out.ungated).toBeUndefined();
  });

  it('failureShape reads an error when there are no reasons', () => {
    expect(failureShape({ ok: false, error: 'exit 3' })).toBe('exit #');
  });
});

describe('a stage caveat always names the codes it talks about', () => {
  const failing = (...codes: string[]): CritiqueResult => ({
    ok: true, verdict: 'fail', score: 0, reasons: codes,
    findings: codes.map((code) => ({ code, severity: 'fail', reason: code })) as CritiqueResult['findings'],
  });

  it('names a reroll-only failure on raw geometry', () => {
    const c = assessStage(failing('empty-mesh'), 'raw').caveat ?? '';
    expect(c).toContain('empty-mesh');
    expect(c).not.toMatch(/\.\s+is not resolved/);
  });

  it('names what still fails on a finished mesh', () => {
    const c = assessStage(failing('budget-over'), 'finished').caveat ?? '';
    expect(c).toContain('budget-over');
    expect(c).not.toMatch(/\.\s+is not resolved/);
  });

  it('names the reroll code beside a finish-resolvable one on raw geometry', () => {
    const c = assessStage(failing('face-count', 'empty-mesh'), 'raw').caveat ?? '';
    expect(c).toContain('empty-mesh');
    expect(c).not.toMatch(/;\s+is not/);
  });
});

describe('planKitAtlas says why a plan is starved', () => {
  it('names the ceiling when one oversized member starves without any cell being cut', () => {
    const plan = planKitAtlas([{ name: 'cave', extentM: 12 }]);
    expect(plan.verdict).toBe('starved');
    expect(plan.reason).toMatch(/cave/);
  });

  it('gives no reason when every member reaches the target', () => {
    expect(planKitAtlas([{ name: 'crate', extentM: 1 }]).reason).toBeUndefined();
  });
});

describe('runMeshViews holds the render to the views it planned', () => {
  const deps = (stdout: string) => ({
    run: async () => ({ stdout, stderr: '', code: 0 }),
    fileExists: () => true,
    env: { POF_BLENDER: 'C:/b/blender.exe' },
  });
  const out = (n: number) =>
    [...Array(n).keys()].map((i) => `POF_VIEWS_${i}=${i * 60}.0|C:/v/${i}.png`).concat(`POF_VIEWS_DONE=${n}`).join('\n');

  it('refuses a render that delivered fewer views than planned', async () => {
    const r = await runMeshViews({ meshPath: 'a.glb', outDir: 'C:/v', views: 6 }, deps(out(2)));
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/2.*6/);
  });

  it('accepts a render that delivered the plan', async () => {
    const r = await runMeshViews({ meshPath: 'a.glb', outDir: 'C:/v', views: 2 }, deps(out(2)));
    expect(r.ok).toBe(true);
  });
});

describe('fetchMeshForGrading reports a failed body read as a refusal', () => {
  it('a connection that drops mid-body returns ok:false with the reason', async () => {
    const fetchFn = (async () => ({
      ok: true,
      status: 200,
      url: 'https://x.deemos.com/a.glb',
      headers: { get: (k: string) => (k === 'content-type' ? 'model/gltf-binary' : null) },
      arrayBuffer: async () => { throw new Error('socket hang up'); },
    })) as unknown as typeof fetch;
    const out = await fetchMeshForGrading('https://x.deemos.com/a.glb', 'job1', { fetchFn, fileExists: () => false, outDir: 'C:/nowhere' });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toContain('socket hang up');
  });
});
