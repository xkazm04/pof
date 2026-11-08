/**
 * GET /api/blender-mcp/generate/status can fetch a provider mesh through mcpGateForJob, so a
 * cross-site page must not be able to trigger it. Same-origin and header-less callers (the
 * forge poll sends no Origin on a same-origin GET) are unaffected.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

const pollJobStatus = vi.fn();
vi.mock('@/lib/blender-mcp/service', () => ({ getService: () => ({ pollJobStatus }) }));
const mcpGateForJob = vi.fn(async () => ({}));
vi.mock('@/lib/blender-mcp/mcp-gate', () => ({ mcpGateForJob: (...a: unknown[]) => mcpGateForJob(...(a as [])) }));

const { GET } = await import('@/app/api/blender-mcp/generate/status/route');

const URL_ = 'http://localhost:3001/api/blender-mcp/generate/status?jobId=j1&provider=hyper3d';
const get = (headers: Record<string, string> = {}) => GET(new NextRequest(URL_, { headers: { host: 'localhost:3001', ...headers } }));

beforeEach(() => {
  pollJobStatus.mockReset();
  pollJobStatus.mockResolvedValue({ ok: true, data: { status: 'completed', resultUrl: 'https://provider.example/m.glb' } });
  mcpGateForJob.mockClear();
});

describe('generate/status operator guard', () => {
  it('answers 403 for a cross-site Origin and starts no download', async () => {
    const res = await get({ origin: 'https://evil.example' });
    expect(res.status).toBe(403);
    expect(pollJobStatus).not.toHaveBeenCalled();
    expect(mcpGateForJob).not.toHaveBeenCalled();
  });

  it('[guard] a same-origin Origin still polls and gates', async () => {
    const res = await get({ origin: 'http://localhost:3001' });
    expect(res.status).toBe(200);
    expect(mcpGateForJob).toHaveBeenCalledTimes(1);
  });

  it('[guard] a request with no Origin (same-origin GET from the forge poll) still polls', async () => {
    const res = await get();
    expect(res.status).toBe(200);
    expect(mcpGateForJob).toHaveBeenCalledTimes(1);
  });
});
