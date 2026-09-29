/**
 * The Blender-MCP generate routes keep a server-side ledger of paid, in-flight jobs.
 *
 * submit records the provider job id; status moves its state; import is idempotent (one
 * import into the Blender scene per job, however many tabs or resumed polls ask); and
 * GET /generate/jobs lets a reloaded forge queue re-adopt what it lost, with the ledger's
 * ownerEpoch so a server restart is stated rather than read as "nothing in flight".
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { resetLedgerForTest, ledger } from '@/lib/blender-mcp/generation-ledger';

const generateHyper3D = vi.fn();
const generateHunyuan3D = vi.fn();
const pollJobStatus = vi.fn();
const importGeneratedAsset = vi.fn();
vi.mock('@/lib/blender-mcp/service', () => ({
  getService: () => ({ generateHyper3D, generateHunyuan3D, pollJobStatus, importGeneratedAsset }),
}));

const { POST: submit } = await import('@/app/api/blender-mcp/generate/route');
const { GET: status } = await import('@/app/api/blender-mcp/generate/status/route');
const { POST: importAsset } = await import('@/app/api/blender-mcp/generate/import/route');
const { GET: listJobs } = await import('@/app/api/blender-mcp/generate/jobs/route');

const BASE = 'http://localhost:3001/api/blender-mcp/generate';
const post = (url: string, body: unknown) =>
  new NextRequest(url, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });

type Envelope = { success: boolean; data: Record<string, unknown>; error?: string };
const read = async (res: Response) => (await res.json()) as Envelope;

async function jobsNow() {
  const body = await read(await listJobs());
  expect(body.success).toBe(true);
  return body.data as { jobs: Array<Record<string, unknown>>; ownerEpoch: string };
}

beforeEach(() => {
  resetLedgerForTest();
  for (const f of [generateHyper3D, generateHunyuan3D, pollJobStatus, importGeneratedAsset]) f.mockReset();
  generateHyper3D.mockResolvedValue({ ok: true, data: { jobId: 'j1', status: 'pending' } });
});

describe('POST /generate records the paid job', () => {
  it('lists the submitted job from GET /generate/jobs with the ownerEpoch', async () => {
    const res = await submit(post(BASE, { provider: 'hyper3d', prompt: 'crate' }));
    expect(res.status).toBe(201);
    expect((await read(res)).data.jobId).toBe('j1');

    const data = await jobsNow();
    expect(data.jobs.map((j) => j.jobId)).toContain('j1');
    expect(data.jobs.find((j) => j.jobId === 'j1')).toMatchObject({ provider: 'hyper3d', prompt: 'crate', state: 'generating' });
    expect(data.ownerEpoch).toBe(ledger.ownerEpoch);
  });

  it('records nothing when the submit itself failed (nothing was paid for)', async () => {
    generateHyper3D.mockResolvedValue({ ok: false, error: 'bridge down' });
    await submit(post(BASE, { provider: 'hyper3d', prompt: 'crate' }));
    expect((await jobsNow()).jobs).toEqual([]);
  });
});

describe('GET /generate/status moves the ledger state', () => {
  it('marks a remotely failed job failed and drops it from the resumable list', async () => {
    await submit(post(BASE, { provider: 'hyper3d', prompt: 'crate' }));
    pollJobStatus.mockResolvedValue({ ok: true, data: { jobId: 'j1', status: 'failed', progress: 0 } });
    const res = await status(new NextRequest(`${BASE}/status?jobId=j1&provider=hyper3d`));
    expect((await read(res)).data.status).toBe('failed');

    expect(ledger.get('j1')?.state).toBe('failed');
    expect((await jobsNow()).jobs.map((j) => j.jobId)).not.toContain('j1');
  });
});

describe('POST /generate/import is idempotent', () => {
  it('imports into Blender exactly once and answers the repeat from the ledger', async () => {
    await submit(post(BASE, { provider: 'hyper3d', prompt: 'crate' }));
    importGeneratedAsset.mockResolvedValue({ ok: true, data: { objectName: 'Crate' } });

    const first = await read(await importAsset(post(`${BASE}/import`, { jobId: 'j1', provider: 'hyper3d' })));
    const second = await read(await importAsset(post(`${BASE}/import`, { jobId: 'j1', provider: 'hyper3d' })));

    expect(importGeneratedAsset).toHaveBeenCalledTimes(1);
    expect(first.data.objectName).toBe('Crate');
    expect(second.success).toBe(true);
    expect(second.data.objectName).toBe('Crate');
    expect((await jobsNow()).jobs.map((j) => j.jobId)).not.toContain('j1');
  });

  it('coalesces two CONCURRENT imports (two tabs) into one scene import', async () => {
    await submit(post(BASE, { provider: 'hyper3d', prompt: 'crate' }));
    let release!: (v: unknown) => void;
    importGeneratedAsset.mockReturnValue(new Promise((r) => { release = r; }));
    const a = importAsset(post(`${BASE}/import`, { jobId: 'j1', provider: 'hyper3d' }));
    const b = importAsset(post(`${BASE}/import`, { jobId: 'j1', provider: 'hyper3d' }));
    await vi.waitFor(() => expect(importGeneratedAsset).toHaveBeenCalled());
    release({ ok: true, data: { objectName: 'Crate' } });
    const [ra, rb] = await Promise.all([a, b]).then((rs) => Promise.all(rs.map(read)));
    expect(importGeneratedAsset).toHaveBeenCalledTimes(1);
    expect(ra.data.objectName).toBe('Crate');
    expect(rb.data.objectName).toBe('Crate');
  });

  it('lets a FAILED import be tried again (a failure is not a recorded import)', async () => {
    await submit(post(BASE, { provider: 'hyper3d', prompt: 'crate' }));
    importGeneratedAsset.mockResolvedValueOnce({ ok: false, error: 'scene busy' });
    importGeneratedAsset.mockResolvedValueOnce({ ok: true, data: { objectName: 'Crate' } });
    expect((await read(await importAsset(post(`${BASE}/import`, { jobId: 'j1', provider: 'hyper3d' })))).success).toBe(false);
    expect((await read(await importAsset(post(`${BASE}/import`, { jobId: 'j1', provider: 'hyper3d' })))).data.objectName).toBe('Crate');
    expect(importGeneratedAsset).toHaveBeenCalledTimes(2);
  });
});
