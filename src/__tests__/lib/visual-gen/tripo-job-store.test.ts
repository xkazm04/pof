import { describe, it, expect, vi } from 'vitest';
import { startTripoJob, getTripoJob, attemptPath, MAX_GENERATION_ATTEMPTS } from '@/lib/visual-gen/tripo-job-store';
import type { TripoResult } from '@/lib/visual-gen/tripo-runner';

const okResult: TripoResult = { ok: true, meshPath: 'out/m.glb', taskId: 't1', status: 'success', durationMs: 1 };

describe('tripo cloud job store', () => {
  it('runs to done, exposes the result, and auto-attaches the quality-gate scorecard', async () => {
    const critic = async () => ({ ok: true, verdict: 'pass' as const, score: 100, reasons: [] });
    const id = startTripoJob({ mode: 'text-to-3d', prompt: 'a hero', outputPath: 'o.glb' }, async () => okResult, critic);
    expect(getTripoJob(id)?.status).toBe('running');
    await vi.waitFor(() => expect(getTripoJob(id)?.status).toBe('done'));
    expect(getTripoJob(id)?.result?.meshPath).toBe('out/m.glb');
    expect(getTripoJob(id)?.critique?.verdict).toBe('pass');
  });

  it('marks error when the runner reports ok=false (e.g. insufficient credit)', async () => {
    const id = startTripoJob({ mode: 'text-to-3d', prompt: 'x', outputPath: 'o.glb' }, async () => ({ ok: false, error: 'Tripo error 2010: not enough credit', durationMs: 1 }));
    await vi.waitFor(() => expect(getTripoJob(id)?.status).toBe('error'));
    expect(getTripoJob(id)?.error).toMatch(/2010/);
  });

  it('marks error when the runner throws', async () => {
    const id = startTripoJob({ mode: 'text-to-3d', prompt: 'x', outputPath: 'o.glb' }, async () => { throw new Error('boom'); });
    await vi.waitFor(() => expect(getTripoJob(id)?.status).toBe('error'));
    expect(getTripoJob(id)?.error).toMatch(/boom/);
  });

  it('returns undefined for an unknown id', () => {
    expect(getTripoJob('nope')).toBeUndefined();
  });
});

describe('gate-driven regeneration (a broken cloud mesh is re-rolled, not kept)', () => {
  const fail = { ok: true, verdict: 'fail' as const, score: 5, reasons: ['fragmented'] };
  const pass = { ok: true, verdict: 'pass' as const, score: 100, reasons: [] };
  const runnerEchoingPath = (count: { n: number }) => async (spec: { outputPath: string }): Promise<TripoResult> => {
    count.n++;
    return { ok: true, meshPath: spec.outputPath, taskId: `t${count.n}`, status: 'success', durationMs: 1 };
  };

  it('spends exactly one generation by default, so credit cost is unchanged', async () => {
    const count = { n: 0 };
    const id = startTripoJob(
      { mode: 'text-to-3d', prompt: 'x', outputPath: 'o.glb' },
      runnerEchoingPath(count),
      async () => fail,
    );
    await vi.waitFor(() => expect(getTripoJob(id)?.status).toBe('done'));
    expect(count.n).toBe(1);
    expect(getTripoJob(id)?.attempts).toBe(1);
  });

  it('re-rolls a gate-failing mesh and delivers the one that passed', async () => {
    const count = { n: 0 };
    const id = startTripoJob(
      { mode: 'text-to-3d', prompt: 'x', outputPath: 'o.glb', maxAttempts: 3 },
      runnerEchoingPath(count),
      async (p: string) => (p === 'o.glb' ? fail : pass),
    );
    await vi.waitFor(() => expect(getTripoJob(id)?.status).toBe('done'));
    const job = getTripoJob(id);
    expect(count.n).toBe(2);              // stopped as soon as one passed
    expect(job?.accepted).toBe(true);
    expect(job?.attempts).toBe(2);
    expect(job?.result?.meshPath).toBe('o_a2.glb'); // the accepted mesh, on its own path
    expect(job?.critique?.verdict).toBe('pass');
  });

  it('caps the spend at MAX_GENERATION_ATTEMPTS however many are asked for', async () => {
    const count = { n: 0 };
    const id = startTripoJob(
      { mode: 'text-to-3d', prompt: 'x', outputPath: 'o.glb', maxAttempts: 99 },
      runnerEchoingPath(count),
      async () => fail,
    );
    await vi.waitFor(() => expect(getTripoJob(id)?.status).toBe('done'));
    expect(count.n).toBe(MAX_GENERATION_ATTEMPTS);
  });

  it('delivers a still-failing mesh flagged as unaccepted rather than silently keeping it', async () => {
    const count = { n: 0 };
    const id = startTripoJob(
      { mode: 'text-to-3d', prompt: 'x', outputPath: 'o.glb', maxAttempts: 2 },
      runnerEchoingPath(count),
      async () => fail,
    );
    await vi.waitFor(() => expect(getTripoJob(id)?.status).toBe('done'));
    const job = getTripoJob(id);
    expect(job?.accepted).toBe(false);
    expect(job?.result?.meshPath).toBeTruthy();   // the mesh is still handed over
    expect(job?.gateReason).toMatch(/2 attempts/i);
  });

  it('gives each retry its own path so the delivered mesh is unambiguous', () => {
    expect(attemptPath('C:/gen/hero.glb', 1)).toBe('C:/gen/hero.glb'); // first attempt is unchanged
    expect(attemptPath('C:/gen/hero.glb', 3)).toBe('C:/gen/hero_a3.glb');
  });
});
