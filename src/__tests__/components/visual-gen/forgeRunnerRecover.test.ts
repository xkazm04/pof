/**
 * The forge recovers a paid Tripo task by its id instead of paying for a new one.
 *
 * Before: a runner job carried no provider task id, `mcpReattachable` required an MCP
 * provider, and a Tripo job that timed out server-side (or 404'd after a server restart)
 * offered only Retry — a new paid task. `recoverJob(id)` POSTs the EXISTING task id to
 * /api/visual-gen/generate/recover and polls the returned job on the same rail; it must
 * never POST /api/visual-gen/generate.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createElement } from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import {
  useForgeStore,
  runnerRecoverable,
  type GenerationJob,
} from '@/components/modules/visual-gen/asset-forge/useForgeStore';
import { GenerationQueue } from '@/components/modules/visual-gen/asset-forge/GenerationQueue';

vi.mock('@/components/layout-lab/steps/shared/GlbPreviewPanel', () => ({
  GLB_PREVIEW_LABEL: '3D preview (orbit / zoom)',
  GlbPreviewPanel: () => null,
}));

const T = 1_700_000_000_000;
const PNG = 'data:image/png;base64,iVBORw0KGgo=';

type Call = { url: string; method: string; body?: string };
let calls: Call[] = [];
let statusReply: () => Promise<unknown>;

function installFetch() {
  const json = (data: unknown) =>
    Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ success: true, data }) });
  globalThis.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    calls.push({ url, method: init?.method ?? 'GET', body: typeof init?.body === 'string' ? init.body : undefined });
    if (url.includes('/blender-mcp/generate/jobs')) return json({ jobs: [], ownerEpoch: 'e1' });
    if (url.includes('/visual-gen/generate/recover')) return json({ jobId: 'tripo-recover-1', gradedAs: 'graded as prop' });
    if (url.includes('/visual-gen/generate/status')) return statusReply();
    return json({ jobId: 'runner-new' });
  }) as unknown as typeof fetch;
}

const generateSubmits = () => calls.filter((c) => c.method === 'POST' && /\/api\/visual-gen\/generate$/.test(c.url));
const recoverPosts = () => calls.filter((c) => c.method === 'POST' && c.url.endsWith('/api/visual-gen/generate/recover'));

function failedTripoJob(overrides: Partial<GenerationJob> = {}): GenerationJob {
  return {
    id: 'forge-tripo-1', mode: 'text-to-3d', prompt: 'crate', providerId: 'tripo3d', assetClass: 'prop',
    status: 'failed', progress: 0, createdAt: T, completedAt: T + 60_000, mcpJobId: 'tripo-old',
    providerTaskId: 'T1',
    error: 'Status polling failed 3 times in a row: generation job not found',
    ...overrides,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  calls = [];
  statusReply = () => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ success: true, data: { status: 'running' } }) });
  useForgeStore.setState({ jobs: [], activeProviderId: 'tripo3d', promptHistory: [], activePolls: [] });
  installFetch();
});

afterEach(() => {
  useForgeStore.getState().stopAllPolling();
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('runnerRecoverable + recoverJob', () => {
  it('recovers a restart-orphaned Tripo job through /recover, never /generate', async () => {
    const job = failedTripoJob();
    useForgeStore.setState({ jobs: [job] });
    expect(runnerRecoverable(job)).toBe(true);

    await useForgeStore.getState().recoverJob('forge-tripo-1');

    expect(recoverPosts()).toHaveLength(1);
    expect(JSON.parse(recoverPosts()[0].body ?? '{}')).toMatchObject({ providerId: 'tripo3d', taskId: 'T1', assetClass: 'prop' });
    expect(generateSubmits()).toHaveLength(0);
    const after = useForgeStore.getState().jobs.find((j) => j.id === 'forge-tripo-1')!;
    expect(after.status).toBe('generating');
    expect(after.error).toBeUndefined();
    expect(useForgeStore.getState().activePolls).toContain('forge-tripo-1');

    await vi.advanceTimersByTimeAsync(6_000);
    expect(calls.some((c) => c.url.includes('/generate/status?jobId=tripo-recover-1'))).toBe(true);
    expect(generateSubmits()).toHaveLength(0);
  });

  it('refuses a job Tripo itself failed, or one with no task id', () => {
    expect(runnerRecoverable(failedTripoJob({ recoverable: false }))).toBe(false);
    expect(runnerRecoverable(failedTripoJob({ providerTaskId: undefined }))).toBe(false);
    expect(runnerRecoverable(failedTripoJob({ status: 'completed' }))).toBe(false);
  });

  it('keeps the task id from every poll, so three missed polls still leave it recoverable', async () => {
    let n = 0;
    statusReply = () => {
      n++;
      if (n === 1) {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ success: true, data: { status: 'running', providerTaskId: 'T7' } }) });
      }
      return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({ success: false, error: 'generation job not found' }) });
    };
    await useForgeStore.getState().submitLocalJob('tripo3d', 'text-to-3d', undefined, 'crate', 'prop');
    await vi.advanceTimersByTimeAsync(30_000);
    const job = useForgeStore.getState().jobs[0];
    expect(job.status).toBe('failed');
    expect(job.providerTaskId).toBe('T7');
    expect(runnerRecoverable(job)).toBe(true);
  });

  it('stores the server\'s recoverable verdict on a server-side error', async () => {
    statusReply = () => Promise.resolve({
      ok: true, status: 200,
      json: () => Promise.resolve({ success: true, data: { status: 'error', error: 'task failed', providerTaskId: 'T8', recoverable: false } }),
    });
    await useForgeStore.getState().submitLocalJob('tripo3d', 'text-to-3d', undefined, 'crate', 'prop');
    await vi.advanceTimersByTimeAsync(6_000);
    const job = useForgeStore.getState().jobs[0];
    expect(job.status).toBe('failed');
    expect(job.providerTaskId).toBe('T8');
    expect(runnerRecoverable(job)).toBe(false);
  });
});

describe('[guard] a runner with no provider-side task keeps paid Retry only', () => {
  it('hunyuan3d is never recoverable and retryJob resubmits through /generate', async () => {
    const job = failedTripoJob({ id: 'forge-hy-1', providerId: 'hunyuan3d', mode: 'image-to-3d', imageUrl: PNG, providerTaskId: undefined });
    useForgeStore.setState({ jobs: [job] });
    expect(runnerRecoverable(job)).toBe(false);
    useForgeStore.getState().retryJob('forge-hy-1');
    await vi.advanceTimersByTimeAsync(0);
    expect(generateSubmits()).toHaveLength(1);
    expect(recoverPosts()).toHaveLength(0);
  });
});

describe('GenerationQueue — a recoverable Tripo card', () => {
  it('offers a free Recover beside a Retry that names the new payment', async () => {
    useForgeStore.setState({ jobs: [failedTripoJob()] });
    render(createElement(GenerationQueue));
    await vi.advanceTimersByTimeAsync(0);
    expect(screen.getByTestId('job-recover').textContent).toMatch(/Recover mesh/);
    expect(screen.getByTestId('job-recover-note').textContent).toContain('T1');
    expect(screen.getByRole('button', { name: /Retry \(new paid generation\)/ })).toBeTruthy();
    fireEvent.click(screen.getByTestId('job-recover'));
    await vi.advanceTimersByTimeAsync(0);
    expect(recoverPosts()).toHaveLength(1);
    expect(generateSubmits()).toHaveLength(0);
  });

  it('shows no Recover on a failed card with nothing to recover', async () => {
    useForgeStore.setState({ jobs: [failedTripoJob({ providerTaskId: undefined })] });
    render(createElement(GenerationQueue));
    await vi.advanceTimersByTimeAsync(0);
    expect(screen.queryByTestId('job-recover')).toBeNull();
    expect(screen.getByRole('button', { name: /^Retry$/ })).toBeTruthy();
  });
});
