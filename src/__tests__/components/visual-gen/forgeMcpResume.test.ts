/**
 * The forge queue re-adopts paid Blender-MCP generations instead of re-paying for them.
 *
 * Before: the provider job id lived only on the in-memory client job. A reload emptied the
 * queue (the server kept nothing), and a job failed by three missed polls — a dev-server
 * restart — offered only Retry, i.e. a NEW paid generation. `resumeMcpJobs()` re-adopts the
 * server ledger's in-flight jobs; `reattachJob(id)` re-polls a transport-failed job's SAME
 * provider id. Neither may ever POST /api/blender-mcp/generate.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createElement } from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { useForgeStore, type GenerationJob } from '@/components/modules/visual-gen/asset-forge/useForgeStore';
import { GenerationQueue } from '@/components/modules/visual-gen/asset-forge/GenerationQueue';

vi.mock('@/components/layout-lab/steps/shared/GlbPreviewPanel', () => ({
  GLB_PREVIEW_LABEL: '3D preview (orbit / zoom)',
  GlbPreviewPanel: () => null,
}));

const T = 1_700_000_000_000;

type Call = { url: string; method: string };
let calls: Call[] = [];
let ledgerJobs: unknown[] = [];

function installFetch() {
  const json = (data: unknown) =>
    Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ success: true, data }) });
  globalThis.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    calls.push({ url, method: init?.method ?? 'GET' });
    if (url.includes('/generate/jobs')) return json({ jobs: ledgerJobs, ownerEpoch: 'epoch-1' });
    if (url.includes('/generate/status')) return json({ jobId: 'j1', status: 'processing', progress: 40 });
    if (url.includes('/generate/import')) return json({ objectName: 'Crate' });
    return json({ jobId: 'j-new', status: 'pending' });
  }) as unknown as typeof fetch;
}

const submits = () => calls.filter((c) => c.method === 'POST' && /\/api\/blender-mcp\/generate$/.test(c.url));
const jobsFor = (mcpJobId: string) => useForgeStore.getState().jobs.filter((j) => j.mcpJobId === mcpJobId);

function failedMcpJob(overrides: Partial<GenerationJob> = {}): GenerationJob {
  return {
    id: 'forge-old-1', mode: 'text-to-3d', prompt: 'crate', providerId: 'rodin',
    status: 'failed', progress: 40, createdAt: T, completedAt: T + 60_000, mcpJobId: 'j1',
    error: 'Status polling failed 3 times in a row: fetch failed',
    ...overrides,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  calls = [];
  ledgerJobs = [{ jobId: 'j1', provider: 'hyper3d', prompt: 'crate', createdAt: T, state: 'generating' }];
  useForgeStore.setState({ jobs: [], activeProviderId: 'rodin', promptHistory: [], activePolls: [] });
  installFetch();
});

afterEach(() => {
  useForgeStore.getState().stopAllPolling();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('resumeMcpJobs — re-adopt the server ledger after a reload', () => {
  it('adds the in-flight job as generating with its poller, without re-submitting', async () => {
    await useForgeStore.getState().resumeMcpJobs();
    const { jobs, activePolls } = useForgeStore.getState();
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ mcpJobId: 'j1', status: 'generating', prompt: 'crate', createdAt: T });
    // 'hyper3d' is what MCP_PROVIDER_MAP maps the forge's 'rodin' to
    expect(jobs[0].providerId).toBe('rodin');
    expect(activePolls).toContain(jobs[0].id);
    expect(submits()).toHaveLength(0);
  });

  it('is idempotent: two resumes (or an existing holder of j1) leave one job and one poller', async () => {
    await Promise.all([useForgeStore.getState().resumeMcpJobs(), useForgeStore.getState().resumeMcpJobs()]);
    await useForgeStore.getState().resumeMcpJobs();
    expect(jobsFor('j1')).toHaveLength(1);
    expect(useForgeStore.getState().activePolls).toHaveLength(1);

    // an existing, un-polled job already holding j1 is adopted, not duplicated
    useForgeStore.getState().stopAllPolling();
    useForgeStore.setState({
      jobs: [failedMcpJob({ id: 'forge-held', status: 'generating', error: undefined, completedAt: undefined })],
      activePolls: [],
    });
    await useForgeStore.getState().resumeMcpJobs();
    expect(jobsFor('j1')).toHaveLength(1);
    expect(useForgeStore.getState().activePolls).toEqual(['forge-held']);
    expect(submits()).toHaveLength(0);
  });

  it('reports the ledger ownerEpoch so the queue can state a server restart', async () => {
    const r = await useForgeStore.getState().resumeMcpJobs();
    expect(r.ownerEpoch).toBe('epoch-1');
  });

  it('degrades to a no-op when the ledger route answers something else', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true, status: 200, json: () => Promise.resolve({ success: true, data: { jobId: 'x' } }),
    }) as unknown as typeof fetch;
    const r = await useForgeStore.getState().resumeMcpJobs();
    expect(r.ownerEpoch).toBeNull();
    expect(useForgeStore.getState().jobs).toEqual([]);
  });
});

describe('reattachJob — re-poll the SAME paid job after a transport failure', () => {
  it('re-tracks the existing mcpJobId and makes no new paid submit', async () => {
    useForgeStore.setState({ jobs: [failedMcpJob()] });
    useForgeStore.getState().reattachJob('forge-old-1');

    const job = useForgeStore.getState().jobs.find((j) => j.id === 'forge-old-1')!;
    expect(job.status).toBe('generating');
    expect(job.mcpJobId).toBe('j1');
    expect(job.error).toBeUndefined();
    expect(useForgeStore.getState().activePolls).toEqual(['forge-old-1']);

    await vi.advanceTimersByTimeAsync(6_000);
    expect(calls.some((c) => c.url.includes('/generate/status?jobId=j1'))).toBe(true);
    expect(submits()).toHaveLength(0);
  });

  it('refuses a job the provider itself failed — nothing is left to re-attach to', () => {
    useForgeStore.setState({ jobs: [failedMcpJob({ error: 'Generation failed on remote provider' })] });
    useForgeStore.getState().reattachJob('forge-old-1');
    expect(useForgeStore.getState().jobs[0].status).toBe('failed');
    expect(useForgeStore.getState().activePolls).toEqual([]);
  });
});

describe('[guard] retryJob keeps its meaning', () => {
  it('still submits a NEW paid generation for a failed MCP job', async () => {
    useForgeStore.setState({ jobs: [failedMcpJob()] });
    useForgeStore.getState().retryJob('forge-old-1');
    await vi.advanceTimersByTimeAsync(0);
    expect(submits()).toHaveLength(1);
    expect(useForgeStore.getState().jobs.some((j) => j.id === 'forge-old-1')).toBe(false);
  });
});

describe('GenerationQueue — the operator sees both recoveries and a server restart', () => {
  it('offers Re-attach beside a Retry that names the new payment', async () => {
    useForgeStore.setState({ jobs: [failedMcpJob()] });
    render(createElement(GenerationQueue));
    await vi.advanceTimersByTimeAsync(0);
    expect(screen.getByTestId('job-reattach')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Retry \(new paid generation\)/ })).toBeTruthy();
    fireEvent.click(screen.getByTestId('job-reattach'));
    expect(useForgeStore.getState().jobs.find((j) => j.id === 'forge-old-1')?.status).toBe('generating');
    expect(submits()).toHaveLength(0);
    cleanup();
  });

  it('states a server restart when the ledger epoch this tab remembered changed', async () => {
    ledgerJobs = [];
    sessionStorage.setItem('pof.forge.mcpLedgerEpoch', 'epoch-0');
    render(createElement(GenerationQueue));
    await vi.advanceTimersByTimeAsync(0);
    expect(screen.getByTestId('forge-ledger-restarted').textContent).toContain('server restarted');
    expect(sessionStorage.getItem('pof.forge.mcpLedgerEpoch')).toBe('epoch-1');
    cleanup();
    sessionStorage.clear();
  });
});
