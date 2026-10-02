/**
 * A paid Tripo task PoF stopped watching is RECOVERED by its id, never re-bought.
 *
 * Before: `runTripo` was the only code that polled a task and it always POSTed /task first,
 * so the only way back to a timed-out task's mesh was a new paid task. Worse, the best-of-N
 * loop read a timeout (no mesh, no critique) as a failed roll and started ANOTHER paid task
 * while the first was still running, and the task id surfaced only inside `job.result` once
 * the whole run had ended. These cases pin: poll-only recovery, the task id known while the
 * job runs, and a live task stopping the re-roll loop.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  awaitTripoTask,
  runTripo,
  isRecoverableTripoFailure,
  type TripoHttp,
  type TripoResult,
  type TripoSpec,
} from '@/lib/visual-gen/tripo-runner';
import { startTripoJob, getTripoJob } from '@/lib/visual-gen/tripo-job-store';

const TASK = '7f08effe-0000-4000-8000-000000000001';

function fakeHttp(statusJson: unknown) {
  return {
    postJson: vi.fn(async () => ({ status: 200, json: { code: 0, data: { task_id: 'never' } } })),
    getJson: vi.fn(async () => ({ status: 200, json: statusJson })),
    uploadImage: vi.fn(async () => ({ status: 200, json: { code: 0, data: { image_token: 'tok' } } })),
    download: vi.fn(async () => true),
  } satisfies TripoHttp;
}

describe('awaitTripoTask — recovery polls and downloads an EXISTING task, it never creates one', () => {
  it('delivers the mesh of a finished task with zero create/upload calls', async () => {
    const http = fakeHttp({ code: 0, data: { status: 'success', output: { pbr_model: 'https://x/m.glb' } } });
    const r = await awaitTripoTask(TASK, 'out/a.glb', {
      http, fileExists: () => true, sleep: async () => {}, env: { TRIPO_API_KEY: 'k' },
    });
    expect(r).toMatchObject({ ok: true, meshPath: 'out/a.glb', taskId: TASK });
    expect(http.postJson).toHaveBeenCalledTimes(0);
    expect(http.uploadImage).toHaveBeenCalledTimes(0);
    expect(String((http.getJson.mock.calls[0] as unknown[])[0])).toContain(`/task/${TASK}`);
  });

  it('refuses a malformed task id before any request is made', async () => {
    const http = fakeHttp({ code: 0, data: { status: 'success' } });
    const r = await awaitTripoTask('x; rm -rf', 'out/a.glb', { http, env: { TRIPO_API_KEY: 'k' } });
    expect(r.ok).toBe(false);
    expect(http.getJson).toHaveBeenCalledTimes(0);
  });

  it('marks a give-up as recoverable and a Tripo-reported failure as not', async () => {
    const pending = fakeHttp({ code: 0, data: { status: 'running', progress: 40 } });
    const timedOut = await awaitTripoTask(TASK, 'o.glb', {
      http: pending, sleep: async () => {}, env: { TRIPO_API_KEY: 'k' }, maxPolls: 2,
    });
    expect(isRecoverableTripoFailure(timedOut)).toBe(true);

    const failed = fakeHttp({ code: 0, data: { status: 'failed' } });
    const verdict = await awaitTripoTask(TASK, 'o.glb', { http: failed, sleep: async () => {}, env: { TRIPO_API_KEY: 'k' } });
    expect(verdict.ok).toBe(false);
    expect(isRecoverableTripoFailure(verdict)).toBe(false);
  });

  it('runTripo still creates exactly one task and reports its id through onTaskCreated', async () => {
    const http = fakeHttp({ code: 0, data: { status: 'success', output: { pbr_model: 'https://x/m.glb' } } });
    http.postJson.mockResolvedValue({ status: 200, json: { code: 0, data: { task_id: 'task-9' } } });
    const seen: string[] = [];
    const r = await runTripo(
      { mode: 'text-to-3d', prompt: 'crate', outputPath: 'o.glb' },
      { http, fileExists: () => true, sleep: async () => {}, env: { TRIPO_API_KEY: 'k' }, onTaskCreated: (id) => seen.push(id) },
    );
    expect(r).toMatchObject({ ok: true, taskId: 'task-9' });
    expect(http.postJson).toHaveBeenCalledTimes(1);
    expect(seen).toEqual(['task-9']);
  });
});

describe('the job store knows the paid task id while the job runs', () => {
  it('records providerTaskId the moment Tripo accepts the task', async () => {
    const runner = (_spec: TripoSpec, hooks?: { onTaskCreated?: (id: string) => void }) => {
      hooks?.onTaskCreated?.('T1');
      return new Promise<TripoResult>(() => {});
    };
    const id = startTripoJob({ mode: 'text-to-3d', prompt: 'x', outputPath: 'o.glb' }, runner);
    await Promise.resolve();
    expect(getTripoJob(id)).toMatchObject({ status: 'running', providerTaskId: 'T1' });
  });
});

describe('a live paid task stops the re-roll loop instead of buying another', () => {
  it('invokes the runner once on a timeout and marks the job recoverable', async () => {
    const runner = vi.fn(async (): Promise<TripoResult> => ({
      ok: false, taskId: 'T1', error: 'timed out after 75 polls (~300000ms)', durationMs: 1,
    }));
    const id = startTripoJob({ mode: 'text-to-3d', prompt: 'x', outputPath: 'o.glb', maxAttempts: 3 }, runner);
    await vi.waitFor(() => expect(getTripoJob(id)?.status).toBe('error'));
    expect(runner).toHaveBeenCalledTimes(1);
    expect(getTripoJob(id)).toMatchObject({ status: 'error', providerTaskId: 'T1', recoverable: true, attempts: 1 });
  });

  it('keeps re-rolling past a task Tripo itself reported failed (nothing to recover)', async () => {
    const runner = vi.fn(async (): Promise<TripoResult> => ({
      ok: false, taskId: 'T2', error: 'task failed', recoverable: false, durationMs: 1,
    }));
    const id = startTripoJob({ mode: 'text-to-3d', prompt: 'x', outputPath: 'o.glb', maxAttempts: 2 }, runner);
    await vi.waitFor(() => expect(getTripoJob(id)?.status).toBe('error'));
    expect(runner).toHaveBeenCalledTimes(2);
    expect(getTripoJob(id)?.recoverable).not.toBe(true);
  });
});
