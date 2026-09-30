import { describe, it, expect, vi, beforeEach } from 'vitest';
import { providerExecution, getProviderById } from '@/lib/visual-gen/providers';
import { hunyuanModelFor } from '@/lib/visual-gen/hunyuan-models';

/**
 * One runner dispatch table for 3D generation.
 *
 * The forge offers a provider as runnable when `providerExecution` says `path: 'runner'`.
 * Before the table, the generate route and the status route each kept their own
 * hand-written copy of the runner set, and `trellis2` was in the forge's copy only: the
 * button was enabled, the submit 400'd ("not wired for local generation"), and a trellis
 * job id would have 404'd on status. These cases pin the route to the same set and the
 * same refusal sentence the forge button shows.
 */

const startHunyuanJob = vi.fn<(...a: unknown[]) => string>(() => 'hy3d-test');
const startTriposrJob = vi.fn<(...a: unknown[]) => string>(() => 'tsr-test');
const startTripoJob = vi.fn<(...a: unknown[]) => string>(() => 'tripo-test');
const startTrellisJob = vi.fn<(...a: unknown[]) => string>(() => 't2-test');
const getTrellisJob = vi.fn<(id: string) => unknown>(() => undefined);

vi.mock('@/lib/visual-gen/hunyuan-job-store', () => ({
  startHunyuanJob: (...a: unknown[]) => startHunyuanJob(...a),
  getHunyuanJob: () => undefined,
}));
vi.mock('@/lib/visual-gen/triposr-job-store', () => ({
  startTriposrJob: (...a: unknown[]) => startTriposrJob(...a),
  getTriposrJob: () => undefined,
}));
vi.mock('@/lib/visual-gen/tripo-job-store', () => ({
  startTripoJob: (...a: unknown[]) => startTripoJob(...a),
  getTripoJob: () => undefined,
}));
vi.mock('@/lib/visual-gen/trellis-job-store', () => ({
  startTrellisJob: (...a: unknown[]) => startTrellisJob(...a),
  getTrellisJob: (id: string) => getTrellisJob(id),
}));

const PNG_1X1 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

async function post(body: unknown) {
  const { POST } = await import('@/app/api/visual-gen/generate/route');
  const req = new Request('http://localhost/api/visual-gen/generate', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return POST(req as never);
}

async function status(jobId: string) {
  const { NextRequest } = await import('next/server');
  const { GET } = await import('@/app/api/visual-gen/generate/status/route');
  return GET(new NextRequest(`http://localhost/api/visual-gen/generate/status?jobId=${jobId}`));
}

const reasonFor = (id: string, mode: 'text-to-3d' | 'image-to-3d') => {
  const p = getProviderById(id);
  if (!p) throw new Error(`no provider ${id}`);
  return providerExecution(p, mode).reason;
};

describe('POST /api/visual-gen/generate — one runner dispatch table', () => {
  beforeEach(() => {
    for (const m of [startHunyuanJob, startTriposrJob, startTripoJob, startTrellisJob, getTrellisJob]) m.mockClear();
  });

  it('submits a trellis2 image-to-3d job the forge offers as runnable', async () => {
    const res = await post({ mode: 'image-to-3d', providerId: 'trellis2', imageDataUrl: PNG_1X1, gateInput: false });
    const json = (await res.json()) as { success: boolean; data?: { provider?: string; jobId?: string }; error?: string };

    expect(json.error).toBeUndefined();
    expect(res.status).toBe(202);
    expect(json.data?.provider).toBe('trellis2');
    expect(json.data?.jobId).toBe('t2-test');
    expect(startTrellisJob).toHaveBeenCalledTimes(1);
    const spec = startTrellisJob.mock.calls[0][0] as { imagePath: string; outputPath: string };
    expect(spec.imagePath).toMatch(/\.png$/);
    expect(spec.outputPath).toMatch(/generated\/trellis2\/\d+\.glb$/);
  });

  it('refuses trellis2 text-to-3d with the SAME sentence the forge button shows', async () => {
    const res = await post({ mode: 'text-to-3d', providerId: 'trellis2', prompt: 'a chair' });
    const json = (await res.json()) as { error?: string };
    expect(res.status).toBe(400);
    expect(json.error).toBe(reasonFor('trellis2', 'text-to-3d'));
    expect(startTrellisJob).not.toHaveBeenCalled();
  });

  it('refuses a metadata-only provider (meshy) with the forge reason, not a route-local string', async () => {
    const res = await post({ mode: 'text-to-3d', providerId: 'meshy', prompt: 'a chair' });
    const json = (await res.json()) as { error?: string };
    expect(res.status).toBe(400);
    expect(json.error).toBe(reasonFor('meshy', 'text-to-3d'));
  });

  it('[guard] keeps the Hunyuan model pin on the hunyuan3d path', async () => {
    const res = await post({ mode: 'image-to-3d', providerId: 'hunyuan3d', imageDataUrl: PNG_1X1, gateInput: false });
    expect(res.status).toBe(202);
    expect(startHunyuanJob).toHaveBeenCalledTimes(1);
    expect((startHunyuanJob.mock.calls[0][0] as { model?: string }).model).toBe(hunyuanModelFor(undefined).model);
  });

  it('[guard] keeps threading tripo3d multiview views in order', async () => {
    const res = await post({
      mode: 'multiview-to-3d',
      providerId: 'tripo3d',
      viewDataUrls: { front: PNG_1X1, left: PNG_1X1, back: PNG_1X1, right: PNG_1X1 },
    });
    const json = (await res.json()) as { data?: { views?: string[] } };
    expect(res.status).toBe(202);
    expect(json.data?.views).toEqual(['front', 'left', 'back', 'right']);
    expect(startTripoJob).toHaveBeenCalledTimes(1);
  });
});

describe('GET /api/visual-gen/generate/status — resolves every runner the table dispatches', () => {
  it('resolves a trellis2 job id instead of 404ing', async () => {
    getTrellisJob.mockImplementation((id: string) =>
      id === 't2-x' ? { id, status: 'running', gradedAs: 'class-blind', startedAt: 0 } : undefined,
    );
    const res = await status('t2-x');
    const json = (await res.json()) as { data?: { status?: string; gradedAs?: string }; error?: string };
    expect(json.error).toBeUndefined();
    expect(res.status).toBe(200);
    expect(json.data?.status).toBe('running');
    expect(json.data?.gradedAs).toBe('class-blind');
  });
});
