/**
 * GET /api/pof-bridge/manifest — the checksum-only answer is normalized to the
 * one shape the client reads (`{ checksumSha256 }`), whichever key the plugin
 * used (`{ checksum }` is the documented plugin contract).
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { GET } from '@/app/api/pof-bridge/manifest/route';

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
  vi.restoreAllMocks();
});

function stubPlugin(body: unknown) {
  const spy = vi.fn<(url: string) => Promise<unknown>>(async () => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify(body),
  }));
  globalThis.fetch = spy as unknown as typeof fetch;
  return spy;
}

function req(query: string) {
  return { url: `http://localhost:3001/api/pof-bridge/manifest${query}` } as Request;
}

describe('GET /api/pof-bridge/manifest?checksum-only=true', () => {
  it('normalizes the plugin { checksum } answer to { checksumSha256 }', async () => {
    const spy = stubPlugin({ checksum: 'abc' });

    const res = await GET(req('?checksum-only=true'));
    const body = await res.json();

    expect(spy.mock.calls[0][0]).toBe('http://127.0.0.1:30040/pof/manifest?checksum-only=true');
    expect(body).toEqual({ success: true, data: { checksumSha256: 'abc' } });
  });

  it('accepts the legacy { checksumSha256 } answer and honors ?port=', async () => {
    const spy = stubPlugin({ checksumSha256: 'def' });

    const res = await GET(req('?checksum-only=true&port=30041'));
    const body = await res.json();

    expect(spy.mock.calls[0][0]).toBe('http://127.0.0.1:30041/pof/manifest?checksum-only=true');
    expect(body).toEqual({ success: true, data: { checksumSha256: 'def' } });
  });

  it('reports an answer that carries no checksum instead of passing it through', async () => {
    stubPlugin({ unexpected: true });

    const res = await GET(req('?checksum-only=true'));
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body.success).toBe(false);
  });
});

describe('GET /api/pof-bridge/manifest', () => {
  it('returns the full manifest verbatim', async () => {
    const manifest = { projectName: 'Did', checksumSha256: 'c1', assetCount: 0 };
    stubPlugin(manifest);

    const res = await GET(req(''));
    const body = await res.json();

    expect(body).toEqual({ success: true, data: manifest });
  });
});
