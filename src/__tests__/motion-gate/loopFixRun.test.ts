// @vitest-environment node
/**
 * runLoopFix — the bounded, same-seed, seam-pinned re-take of THIS clip.
 *
 * preflight -> constraints -> runArdy -> measure, capped at 2 attempts (spec:72 "Bounded
 * retries (propose 2), then surface the best-scoring attempt with its score"), stopping on
 * the first pass. Every attempt writes a NEW `_loopfix_aN` stem — the original clip is never
 * touched. Every dep is a fake here: no python, no ARDY, no GPU.
 */
import { describe, it, expect, vi } from 'vitest';
import { scoreLoopClosure, type LoopMetrics } from '@/lib/motion-gate';
import { runLoopFix, type LoopFixDeps, type LoopFixMeasure } from '@/lib/motion-gate/loopFixRun';
import type { ArdyPreflight, ArdyResult, ArdySpec } from '@/lib/visual-gen/ardy-runner';

const RAW: LoopMetrics = { poseGapMm: 141.8, worstJointMm: 381.01, velJumpMm: 25.94, rootTravelMm: 5645.6, frames: 80 };
const FAIL_CARD = scoreLoopClosure(RAW);
const SPEC = { npzPath: 'C:/m/walk.npz', prompt: 'a person walks forward', seed: 1, frames: 80, card: FAIL_CARD };

const graded = (velJumpMm: number): LoopFixMeasure => {
  const card = scoreLoopClosure({ poseGapMm: 0.0001, worstJointMm: 0.0002, velJumpMm, rootTravelMm: 5645.6, frames: 80 });
  return { status: card.verdict, card };
};
const ERROR: LoopFixMeasure = { status: 'error', error: 'crc mismatch — the archive is corrupt' };
const PREFLIGHT_OK: ArdyPreflight = { ok: true, checks: [{ name: 'install', ok: true }, { name: 'motion_correction', ok: true }] };

function fakes(measures: LoopFixMeasure[], preflight: ArdyPreflight = PREFLIGHT_OK) {
  const queue = [...measures];
  const runArdy = vi.fn(async (spec: ArdySpec): Promise<ArdyResult> => ({
    ok: true, npzPath: `${spec.outputPath}.npz`, frames: 80, fps: 20, durationMs: 1,
  }));
  const buildConstraints = vi.fn(async (_npz: string, _pins: unknown, out: string) => ({ ok: true as const, data: out }));
  const measure = vi.fn(async () => queue.shift() ?? ERROR);
  const deps: LoopFixDeps = { preflight: vi.fn(async () => preflight), runArdy, buildConstraints, measure };
  return { deps, runArdy, buildConstraints, measure };
}

describe('runLoopFix: bounded re-take, best attempt at its true verdict', () => {
  it('two warns -> runArdy exactly 2x (cap), same seed + prompt, new stems; best = attempt 2, unresolved, warn', async () => {
    const f = fakes([graded(15.73), graded(15.2)]);
    const r = await runLoopFix(SPEC, f.deps);
    expect(f.runArdy).toHaveBeenCalledTimes(2);
    const specs = f.runArdy.mock.calls.map((c) => c[0]);
    specs.forEach((s, i) => {
      expect(s.seed).toBe(1);
      expect(s.prompt).toBe('a person walks forward');
      expect(s.constraintsPath).toBe(`C:/m/walk_loopfix_a${i + 1}.constraints.json`);
      expect(s.cfgWeight).toBeUndefined();
      expect(s.outputPath).not.toBe(SPEC.npzPath);
      expect(s.outputPath).toBe(`C:/m/walk_loopfix_a${i + 1}`);
    });
    if (!r.ok) throw new Error(r.error);
    expect(r.attempts).toHaveLength(2);
    expect(r.best?.n).toBe(2);
    expect(r.best?.card?.metrics.velJumpMm).toBe(15.2);
    expect(r.outcome).toBe('unresolved');
    expect(r.verdict).toBe('warn');
  });

  it('a pass on attempt 1 stops: runArdy 1x, resolved', async () => {
    const f = fakes([graded(9)]);
    const r = await runLoopFix(SPEC, f.deps);
    expect(f.runArdy).toHaveBeenCalledTimes(1);
    if (!r.ok) throw new Error(r.error);
    expect(r.outcome).toBe('resolved');
    expect(r.verdict).toBe('pass');
    expect(r.attempts).toHaveLength(1);
  });

  it('preflight failing on motion_correction -> ok:false naming it; nothing built, nothing generated', async () => {
    const f = fakes([graded(9)], {
      ok: false,
      checks: [{ name: 'install', ok: true }, { name: 'motion_correction', ok: false, detail: 'C++ extension not importable' }],
    });
    const r = await runLoopFix(SPEC, f.deps);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('motion_correction');
    expect(f.buildConstraints).toHaveBeenCalledTimes(0);
    expect(f.runArdy).toHaveBeenCalledTimes(0);
  });

  it('dryRun returns the plan and the argv it would run; preflight, constraints and runArdy 0x', async () => {
    const f = fakes([graded(9)]);
    const r = await runLoopFix({ ...SPEC, dryRun: true }, f.deps);
    if (!r.ok) throw new Error(r.error);
    expect(r.dryRun).toBe(true);
    expect(r.plan).toMatchObject({ remedy: 'seam-pin', pins: { fullbody: [0, 79], velocity: [78] } });
    expect(r.argv?.[0].constraints.slice(-4)).toEqual(['--pin', '0,79', '--velocity', '78']);
    expect(r.argv?.[0].ardy).toEqual(expect.arrayContaining(['a person walks forward', '--seed', '1', '--constraints']));
    expect(r.argv?.[0].ardy).not.toContain('--cfg_weight');
    expect(r.argv).toHaveLength(2);
    expect(f.deps.preflight).toHaveBeenCalledTimes(0);
    expect(f.buildConstraints).toHaveBeenCalledTimes(0);
    expect(f.runArdy).toHaveBeenCalledTimes(0);
  });

  it('an errored measure is ungraded: never best, never resolved', async () => {
    const f = fakes([ERROR, graded(15.73)]);
    const r = await runLoopFix(SPEC, f.deps);
    if (!r.ok) throw new Error(r.error);
    expect(r.attempts[0].state).toBe('ungraded');
    expect(r.attempts[0].error).toContain('crc mismatch');
    expect(r.best?.n).toBe(2);
    expect(r.outcome).toBe('unresolved');

    const g = fakes([ERROR, ERROR]);
    const all = await runLoopFix(SPEC, g.deps);
    if (!all.ok) throw new Error(all.error);
    expect(all.best).toBeUndefined();
    expect(all.outcome).toBe('ungraded');
    expect(all.verdict).toBeUndefined();
  });

  it('a re-take of a different length is ungraded (the T-1 pin no longer sits on the seam)', async () => {
    const short = scoreLoopClosure({ poseGapMm: 0, worstJointMm: 0, velJumpMm: 1, rootTravelMm: 0, frames: 60 });
    const f = fakes([{ status: short.verdict, card: short }, graded(15.73)]);
    const r = await runLoopFix(SPEC, f.deps);
    if (!r.ok) throw new Error(r.error);
    expect(r.attempts[0].state).toBe('ungraded');
    expect(r.attempts[0].error).toMatch(/60 frames/);
    expect(r.outcome).toBe('unresolved');
  });

  it('no remedy (seedless clip) -> ok:false with the reason; 0 GPU runs', async () => {
    const f = fakes([graded(9)]);
    const r = await runLoopFix({ ...SPEC, seed: undefined }, f.deps);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('seed unknown');
    expect(f.runArdy).toHaveBeenCalledTimes(0);
    expect(f.deps.preflight).toHaveBeenCalledTimes(0);
  });

  it('a failed generation is recorded and the next attempt still runs (bounded)', async () => {
    const f = fakes([graded(15.73)]);
    f.runArdy.mockImplementationOnce(async () => ({ ok: false, error: 'CUDA out of memory', durationMs: 1 }));
    const r = await runLoopFix(SPEC, f.deps);
    if (!r.ok) throw new Error(r.error);
    expect(f.runArdy).toHaveBeenCalledTimes(2);
    expect(r.attempts[0]).toMatchObject({ state: 'failed', error: 'CUDA out of memory' });
    expect(r.best?.n).toBe(2);
  });
});
