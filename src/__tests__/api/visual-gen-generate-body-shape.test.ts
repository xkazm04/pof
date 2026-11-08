/**
 * POST /api/visual-gen/generate refuses a malformed body as the caller's mistake (400), and
 * before any provider job or paid vision call. It used to throw a TypeError into the 500
 * path, and a non-integer `mcResolution` / `maxAttempts` reached the runners.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { startTriposrJob, startTripoJob, gateInputImage } = vi.hoisted(() => ({
  startTriposrJob: vi.fn(() => 'job-triposr'),
  startTripoJob: vi.fn(() => 'job-tripo'),
  gateInputImage: vi.fn(),
}));
vi.mock('@/lib/visual-gen/triposr-job-store', () => ({ startTriposrJob }));
vi.mock('@/lib/visual-gen/hunyuan-job-store', () => ({ startHunyuanJob: vi.fn() }));
vi.mock('@/lib/visual-gen/tripo-job-store', () => ({ startTripoJob }));
vi.mock('@/lib/visual-gen/input-gate', async (orig) => ({
  ...(await orig<typeof import('@/lib/visual-gen/input-gate')>()),
  gateInputImage,
}));

const { POST } = await import('@/app/api/visual-gen/generate/route');

const raw = (body: string) =>
  POST(new NextRequest('http://localhost/api/visual-gen/generate', { method: 'POST', body }));
const post = (body: unknown) => raw(JSON.stringify(body));
const TEXT = { mode: 'text-to-3d', providerId: 'tripo3d', prompt: 'a bronze shield' };

beforeEach(() => vi.clearAllMocks());

describe('POST /api/visual-gen/generate — body shape', () => {
  it.each(['{not json', 'null', '[]', '"text"'])('refuses the body %s with a 400', async (body) => {
    expect((await raw(body)).status).toBe(400);
  });

  it.each([
    ['prompt', 123],
    ['mode', 7],
    ['providerId', {}],
    ['imageDataUrl', 5],
    ['assetClass', []],
    ['viewDataUrls', 'front'],
    ['viewDataUrls', { front: 9 }],
    ['maxAttempts', 'many'],
    ['maxAttempts', 0],
    ['maxAttempts', 1.5],
    ['mcResolution', -1],
    ['mcResolution', 100000],
    ['mcResolution', 'high'],
  ])('refuses %s=%j before any job starts', async (field, value) => {
    const res = await post({ ...TEXT, [field]: value });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toContain(field);
    expect(startTripoJob).not.toHaveBeenCalled();
    expect(gateInputImage).not.toHaveBeenCalled();
  });

  it('[guard] a well-formed submit still starts its job, and null optionals mean absent', async () => {
    const res = await post({ ...TEXT, maxAttempts: 3, mcResolution: null, assetClass: null });
    expect(res.status).toBe(202);
    expect(startTripoJob).toHaveBeenCalledTimes(1);
  });
});
