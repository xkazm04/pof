import { describe, it, expect, afterEach, vi } from 'vitest';
import { GET } from '@/app/api/pof-bridge/status/route';
import type { PofBridgeStatus } from '@/types/pof-bridge';

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
  vi.restoreAllMocks();
});

function stubFetch(impl: (url: string, init?: RequestInit) => Promise<unknown>) {
  const spy = vi.fn(impl);
  globalThis.fetch = spy as unknown as typeof fetch;
  return spy;
}

function req(query = '') {
  return { url: `http://localhost:3001/api/pof-bridge/status${query}` } as Request;
}

/** Every field the type declares — the contract the success envelope must satisfy. */
const STATUS: PofBridgeStatus = {
  pluginVersion: '1.4.0',
  engineVersion: '5.8.0',
  projectName: 'PoF',
  projectRoot: 'C:/Users/kazda/Documents/Unreal Projects/PoF',
  editorState: 'idle',
  pieRunning: false,
  liveCodingEnabled: true,
  manifestReady: true,
  manifestAssetCount: 812,
  manifestLastUpdated: '2026-08-18T09:00:00Z',
  uptimeSeconds: 4212,
  port: 30040,
};

describe('GET /api/pof-bridge/status', () => {
  it('returns the plugin status verbatim in the success envelope', async () => {
    const spy = stubFetch(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(STATUS),
    }));

    const res = await GET(req());
    const body = (await res.json()) as { success: boolean; data: PofBridgeStatus };

    expect(spy.mock.calls[0][0]).toBe('http://127.0.0.1:30040/pof/status');
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toEqual(STATUS);
    // A caller typing the response cannot be silently wrong: every declared field is there.
    for (const key of Object.keys(STATUS)) {
      expect(body.data[key as keyof PofBridgeStatus]).not.toBeUndefined();
    }
  });

  it('honors a ?port= override', async () => {
    const spy = stubFetch(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(STATUS),
    }));

    await GET(req('?port=41000'));

    expect(spy.mock.calls[0][0]).toBe('http://127.0.0.1:41000/pof/status');
  });

  it('reports an unreachable bridge through the failure envelope, not a fake success', async () => {
    stubFetch(async () => {
      throw new Error('connect ECONNREFUSED 127.0.0.1:30040');
    });

    const res = await GET(req());
    const body = (await res.json()) as { success: boolean; error: string; data?: unknown };

    expect(body.success).toBe(false);
    expect(res.status).not.toBe(200);
    expect(body.error).toMatch(/ECONNREFUSED/);
    // The old shape — a success envelope carrying an object that satisfies none of
    // PofBridgeStatus — must not come back.
    expect(body.data).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain('connected');
  });

  it('reports a live plugin with a broken body as a plugin fault, not a dead editor', async () => {
    stubFetch(async () => ({
      ok: true,
      status: 200,
      text: async () => '<html>PoF Bridge internal error</html>',
    }));

    const res = await GET(req());
    const body = (await res.json()) as { success: boolean; error: string };

    expect(body.success).toBe(false);
    expect(body.error).toMatch(/^Plugin status error: /);
    expect(body.error).toMatch(/HTTP 200/);
    expect(body.error).toMatch(/PoF Bridge internal error/);
  });

  it('preserves the upstream status for a non-2xx reply', async () => {
    stubFetch(async () => ({ ok: false, status: 503, text: async () => 'plugin restarting' }));

    const res = await GET(req());
    const body = (await res.json()) as { success: boolean; error: string };

    expect(res.status).toBe(503);
    expect(body.success).toBe(false);
    expect(body.error).toBe('Plugin status error: plugin restarting');
  });
});
