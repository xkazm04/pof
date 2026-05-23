import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { deleteGeneration, downloadThenDelete } from '@/lib/leonardo';

const BASE = 'https://cloud.leonardo.ai/api/rest/v1';

interface Call { url: string; method: string; body?: unknown }

/** A fetch mock that records every call and matches by URL substring + method. */
function installFetch(handler: (url: string, method: string) => {
  ok?: boolean; status?: number; body?: unknown; bytes?: ArrayBuffer;
}): { calls: Call[] } {
  const calls: Call[] = [];
  globalThis.fetch = vi.fn(async (url: string, init?: { method?: string; body?: string }) => {
    const method = init?.method ?? 'GET';
    calls.push({ url, method, body: init?.body ? JSON.parse(init.body) : undefined });
    const r = handler(url, method);
    return {
      ok: r.ok ?? true,
      status: r.status ?? 200,
      json: () => Promise.resolve(r.body ?? {}),
      text: () => Promise.resolve(JSON.stringify(r.body ?? {})),
      arrayBuffer: () => Promise.resolve(r.bytes ?? new ArrayBuffer(8)),
    };
  }) as unknown as typeof fetch;
  return { calls };
}

beforeEach(() => { process.env.LEONARDO_API_KEY = 'test-key'; });
afterEach(() => { vi.restoreAllMocks(); });

describe('deleteGeneration', () => {
  it('issues a DELETE to /generations/{id}', async () => {
    const { calls } = installFetch(() => ({ body: {} }));
    await deleteGeneration('gen-123');
    const del = calls.find((c) => c.method === 'DELETE');
    expect(del).toBeDefined();
    expect(del!.url).toBe(`${BASE}/generations/gen-123`);
  });
});

describe('downloadThenDelete', () => {
  it('fetches the image bytes THEN deletes the generation', async () => {
    const { calls } = installFetch(() => ({ bytes: new ArrayBuffer(16), body: {} }));
    const bytes = await downloadThenDelete('https://cdn.leonardo.ai/img.png', 'gen-9');
    expect(bytes.byteLength).toBe(16);
    const getIdx = calls.findIndex((c) => c.url.includes('cdn.leonardo.ai'));
    const delIdx = calls.findIndex((c) => c.method === 'DELETE');
    expect(getIdx).toBeGreaterThanOrEqual(0);
    expect(delIdx).toBeGreaterThan(getIdx); // download precedes delete
  });
});
