import { describe, it, expect, vi } from 'vitest';
import { startTriposrJob, getTriposrJob } from '@/lib/visual-gen/triposr-job-store';
import type { TriposrResult } from '@/lib/visual-gen/triposr-runner';

const okResult: TriposrResult = { ok: true, meshPath: 'out/m.glb', verts: 9, faces: 12, device: 'cuda:0', durationMs: 1 };

describe('triposr job store', () => {
  it('runs to done, exposes the result, and auto-attaches the quality-gate scorecard', async () => {
    const critic = async () => ({ ok: true, verdict: 'pass' as const, score: 100, reasons: [] });
    const id = startTriposrJob({ imagePath: 'i.png', outputPath: 'o.glb' }, async () => okResult, critic);
    expect(getTriposrJob(id)?.status).toBe('running');
    await vi.waitFor(() => expect(getTriposrJob(id)?.status).toBe('done'));
    expect(getTriposrJob(id)?.result?.meshPath).toBe('out/m.glb');
    expect(getTriposrJob(id)?.critique?.verdict).toBe('pass');
  });

  it('marks error when the runner reports ok=false', async () => {
    const id = startTriposrJob({ imagePath: 'i.png', outputPath: 'o.glb' }, async () => ({ ok: false, error: 'CUDA oom', durationMs: 1 }));
    await vi.waitFor(() => expect(getTriposrJob(id)?.status).toBe('error'));
    expect(getTriposrJob(id)?.error).toMatch(/CUDA oom/);
  });

  it('marks error when the runner throws', async () => {
    const id = startTriposrJob({ imagePath: 'i.png', outputPath: 'o.glb' }, async () => { throw new Error('boom'); });
    await vi.waitFor(() => expect(getTriposrJob(id)?.status).toBe('error'));
    expect(getTriposrJob(id)?.error).toMatch(/boom/);
  });

  it('returns undefined for an unknown id', () => {
    expect(getTriposrJob('nope')).toBeUndefined();
  });
});
