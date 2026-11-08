/**
 * Upscale and unzoom honour download-then-delete on every exit.
 *
 * Both start a Leonardo variation job. They used to return only the job id, so nothing
 * fetched the result and the variation stayed on the account.
 *
 * fetch is stubbed entirely: this suite never reaches the real Leonardo API.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { upscaleImage, unzoomImage } from '@/lib/leonardo';

const V1 = 'https://cloud.leonardo.ai/api/rest/v1';
const CDN = 'https://cdn.leonardo.ai/';
const FAST = { pollIntervalMs: 1, maxPollAttempts: 3 };

interface Call { url: string; method: string; body?: unknown }
interface Scenario {
  status?: string;
  downloadOk?: boolean;
  deleteReply?: 'ok' | 'not-found' | 'throw';
  startStatus?: number;
}

const JOB = 'var-1';

function install(startPath: string, startBody: unknown, s: Scenario = {}): Call[] {
  const calls: Call[] = [];
  globalThis.fetch = vi.fn(async (url: string, init?: { method?: string; body?: string }) => {
    const method = init?.method ?? 'GET';
    calls.push({ url, method, body: init?.body ? JSON.parse(init.body) : undefined });
    const reply = (status: number, body: unknown = {}) => ({
      ok: status < 400,
      status,
      json: () => Promise.resolve(body),
      text: () => Promise.resolve(JSON.stringify(body)),
      arrayBuffer: () => Promise.resolve(new Uint8Array([1, 2, 3, 4]).buffer),
    });
    if (method === 'POST' && url === `${V1}${startPath}`) return reply(s.startStatus ?? 200, startBody);
    if (method === 'GET' && url === `${V1}/variations/${JOB}`) {
      return reply(200, { generated_image_variation_generic: [{ id: JOB, status: s.status ?? 'COMPLETE', url: `${CDN}v.png` }] });
    }
    if (url.startsWith(CDN)) return reply(s.downloadOk === false ? 503 : 200);
    if (method === 'DELETE') {
      if (s.deleteReply === 'throw') throw new Error('network down');
      return reply(s.deleteReply === 'not-found' ? 404 : 200);
    }
    return reply(500);
  }) as unknown as typeof fetch;
  return calls;
}

const deletes = (calls: Call[]) => calls.filter((c) => c.method === 'DELETE' && c.url === `${V1}/variations/${JOB}`).length;

const modes = [
  {
    name: 'upscaleImage',
    path: '/variations/universal-upscaler',
    started: { universalUpscaler: { id: JOB } },
    run: () => upscaleImage('img-1', 'GENERAL', FAST),
  },
  {
    name: 'unzoomImage',
    path: '/variations/unzoom',
    started: { sdUnzoomJob: { id: JOB } },
    run: () => unzoomImage('img-1', FAST),
  },
];

beforeEach(() => { process.env.LEONARDO_API_KEY = 'test-key'; });
afterEach(() => { vi.restoreAllMocks(); });

describe.each(modes)('$name', ({ path, started, run }) => {
  it('success: returns the bytes and deletes exactly once, after the download', async () => {
    const calls = install(path, started);
    const res = await run();
    expect(res.variationId).toBe(JOB);
    expect(res.imageUrl).toBe(`${CDN}v.png`);
    expect(res.imageBase64).toBe(Buffer.from([1, 2, 3, 4]).toString('base64'));
    expect(res.variationDeleted).toBe(true);
    expect(deletes(calls)).toBe(1);
    const dl = calls.findIndex((c) => c.url.startsWith(CDN));
    const del = calls.findIndex((c) => c.method === 'DELETE');
    expect(dl).toBeGreaterThan(-1);
    expect(del).toBeGreaterThan(dl);
  });

  it('FAILED status: throws AND deletes', async () => {
    const calls = install(path, started, { status: 'FAILED' });
    await expect(run()).rejects.toThrow(/failed/i);
    expect(deletes(calls)).toBe(1);
  });

  it('poll timeout: throws AND deletes', async () => {
    const calls = install(path, started, { status: 'PENDING' });
    await expect(run()).rejects.toThrow(/timed out/i);
    expect(deletes(calls)).toBe(1);
  });

  it('download failure: throws AND deletes', async () => {
    const calls = install(path, started, { downloadOk: false });
    await expect(run()).rejects.toThrow(/download failed/i);
    expect(deletes(calls)).toBe(1);
  });

  it.each(['not-found', 'throw'] as const)('a refused delete (%s) keeps the bytes and reports it', async (deleteReply) => {
    install(path, started, { deleteReply });
    const res = await run();
    expect(res.imageBase64).toBeTruthy();
    expect(res.variationDeleted).toBe(false);
  });

  it('a failing delete does not mask the original error, and names the leftover', async () => {
    install(path, started, { status: 'FAILED', deleteReply: 'throw' });
    await expect(run()).rejects.toThrow(/failed.*var-1.*still on the Leonardo account/i);
  });

  it('a refused start explains that PoF ids no longer exist, and has nothing to delete', async () => {
    const calls = install(path, { error: 'nope' }, { startStatus: 400 });
    await expect(run()).rejects.toThrow(/must still exist.*PoF deletes/i);
    expect(deletes(calls)).toBe(0);
  });

  it('a start with no job id throws without polling', async () => {
    const calls = install(path, {});
    await expect(run()).rejects.toThrow(/no.*id/i);
    expect(calls.some((c) => c.url.includes('/variations/var-1'))).toBe(false);
  });
});
