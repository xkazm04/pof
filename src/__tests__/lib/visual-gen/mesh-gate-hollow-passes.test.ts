/**
 * Mesh quality gates must not read "nothing was measured" as a clean result. Each block
 * pins one way a gate could pass, or go silent, without a measurement behind it.
 */
import { describe, it, expect } from 'vitest';
import { parseCritiqueMetrics, scoreMesh, type CritiqueResult } from '@/lib/visual-gen/mesh-critique';
import { generateUntilAcceptable, failureShape } from '@/lib/visual-gen/best-of-n';
import { assessStage } from '@/lib/visual-gen/critique-stage';

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
