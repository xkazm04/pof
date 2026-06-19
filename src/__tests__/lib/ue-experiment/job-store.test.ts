import { describe, it, expect, vi } from 'vitest';
import { startExperimentJob, getExperimentJob } from '@/lib/ue-experiment/job-store';
import type { ExperimentResult } from '@/lib/ue-experiment/runner';

const okResult: ExperimentResult = { ok: true, logs: [], markers: { RESULT: '5.8.0' }, durationMs: 1, binary: 'b', args: [] };

const noPersist = () => {};

describe('experiment job store', () => {
  it('starts a running job and completes with the runner result', async () => {
    const id = startExperimentJob({ python: 'pass' }, undefined, async () => okResult, noPersist);
    expect(getExperimentJob(id)?.status).toBe('running');
    await vi.waitFor(() => expect(getExperimentJob(id)?.status).toBe('done'));
    expect(getExperimentJob(id)?.result?.markers.RESULT).toBe('5.8.0');
  });

  it('persists the run to history on completion', async () => {
    const persisted: string[] = [];
    const id = startExperimentJob({ python: 'pass' }, undefined, async () => okResult, (job) => persisted.push(job.id));
    await vi.waitFor(() => expect(persisted).toContain(id));
  });

  it('marks the job error if the runner throws (and does not persist)', async () => {
    const persisted: string[] = [];
    const id = startExperimentJob({ python: 'pass' }, undefined, async () => { throw new Error('boom'); }, (job) => persisted.push(job.id));
    await vi.waitFor(() => expect(getExperimentJob(id)?.status).toBe('error'));
    expect(getExperimentJob(id)?.error).toMatch(/boom/);
    expect(persisted).toHaveLength(0);
  });

  it('returns undefined for an unknown id', () => {
    expect(getExperimentJob('nope')).toBeUndefined();
  });
});
