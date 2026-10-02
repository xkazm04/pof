/**
 * POST /api/visual-gen/generate/recover — a paid Tripo task is recovered on the EXISTING job
 * rail (202 + jobId, polled by GET /generate/status), graded exactly like a fresh job of the
 * same class, and never pays: the create-task runner is not invoked.
 *
 * Before: the status projection carried no task id, no route could act on one, and the
 * forge's only answer to a timed-out or restart-orphaned Tripo job was Retry (a new task).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import type { CritiqueDeps, CritiqueResult } from '@/lib/visual-gen/mesh-critique';
import type { TripoResult } from '@/lib/visual-gen/tripo-runner';

const { awaitTripoTask, runTripo, critiqueMesh } = vi.hoisted(() => ({
  awaitTripoTask: vi.fn(async (taskId: string, outputPath: string): Promise<TripoResult> => ({
    ok: true, meshPath: outputPath, taskId, status: 'success', durationMs: 1,
  })),
  runTripo: vi.fn(async (spec: { outputPath: string }): Promise<TripoResult> => ({
    ok: true, meshPath: spec.outputPath, taskId: 'fresh-1', status: 'success', durationMs: 1,
  })),
  critiqueMesh: vi.fn(async (...args: [string, CritiqueDeps?]): Promise<CritiqueResult> => {
    void args;
    return { ok: true, verdict: 'pass', score: 100, reasons: [] };
  }),
}));

vi.mock('@/lib/visual-gen/tripo-runner', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/visual-gen/tripo-runner')>()),
  awaitTripoTask,
  runTripo,
}));
vi.mock('@/lib/visual-gen/mesh-critique', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/visual-gen/mesh-critique')>()),
  critiqueMesh,
}));

const { POST: recover } = await import('@/app/api/visual-gen/generate/recover/route');
const { POST: generate } = await import('@/app/api/visual-gen/generate/route');
const { GET: status } = await import('@/app/api/visual-gen/generate/status/route');
const { startTripoJob, critiqueDepsForSpec } = await import('@/lib/visual-gen/tripo-job-store');
const { generationPlanFor } = await import('@/lib/visual-gen/polycount-presets');
const { providerFaceLimit } = await import('@/lib/visual-gen/face-budget');
const { RUNNER_DISPATCH } = await import('@/lib/visual-gen/runner-dispatch');
const { RECOVERABLE_RUNNER_PROVIDERS } = await import('@/components/modules/visual-gen/asset-forge/useForgeStore');

const post = (handler: (r: NextRequest) => Promise<Response>, url: string, body: unknown) =>
  handler(new NextRequest(`http://localhost${url}`, { method: 'POST', body: JSON.stringify(body) }));

async function poll(jobId: string): Promise<Record<string, unknown>> {
  const res = await status(new NextRequest(`http://localhost/api/visual-gen/generate/status?jobId=${jobId}`));
  const body = (await res.json()) as { success: boolean; data: Record<string, unknown> };
  expect(body.success).toBe(true);
  return body.data;
}

beforeEach(() => {
  awaitTripoTask.mockClear();
  runTripo.mockClear();
  critiqueMesh.mockClear();
});

describe('status projection carries the paid task handle', () => {
  it('projects providerTaskId and recoverable for a timed-out Tripo job', async () => {
    const jobId = startTripoJob(
      { mode: 'text-to-3d', prompt: 'x', outputPath: 'o.glb', maxAttempts: 3 },
      async () => ({ ok: false, taskId: 'T1', error: 'timed out after 75 polls (~300000ms)', durationMs: 1 }),
    );
    await vi.waitFor(async () => expect((await poll(jobId)).status).toBe('error'));
    const data = await poll(jobId);
    expect(data.providerTaskId).toBe('T1');
    expect(data.recoverable).toBe(true);
  });
});

describe('POST /generate/recover', () => {
  it('202s a job on the status poller that delivers the task mesh without creating a task', async () => {
    const res = await post(recover, '/api/visual-gen/generate/recover', { providerId: 'tripo3d', taskId: 'T1', assetClass: 'prop' });
    expect(res.status).toBe(202);
    const { data } = (await res.json()) as { data: { jobId: string } };
    expect(typeof data.jobId).toBe('string');

    await vi.waitFor(async () => expect((await poll(data.jobId)).status).toBe('done'));
    const done = await poll(data.jobId);
    expect(String(done.meshPath)).toMatch(/generated\/tripo3d\/[^/]+\.glb$/);
    expect(done.providerTaskId).toBe('T1');
    expect(awaitTripoTask).toHaveBeenCalledTimes(1);
    expect(awaitTripoTask.mock.calls[0][0]).toBe('T1');
    expect(runTripo).toHaveBeenCalledTimes(0);

    // Graded exactly like a fresh prop job — class thresholds, stage raw AND the face budget.
    const deps = critiqueMesh.mock.calls[0][1];
    const plan = generationPlanFor('prop');
    expect(plan?.faceLimit).toBeDefined();
    const expected = critiqueDepsForSpec({
      mode: 'text-to-3d', outputPath: 'x.glb', assetClass: 'prop',
      faceLimit: providerFaceLimit({ triangleBudget: plan!.faceLimit!, topology: 'triangles' }),
    });
    expect(expected.budget).toBeDefined();
    expect(deps).toEqual(expected);
    expect(deps?.stage).toBe('raw');
  });

  it('grades a recovered mesh with the same deps a fresh job of the class gets', async () => {
    const fresh = await post(generate, '/api/visual-gen/generate', { providerId: 'tripo3d', mode: 'text-to-3d', prompt: 'a wooden crate', assetClass: 'prop' });
    expect(fresh.status).toBe(202);
    await vi.waitFor(() => expect(critiqueMesh).toHaveBeenCalledTimes(1));
    const freshDeps = critiqueMesh.mock.calls[0][1];

    await post(recover, '/api/visual-gen/generate/recover', { providerId: 'tripo3d', taskId: 'T1', assetClass: 'prop' });
    await vi.waitFor(() => expect(critiqueMesh).toHaveBeenCalledTimes(2));
    expect(critiqueMesh.mock.calls[1][1]).toEqual(freshDeps);
  });

  it('refuses a provider with no provider-side task, naming tripo3d', async () => {
    const res = await post(recover, '/api/visual-gen/generate/recover', { providerId: 'hunyuan3d', taskId: 'T1' });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('tripo3d');
    expect(awaitTripoTask).toHaveBeenCalledTimes(0);
  });

  it('refuses a malformed task id before any fetch', async () => {
    const res = await post(recover, '/api/visual-gen/generate/recover', { providerId: 'tripo3d', taskId: 'x; rm -rf' });
    expect(res.status).toBe(400);
    expect(awaitTripoTask).toHaveBeenCalledTimes(0);
  });

  it('the forge offers Recover for exactly the providers the dispatch table can recover', () => {
    const serverSide = Object.entries(RUNNER_DISPATCH)
      .filter(([, entry]) => 'recover' in entry)
      .map(([id]) => id)
      .sort();
    expect([...RECOVERABLE_RUNNER_PROVIDERS].sort()).toEqual(serverSide);
  });
});
