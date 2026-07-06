import { describe, it, expect, vi } from 'vitest';
import { startTripoJob, getTripoJob } from '@/lib/visual-gen/tripo-job-store';
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
