import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { deleteGeneration, downloadThenDelete, generateImage, upscaleImage } from '@/lib/leonardo';

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

function installGenFetch(opts: { status?: string } = {}): { calls: Call[] } {
  const status = opts.status ?? 'COMPLETE';
  return installFetch((url, method) => {
    if (method === 'POST' && url.endsWith('/generations')) {
      return { body: { sdGenerationJob: { generationId: 'gen-1' } } };
    }
    if (method === 'GET' && url.includes('/generations/gen-1')) {
      return { body: { generations_by_pk: { status, generated_images: [{ url: 'https://cdn.leonardo.ai/x.png', id: 'img-1' }] } } };
    }
    if (url.includes('cdn.leonardo.ai')) return { bytes: new ArrayBuffer(4) };
    return { body: {} }; // DELETE
  });
}

describe('generateImage', () => {
  it('back-compat: string-only call sends the legacy 512x512 Lucid Origin body', async () => {
    const { calls } = installGenFetch();
    const result = await generateImage('a stone wall', { pollIntervalMs: 1 });
    const post = calls.find((c) => c.method === 'POST' && c.url.endsWith('/generations'));
    expect(post!.body).toEqual({
      modelId: '7b592283-e8a7-4c5a-9ba6-d18c31f258b9',
      prompt: 'a stone wall',
      width: 512,
      height: 512,
      num_images: 1,
      contrast: 3.5,
    });
    expect(result.imageUrl).toBe('https://cdn.leonardo.ai/x.png');
    expect(result.generationId).toBe('gen-1');
  });

  it('cleanup=true (default) downloads bytes then DELETEs the generation', async () => {
    const { calls } = installGenFetch();
    const result = await generateImage('a stone wall', { pollIntervalMs: 1 });
    expect(calls.some((c) => c.method === 'DELETE' && c.url.includes('/generations/gen-1'))).toBe(true);
    expect(result.imageBase64).toBeDefined();
  });

  it('cleanup=false leaves the generation (no DELETE)', async () => {
    const { calls } = installGenFetch();
    await generateImage('x', { pollIntervalMs: 1, cleanup: false });
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false);
  });

  it('opts add tiling + model + dimensions to the request body', async () => {
    const { calls } = installGenFetch();
    await generateImage('seamless rock', {
      pollIntervalMs: 1, modelId: '05ce0082-2d80-4a2d-8653-4d1c85e2418e',
      width: 1024, height: 1024, tiling: true, transparency: 'foreground', contrast: 4, numImages: 2,
    });
    const post = calls.find((c) => c.method === 'POST' && c.url.endsWith('/generations'));
    expect(post!.body).toEqual({
      modelId: '05ce0082-2d80-4a2d-8653-4d1c85e2418e',
      prompt: 'seamless rock',
      width: 1024, height: 1024, num_images: 2, contrast: 4,
      tiling: true, transparency: 'foreground',
    });
  });
});

describe('upscaleImage', () => {
  it('POSTs the image id + style to /universal-upscaler', async () => {
    const { calls } = installFetch((url, method) => {
      if (method === 'POST' && url.endsWith('/universal-upscaler')) {
        return { body: { universalUpscaler: { id: 'up-1' } } };
      }
      return { body: {} };
    });
    const res = await upscaleImage('img-7', 'GENERAL');
    const post = calls.find((c) => c.url.endsWith('/universal-upscaler'));
    expect(post!.body).toEqual({ generatedImageId: 'img-7', upscalerStyle: 'GENERAL' });
    expect(res.upscaleJobId).toBe('up-1');
  });
});
