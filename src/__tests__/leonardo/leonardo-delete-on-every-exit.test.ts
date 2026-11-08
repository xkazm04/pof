/**
 * Download-then-delete holds on EVERY exit, not only the happy path.
 *
 * Project rule: every Leonardo generation PoF creates is downloaded, then deleted
 * from the account. Before this suite, generateImage / the v2 video submit /
 * generateStartFrame deleted only after a successful poll + download, so a poll
 * timeout, a FAILED status or a failed download left the generation on the account.
 *
 * fetch is stubbed entirely — this suite never reaches the real Leonardo API.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  downloadThenDelete,
  generateImage,
  generateStartFrame,
  generateVideo,
  generateVideoFromPrompt,
} from '@/lib/leonardo';

const V1 = 'https://cloud.leonardo.ai/api/rest/v1';
const V2 = 'https://cloud.leonardo.ai/api/rest/v2';
const CDN = 'https://cdn.leonardo.ai/';

interface Call { url: string; method: string }
interface Reply { ok?: boolean; status?: number; body?: unknown }

function installFetch(handler: (url: string, method: string) => Reply): Call[] {
  const calls: Call[] = [];
  globalThis.fetch = vi.fn(async (url: string, init?: { method?: string }) => {
    const method = init?.method ?? 'GET';
    calls.push({ url, method });
    const r = handler(url, method);
    return {
      ok: r.ok ?? true,
      status: r.status ?? 200,
      json: () => Promise.resolve(r.body ?? {}),
      text: () => Promise.resolve(JSON.stringify(r.body ?? {})),
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(4)),
    };
  }) as unknown as typeof fetch;
  return calls;
}

function deletesOf(calls: Call[], id: string): number {
  return calls.filter((c) => c.method === 'DELETE' && c.url === `${V1}/generations/${id}`).length;
}

/** Image generation fixture: POST v1 -> gen-1; poll returns `status`; CDN download returns `downloadOk`. */
function imageFetch(status: string, downloadOk = true): Call[] {
  return installFetch((url, method) => {
    if (method === 'POST' && url === `${V1}/generations`) return { body: { sdGenerationJob: { generationId: 'gen-1' } } };
    if (method === 'GET' && url === `${V1}/generations/gen-1`) {
      return { body: { generations_by_pk: { status, generated_images: [{ url: `${CDN}x.png`, id: 'img-1' }] } } };
    }
    if (url.startsWith(CDN)) return downloadOk ? {} : { ok: false, status: 503 };
    return { body: {} }; // DELETE
  });
}

/** v2 fixture (video + start frame): every POST v2 hands out the next id; poll by id returns `statusOf(id)`. */
function v2Fetch(statusOf: (id: string) => string, downloadOk = true): Call[] {
  let n = 0;
  return installFetch((url, method) => {
    if (method === 'POST' && url === `${V2}/generations`) return { body: { generate: { generationId: `v2-${++n}` } } };
    const m = url.match(/\/generations\/(v2-\d+)$/);
    if (method === 'GET' && m) {
      return { body: { generations_by_pk: { status: statusOf(m[1]), generated_images: [
        { id: `${m[1]}-img`, url: `${CDN}${m[1]}.png`, motionMP4URL: `${CDN}${m[1]}.mp4` },
      ] } } };
    }
    if (url.startsWith(CDN)) return downloadOk ? {} : { ok: false, status: 503 };
    return { body: {} };
  });
}

beforeEach(() => { process.env.LEONARDO_API_KEY = 'test-key'; });
afterEach(() => { vi.restoreAllMocks(); });

describe('generateImage deletes the generation on every exit', () => {
  it('success: exactly one DELETE (no double delete)', async () => {
    const calls = imageFetch('COMPLETE');
    await generateImage('wall', { pollIntervalMs: 1 });
    expect(deletesOf(calls, 'gen-1')).toBe(1);
  });

  it('FAILED status: throws AND deletes', async () => {
    const calls = imageFetch('FAILED');
    await expect(generateImage('wall', { pollIntervalMs: 1 })).rejects.toThrow(/failed/i);
    expect(deletesOf(calls, 'gen-1')).toBe(1);
  });

  it('poll timeout: throws AND deletes', async () => {
    const calls = imageFetch('PENDING');
    await expect(generateImage('wall', { pollIntervalMs: 1 })).rejects.toThrow(/timed out/i);
    expect(deletesOf(calls, 'gen-1')).toBe(1);
  });

  it('download failure: throws AND deletes', async () => {
    const calls = imageFetch('COMPLETE', false);
    await expect(generateImage('wall', { pollIntervalMs: 1 })).rejects.toThrow(/download failed/i);
    expect(deletesOf(calls, 'gen-1')).toBe(1);
  });

  it('cleanup=false is still honoured on a failure exit (no DELETE)', async () => {
    const calls = imageFetch('FAILED');
    await expect(generateImage('wall', { pollIntervalMs: 1, cleanup: false })).rejects.toThrow();
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false);
  });

  it('a failing DELETE does not mask the original error', async () => {
    installFetch((url, method) => {
      if (method === 'POST') return { body: { sdGenerationJob: { generationId: 'gen-1' } } };
      if (method === 'DELETE') throw new Error('network down');
      return { body: { generations_by_pk: { status: 'FAILED', generated_images: [] } } };
    });
    await expect(generateImage('wall', { pollIntervalMs: 1 })).rejects.toThrow(/Leonardo generation failed/);
  });
});

describe('downloadThenDelete', () => {
  it('deletes even when the download fails', async () => {
    const calls = installFetch((url) => (url.startsWith(CDN) ? { ok: false, status: 404 } : { body: {} }));
    await expect(downloadThenDelete(`${CDN}x.png`, 'gen-7')).rejects.toThrow(/download failed/i);
    expect(deletesOf(calls, 'gen-7')).toBe(1);
  });
});

describe('v2 video submit deletes on every exit', () => {
  it('FAILED status: throws AND deletes', async () => {
    const calls = v2Fetch(() => 'FAILED');
    await expect(generateVideo('swing', { pollIntervalMs: 1, maxPollAttempts: 3 })).rejects.toThrow(/failed/i);
    expect(deletesOf(calls, 'v2-1')).toBe(1);
  });

  it('poll timeout: throws AND deletes', async () => {
    const calls = v2Fetch(() => 'PENDING');
    await expect(generateVideo('swing', { pollIntervalMs: 1, maxPollAttempts: 3 })).rejects.toThrow(/timed out/i);
    expect(deletesOf(calls, 'v2-1')).toBe(1);
  });

  it('download failure: throws AND deletes', async () => {
    const calls = v2Fetch(() => 'COMPLETE', false);
    await expect(generateVideo('swing', { pollIntervalMs: 1, maxPollAttempts: 3 })).rejects.toThrow(/download failed/i);
    expect(deletesOf(calls, 'v2-1')).toBe(1);
  });
});

describe('generateStartFrame deletes its frame when it cannot hand the id back', () => {
  it('FAILED status: throws AND deletes', async () => {
    const calls = v2Fetch(() => 'FAILED');
    await expect(generateStartFrame('hero', { pollIntervalMs: 1, maxPollAttempts: 3 })).rejects.toThrow(/failed/i);
    expect(deletesOf(calls, 'v2-1')).toBe(1);
  });

  it('success: no DELETE (the caller owns the frame)', async () => {
    const calls = v2Fetch(() => 'COMPLETE');
    const frame = await generateStartFrame('hero', { pollIntervalMs: 1, maxPollAttempts: 3 });
    expect(frame.generationId).toBe('v2-1');
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false);
  });

  it('generateVideoFromPrompt: a failed clip still deletes both frame and clip', async () => {
    const calls = v2Fetch((id) => (id === 'v2-1' ? 'COMPLETE' : 'FAILED'));
    await expect(generateVideoFromPrompt('swing', { pollIntervalMs: 1, maxPollAttempts: 3 })).rejects.toThrow();
    expect(deletesOf(calls, 'v2-1')).toBe(1);
    expect(deletesOf(calls, 'v2-2')).toBe(1);
  });
});
