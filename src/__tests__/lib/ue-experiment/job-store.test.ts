import { describe, it, expect, vi } from 'vitest';
import { startExperimentJob, getExperimentJob } from '@/lib/ue-experiment/job-store';
import type { ExperimentResult } from '@/lib/ue-experiment/runner';

const okResult: ExperimentResult = { ok: true, logs: [], markers: { RESULT: '5.8.0' }, durationMs: 1, binary: 'b', args: [] };

describe('experiment job store', () => {
  it('starts a running job and completes with the runner result', async () => {
    const id = startExperimentJob({ python: 'pass' }, undefined, async () => okResult);
    expect(getExperimentJob(id)?.status).toBe('running');
    await vi.waitFor(() => expect(getExperimentJob(id)?.status).toBe('done'));
    expect(getExperimentJob(id)?.result?.markers.RESULT).toBe('5.8.0');
  });

  it('marks the job error if the runner throws', async () => {
    const id = startExperimentJob({ python: 'pass' }, undefined, async () => { throw new Error('boom'); });
    await vi.waitFor(() => expect(getExperimentJob(id)?.status).toBe('error'));
    expect(getExperimentJob(id)?.error).toMatch(/boom/);
  });

  it('returns undefined for an unknown id', () => {
    expect(getExperimentJob('nope')).toBeUndefined();
  });
});
