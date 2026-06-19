import { describe, it, expect, vi } from 'vitest';
import { seedFromGotcha } from '@/components/experiment-lab/seed';
import { runExperimentJob, fetchHistory, fetchRun } from '@/components/experiment-lab/client';
import { buildAssertions } from '@/components/experiment-lab/assertions';

describe('seedFromGotcha', () => {
  it('builds a runnable starter probe + verify prompt from a gotcha', () => {
    const { python, verifyPrompt } = seedFromGotcha({ summary: 'Lumen surface cache', detail: 'reflections go black' });
    expect(python).toContain('# Lumen surface cache');
    expect(python).toContain('# reflections go black');
    expect(python).toContain("unreal.log('RESULT=");
    expect(verifyPrompt).toBe('Lumen surface cache');
  });
});

describe('runExperimentJob', () => {
  const jsonRes = (body: unknown) => ({ json: async () => body }) as Response;

  it('POSTs the spec, polls to done, and resolves the result', async () => {
    const result = { ok: true, logs: [], markers: { RESULT: '5.8.0' }, durationMs: 1, binary: 'b', args: [] };
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonRes({ success: true, data: { jobId: 'exp-1' } }))
      .mockResolvedValueOnce(jsonRes({ success: true, data: { status: 'running' } }))
      .mockResolvedValueOnce(jsonRes({ success: true, data: { status: 'done', result } }));

    const out = await runExperimentJob({ python: "unreal.log('x')" }, { fetchImpl, pollMs: 0 });
    expect(out.jobId).toBe('exp-1');
    expect(out.result.markers.RESULT).toBe('5.8.0');
    expect(fetchImpl).toHaveBeenCalledWith('/api/experiment/run', expect.objectContaining({ method: 'POST' }));
    expect(fetchImpl).toHaveBeenCalledWith('/api/experiment/status/exp-1');
  });

  it('throws when the job ends in error', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonRes({ success: true, data: { jobId: 'exp-2' } }))
      .mockResolvedValueOnce(jsonRes({ success: true, data: { status: 'error', error: 'boom' } }));
    await expect(runExperimentJob({ python: 'x' }, { fetchImpl, pollMs: 0 })).rejects.toThrow(/boom/);
  });
});

describe('buildAssertions', () => {
  it('maps toggles to GateAssertion kinds', () => {
    expect(buildAssertions({ moved: true, montage: true })).toEqual([{ kind: 'moved' }, { kind: 'montage-playing' }]);
    expect(buildAssertions({})).toEqual([]);
  });
});

describe('history fetchers', () => {
  const jsonRes = (body: unknown) => ({ json: async () => body }) as Response;

  it('fetchHistory unwraps the runs list', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonRes({ success: true, data: { runs: [{ id: 'r1' }, { id: 'r2' }] } }));
    const runs = await fetchHistory({ fetchImpl });
    expect(runs.map((r) => r.id)).toEqual(['r1', 'r2']);
    expect(fetchImpl).toHaveBeenCalledWith('/api/experiment/history?limit=50');
  });

  it('fetchRun unwraps a single run', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonRes({ success: true, data: { id: 'r1', mode: 'scenario' } }));
    const run = await fetchRun('r1', fetchImpl);
    expect(run.id).toBe('r1');
  });
});
