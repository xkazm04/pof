/**
 * The Blender-MCP status route reports a verdict axis, not just transport.
 *
 * Forced-failure suite for `mcp-jobs-verdict-axis`. At HEAD~1 this route returned
 * `{ jobId, status, progress, resultUrl }` and nothing else, so a finished Blender
 * generation reached the forge queue as a bare `completed` and rendered as a green
 * "Complete" — in the same queue where a runner job's "Complete" means a Tier-1 gate
 * passed the mesh. Every `ungated` / `gateReason` assertion below is red without the
 * projection.
 *
 * FEASIBILITY, STATED: the critique itself CANNOT run on this path (no mesh file ever
 * reaches this server — see `mcp-gate.ts`). The honest outcome is therefore "delivered
 * ungated, and here is what is missing", in the same words `summarizeGate` gives the
 * local stores. A fabricated pass was never on the table.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { mcpGateProjection, MCP_CRITIQUE_UNAVAILABLE_REASON } from '@/lib/blender-mcp/mcp-gate';

const pollJobStatus = vi.fn();
vi.mock('@/lib/blender-mcp/service', () => ({ getService: () => ({ pollJobStatus }) }));

const { GET } = await import('@/app/api/blender-mcp/generate/status/route');

const req = () =>
  new NextRequest('http://localhost:3001/api/blender-mcp/generate/status?jobId=j1&provider=hyper3d');

async function poll(data: unknown, ok = true) {
  pollJobStatus.mockResolvedValue(ok ? { ok: true, data } : { ok: false, error: String(data) });
  const res = await GET(req());
  return { res, body: (await res.json()) as { success: boolean; data: Record<string, unknown>; error?: string } };
}

beforeEach(() => pollJobStatus.mockReset());

describe('mcpGateProjection — a verdict only for a delivery', () => {
  it('reports a completed MCP job as delivered-ungated with the located reason', () => {
    const g = mcpGateProjection('completed');
    expect(g.accepted).toBe(false);
    expect(g.ungated).toBe(true);
    // The shared vocabulary (`ungatedReason`), not a second phrasing of it.
    expect(g.gateReason).toContain('critique unavailable');
    expect(g.gateReason).toContain('delivered ungated');
    // and it NAMES what is missing rather than hedging
    expect(g.gateReason).toContain(MCP_CRITIQUE_UNAVAILABLE_REASON);
    expect(g.gateReason).toContain('no mesh file reaches this server');
  });

  it('never claims the mesh passed', () => {
    expect(mcpGateProjection('completed').accepted).not.toBe(true);
  });

  it('stamps nothing on a job that has produced nothing to grade', () => {
    for (const s of ['pending', 'processing', 'failed'] as const) {
      expect(mcpGateProjection(s)).toEqual({});
    }
  });
});

describe('GET /api/blender-mcp/generate/status', () => {
  it('carries the verdict axis alongside the transport fields on a delivery', async () => {
    const { body } = await poll({ jobId: 'j1', status: 'completed', progress: 100, resultUrl: 'https://cdn/x.glb' });

    expect(body.success).toBe(true);
    // transport, untouched
    expect(body.data.status).toBe('completed');
    expect(body.data.progress).toBe(100);
    expect(body.data.resultUrl).toBe('https://cdn/x.glb');
    // verdict, newly present
    expect(body.data.accepted).toBe(false);
    expect(body.data.ungated).toBe(true);
    expect(String(body.data.gateReason)).toContain('delivered ungated');
  });

  it('leaves an in-flight job with no verdict at all', async () => {
    const { body } = await poll({ jobId: 'j1', status: 'processing', progress: 40 });
    expect(body.data.status).toBe('processing');
    expect(body.data.ungated).toBeUndefined();
    expect(body.data.gateReason).toBeUndefined();
  });

  it('still surfaces a bridge transport failure as an error envelope', async () => {
    const { res, body } = await poll('Blender bridge is not connected', false);
    expect(res.status).toBe(502);
    expect(body.success).toBe(false);
    expect(body.error).toContain('not connected');
  });

  it('still refuses a request missing jobId/provider', async () => {
    const res = await GET(new NextRequest('http://localhost:3001/api/blender-mcp/generate/status'));
    expect(res.status).toBe(400);
  });
});
