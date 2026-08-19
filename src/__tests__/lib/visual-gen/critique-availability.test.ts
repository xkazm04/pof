/**
 * The gate says when it CANNOT judge.
 *
 * Forced-failure suite for the three honesty gaps in the Tier-1 mesh gate:
 *  1. an absent critic (no POF_TRIPOSR_ROOT / venv / script) used to look exactly like a
 *     failed mesh, so the paid re-roll loop spent every attempt against a gate that was
 *     structurally incapable of passing, and blamed the mesh in the delivered reason;
 *  2. a Tripo roll scored `0.5*geometry + 0.5*clipMax` against a `clipMax` Tripo never
 *     reports — a perfect cloud mesh read "score 50" with nothing saying why;
 *  3. the local job stores graded class-blind because they passed no `CritiqueDeps`.
 *
 * The python critique script is never executed here — `critiqueMesh`'s injected `run`
 * seam stands in for it, and the availability probes are asserted to short-circuit
 * BEFORE any spawn.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  critiqueMesh,
  summarizeGate,
  ungatedReason,
  critiqueUnavailable,
  scoreMesh,
  CRITIQUE_CALIBRATION_CAVEAT,
  type CritiqueResult,
  type CritiqueDeps,
  type MeshMetrics,
} from '@/lib/visual-gen/mesh-critique';
import { combinedScore, scoreBreakdown, generateUntilAcceptable } from '@/lib/visual-gen/best-of-n';
import { resolveAssetClass, localCritiqueDeps } from '@/lib/visual-gen/polycount-presets';
import { startHunyuanJob, getHunyuanJob } from '@/lib/visual-gen/hunyuan-job-store';
import { startTriposrJob, getTriposrJob } from '@/lib/visual-gen/triposr-job-store';
import type { HunyuanResult } from '@/lib/visual-gen/hunyuan-runner';
import type { TriposrResult } from '@/lib/visual-gen/triposr-runner';

const neverRuns = vi.fn(async () => ({ stdout: '', code: 0 }));

describe('critiqueMesh — "could not run" is a distinct outcome from "ran and failed"', () => {
  it('reports UNAVAILABLE naming the missing env var, without spawning anything', async () => {
    const run = vi.fn(neverRuns);
    const res = await critiqueMesh('m.glb', { env: {}, run, fileExists: () => true });

    expect(res.unavailable).toBe(true);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/POF_TRIPOSR_ROOT/);
    expect(run).not.toHaveBeenCalled(); // no paid/blocking spawn against an absent tool
  });

  it('reports UNAVAILABLE naming the missing venv python', async () => {
    const res = await critiqueMesh('m.glb', {
      env: { POF_TRIPOSR_ROOT: 'C:/tsr' },
      fileExists: () => false,
      run: neverRuns,
    });
    expect(res.unavailable).toBe(true);
    expect(res.error).toMatch(/venv python not found/);
    expect(res.error).toMatch(/python\.exe/);
  });

  it('reports UNAVAILABLE naming the missing critique script', async () => {
    const res = await critiqueMesh('m.glb', {
      env: { POF_TRIPOSR_ROOT: 'C:/tsr' },
      // the venv python exists, the repo script does not
      fileExists: (p) => p.includes('python.exe'),
      run: neverRuns,
    });
    expect(res.unavailable).toBe(true);
    expect(res.error).toMatch(/pof_mesh_critique\.py/);
  });

  it('does NOT mark unavailable when the critic ran and simply produced nothing usable', async () => {
    const res = await critiqueMesh('m.glb', {
      env: { POF_TRIPOSR_ROOT: 'C:/tsr' },
      fileExists: () => true,
      run: async () => ({ stdout: 'POF_CRITIQUE_ERROR=cannot load mesh', code: 1 }),
    });
    expect(res.ok).toBe(false);
    expect(res.unavailable).toBeFalsy(); // it ran — this IS about the mesh
    expect(res.error).toMatch(/cannot load mesh/);
  });

  it('still scores normally when everything is present', async () => {
    const stdout = [
      'POF_CRITIQUE_VERTS=5000', 'POF_CRITIQUE_FACES=9000', 'POF_CRITIQUE_WATERTIGHT=1',
      'POF_CRITIQUE_WINDING_CONSISTENT=1', 'POF_CRITIQUE_COMPONENTS=1', 'POF_CRITIQUE_EULER=2',
      'POF_CRITIQUE_BBOX=1,1,1', 'POF_CRITIQUE_VOLUME=1', 'POF_CRITIQUE_AREA=6',
      'POF_CRITIQUE_DEGENERATE_FACES=0', 'POF_CRITIQUE_DONE=1',
    ].join('\n');
    const res = await critiqueMesh('m.glb', {
      env: { POF_TRIPOSR_ROOT: 'C:/tsr' }, fileExists: () => true, run: async () => ({ stdout, code: 0 }),
    });
    expect(res.ok).toBe(true);
    expect(res.unavailable).toBeUndefined();
    expect(res.verdict).toBeDefined();
  });
});

describe('generateUntilAcceptable — an absent critic is not paid for', () => {
  it('spends EXACTLY ONE roll and delivers the mesh ungated', async () => {
    let rolls = 0;
    const roll = async () => { rolls++; return { ok: true, meshPath: `m${rolls}.glb` }; };
    const critic = async () => critiqueUnavailable('POF_TRIPOSR_ROOT is not set (the TripoSR venv is where trimesh lives)');

    const out = await generateUntilAcceptable(roll, { critic, maxAttempts: 3 });

    expect(rolls).toBe(1); // the whole point: 2 further PAID attempts are never spent
    expect(out.accepted).toBe(false);
    expect(out.ungated).toBe(true);
    expect(out.reason).toMatch(/^critique unavailable: /);
    expect(out.reason).toMatch(/POF_TRIPOSR_ROOT/);
    expect(out.reason).toMatch(/mesh delivered ungated$/);
    // the mesh is still handed over — refusing to deliver it would be worse
    expect(out.best?.result.meshPath).toBe('m1.glb');
  });

  it('never blames the mesh when nothing graded it', async () => {
    const out = await generateUntilAcceptable(
      async () => ({ ok: true, meshPath: 'm.glb' }),
      { critic: async () => critiqueUnavailable('venv python not found at C:/tsr/.venv/Scripts/python.exe'), maxAttempts: 3 },
    );
    expect(out.reason).not.toMatch(/no roll cleared the gate/);
  });

  it('still burns the budget when the gate is REAL and the mesh keeps failing differently', async () => {
    let rolls = 0;
    const roll = async () => { rolls++; return { ok: true, meshPath: `m${rolls}.glb` }; };
    const critic = async (): Promise<CritiqueResult> =>
      ({ ok: true, verdict: 'fail', score: 10, reasons: [['bad bbox', 'bad winding', 'empty'][rolls - 1] ?? 'x'] });

    const out = await generateUntilAcceptable(roll, { critic, maxAttempts: 3 });
    expect(rolls).toBe(3);
    expect(out.ungated).toBeFalsy();
    expect(out.note).toBe(CRITIQUE_CALIBRATION_CAVEAT); // the caveat rides with a real failing verdict
  });
});

describe('scoreBreakdown — only measured components are scored', () => {
  const pass: CritiqueResult = { ok: true, verdict: 'pass', score: 100, reasons: [] };

  it('a Tripo roll (no CLIP fidelity) scores geometry-only, and SAYS so', () => {
    const b = scoreBreakdown({}, pass);
    expect(b.score).toBe(100); // NOT the silent 50 cap of the old fixed blend
    expect(b.basis).toBe('geometry-only');
    expect(b.label).toMatch(/geometry-only/);
    expect(combinedScore({}, pass)).toBe(100);
  });

  it('a TripoSR roll blends both, and says which is which', () => {
    const b = scoreBreakdown({ clipMax: 0.8 }, pass);
    expect(b.score).toBe(90);
    expect(b.basis).toBe('geometry+fidelity');
    expect(b.label).toMatch(/CLIP fidelity 80/);
  });

  it('an ungraded roll scores 0 and names the reason rather than implying a bad mesh', () => {
    const b = scoreBreakdown({ clipMax: 0.9 }, critiqueUnavailable('POF_TRIPOSR_ROOT is not set'));
    expect(b.score).toBe(0);
    expect(b.basis).toBe('ungraded');
    expect(b.label).toMatch(/critic could not run/);
  });

  it('the delivered gate reason quotes the geometry-only wording, not a bare number', async () => {
    const out = await generateUntilAcceptable(
      async () => ({ ok: true, meshPath: 'm.glb' }),
      { critic: async (): Promise<CritiqueResult> => ({ ok: true, verdict: 'warn', score: 70, reasons: ['not watertight'] }), maxAttempts: 1 },
    );
    expect(out.accepted).toBe(true);
    expect(out.reason).toMatch(/geometry-only/);
  });
});

describe('summarizeGate — a single-shot store can still report how it was gated', () => {
  it('unavailable → ungated, never accepted', () => {
    const s = summarizeGate(critiqueUnavailable('POF_TRIPOSR_ROOT is not set'));
    expect(s).toMatchObject({ accepted: false, ungated: true });
    expect(s.reason).toBe(ungatedReason(critiqueUnavailable('POF_TRIPOSR_ROOT is not set')));
    expect(s.note).toBeUndefined(); // no verdict was reached, so the calibration caveat does not apply
  });

  it('a real fail carries the calibration caveat', () => {
    const s = summarizeGate({ ok: true, verdict: 'fail', score: 0, reasons: ['500000 faces'] });
    expect(s).toMatchObject({ accepted: false, ungated: false, note: CRITIQUE_CALIBRATION_CAVEAT });
  });

  it('a pass/warn is accepted; no mesh is ungated', () => {
    expect(summarizeGate({ ok: true, verdict: 'warn', score: 70, reasons: ['x'] }).accepted).toBe(true);
    expect(summarizeGate(undefined)).toMatchObject({ accepted: false, ungated: true });
  });
});

describe('resolveAssetClass — the default is stated, never guessed', () => {
  it('recognises a real class', () => {
    const r = resolveAssetClass('character');
    expect(r.assetClass).toBe('character');
    expect(r.gradedAs).toMatch(/Character/);
  });
  it('does not invent a class for missing input', () => {
    const r = resolveAssetClass(undefined);
    expect(r.assetClass).toBeUndefined();
    expect(r.gradedAs).toMatch(/no assetClass supplied/);
    expect(r.gradedAs).toMatch(/class-blind/);
  });
  it('says so loudly for an unrecognised class instead of silently ignoring it', () => {
    const r = resolveAssetClass('vehicle');
    expect(r.assetClass).toBeUndefined();
    expect(r.gradedAs).toMatch(/unrecognised assetClass "vehicle"/);
  });
  it('never fabricates a face BUDGET for a provider that accepts none', () => {
    const { deps } = localCritiqueDeps('prop');
    expect(deps.budget).toBeUndefined(); // nobody asked the provider for a budget
    expect(deps.thresholds?.maxFacesWarn).toBe(15_000); // but the class CEILING applies
  });
});

// ── the local stores actually pass the deps ───────────────────────────────────

// 150k triangles: comfortably UNDER the class-blind 200k default ceiling, and 10x a
// prop's 15k one. Exactly the case `polycount-presets` was written for.
const metrics150k: MeshMetrics = {
  verts: 75_000, faces: 150_000, watertight: true, windingConsistent: true,
  components: 1, euler: 2, bbox: [1, 1, 1], volume: 1, area: 6, degenerateFaces: 0,
};

describe('local job stores grade against the class budget (they used to grade class-blind)', () => {
  it('a Hunyuan 150k mesh is held to its PROP ceiling, not the 200k default', async () => {
    let seen: CritiqueDeps | undefined;
    const runner = async (): Promise<HunyuanResult> => ({ ok: true, meshPath: 'out/h.glb', faces: 150_000, durationMs: 1 });
    const critic = async (_p: string, deps?: CritiqueDeps): Promise<CritiqueResult> => {
      seen = deps;
      return { ok: true, metrics: metrics150k, ...scoreMesh(metrics150k, deps?.thresholds, deps?.budget, deps?.size) };
    };

    const id = startHunyuanJob({ imagePath: 'i.png', outputPath: 'o.glb', assetClass: 'prop' }, runner, critic);
    await vi.waitFor(() => expect(getHunyuanJob(id)?.status).toBe('done'));

    expect(seen?.thresholds?.maxFacesWarn).toBe(15_000); // prop ceiling reached the critic
    const job = getHunyuanJob(id);
    expect(job?.critique?.verdict).toBe('warn');
    expect(job?.critique?.reasons?.some((r) => /high face count \(150000\)/.test(r))).toBe(true);
    expect(job?.gradedAs).toMatch(/Prop/);

    // …and the class-blind default would NOT have caught it, which is the regression.
    expect(scoreMesh(metrics150k).verdict).toBe('pass');
  });

  it('a Hunyuan job with no class says it was graded class-blind rather than implying a budget', async () => {
    const runner = async (): Promise<HunyuanResult> => ({ ok: true, meshPath: 'out/h.glb', durationMs: 1 });
    const id = startHunyuanJob({ imagePath: 'i.png', outputPath: 'o.glb' }, runner, async () => ({ ok: true, verdict: 'pass', score: 100, reasons: [] }));
    await vi.waitFor(() => expect(getHunyuanJob(id)?.status).toBe('done'));
    expect(getHunyuanJob(id)?.gradedAs).toMatch(/no assetClass supplied/);
  });

  it('a TripoSR job reports "delivered ungated" when the critic could not run', async () => {
    const runner = async (): Promise<TriposrResult> => ({ ok: true, meshPath: 'out/t.glb', durationMs: 1 });
    const id = startTriposrJob(
      { imagePath: 'i.png', outputPath: 'o.glb', assetClass: 'weapon' },
      runner,
      async () => critiqueUnavailable('POF_TRIPOSR_ROOT is not set (the TripoSR venv is where trimesh lives)'),
    );
    await vi.waitFor(() => expect(getTriposrJob(id)?.status).toBe('done'));

    const job = getTriposrJob(id);
    expect(job?.accepted).toBe(false);
    expect(job?.ungated).toBe(true);
    expect(job?.gateReason).toMatch(/critique unavailable: .*POF_TRIPOSR_ROOT.* — mesh delivered ungated/);
    expect(job?.gradedAs).toMatch(/Weapon/);
  });

  it('a TripoSR job that really fails the gate carries the calibration caveat', async () => {
    const runner = async (): Promise<TriposrResult> => ({ ok: true, meshPath: 'out/t.glb', durationMs: 1 });
    const id = startTriposrJob(
      { imagePath: 'i.png', outputPath: 'o.glb', assetClass: 'weapon' },
      runner,
      async () => ({ ok: true, verdict: 'fail' as const, score: 0, reasons: ['500000 faces'] }),
    );
    await vi.waitFor(() => expect(getTriposrJob(id)?.status).toBe('done'));
    const job = getTriposrJob(id);
    expect(job?.ungated).toBe(false);
    expect(job?.gateReason).toContain(CRITIQUE_CALIBRATION_CAVEAT);
  });
});
