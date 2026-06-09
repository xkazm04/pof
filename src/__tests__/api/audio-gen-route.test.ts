import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST, GET, PATCH } from '@/app/api/audio-gen/route';

beforeEach(() => { delete process.env.ELEVENLABS_API_KEY; });
afterEach(() => { vi.restoreAllMocks(); });

function makePost(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/audio-gen', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makePatch(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/audio-gen', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/audio-gen', () => {
  it('returns 400 on missing fields', async () => {
    const res = await POST(makePost({ provider: 'elevenlabs' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 on unknown provider', async () => {
    const res = await POST(makePost({ provider: 'nope', kind: 'sfx', prompt: 'x', setName: 'fs' }));
    expect(res.status).toBe(400);
  });

  it('returns 503 when ELEVENLABS_API_KEY is absent', async () => {
    const res = await POST(makePost({ provider: 'elevenlabs', kind: 'sfx', prompt: 'x', setName: 'fs' }));
    expect(res.status).toBe(503);
  });

  it('returns 200 + asset metadata when generation succeeds', async () => {
    process.env.ELEVENLABS_API_KEY = 'sk-test';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), { status: 200 }),
    );
    const res = await POST(makePost({
      provider: 'elevenlabs', kind: 'sfx', prompt: `footstep on stone ${Date.now()}-${Math.random()}`,
      setName: 'footstep-stone', eventKey: 'footstep', surface: 'stone',
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.asset.filename).toMatch(/\.mp3$/);
    expect(body.data.set.name).toBe('footstep-stone');
    expect(body.data.cached).toBe(false);
    expect(body.data.asset.promptHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('serves an identical prompt from cache without a second provider call', async () => {
    process.env.ELEVENLABS_API_KEY = 'sk-test';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(new Uint8Array([9, 9, 9]), { status: 200 }),
    );
    const reqBody = {
      provider: 'elevenlabs', kind: 'sfx', prompt: `cache me ${Date.now()}-${Math.random()}`,
      setName: 'cache-set', durationSeconds: 1,
    };
    const first = await (await POST(makePost(reqBody))).json();
    expect(first.data.cached).toBe(false);
    const callsAfterFirst = fetchSpy.mock.calls.length;

    const second = await (await POST(makePost(reqBody))).json();
    expect(second.data.cached).toBe(true);
    // No new provider HTTP call was made for the cache hit.
    expect(fetchSpy.mock.calls.length).toBe(callsAfterFirst);
    // The cached row is returned verbatim.
    expect(second.data.asset.id).toBe(first.data.asset.id);
  });
});

describe('GET /api/audio-gen', () => {
  it('returns the sets+assets+usage envelope', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data.sets)).toBe(true);
    expect(Array.isArray(body.data.assets)).toBe(true);
    expect(typeof body.data.usage.generated).toBe('number');
    expect(typeof body.data.usage.quota).toBe('number');
  });
});

describe('PATCH /api/audio-gen', () => {
  it('400s without assetId + favorite boolean', async () => {
    expect((await PATCH(makePatch({ assetId: 'x' }))).status).toBe(400);
  });

  it('404s for an unknown asset', async () => {
    const res = await PATCH(makePatch({ assetId: 'does-not-exist', favorite: true }));
    expect(res.status).toBe(404);
  });

  it('toggles favorite on a real asset', async () => {
    process.env.ELEVENLABS_API_KEY = 'sk-test';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(new Uint8Array([1]), { status: 200 }),
    );
    const created = await (await POST(makePost({
      provider: 'elevenlabs', kind: 'sfx', prompt: `star-${Date.now()}`, setName: 'star-set',
    }))).json();
    const id = created.data.asset.id;
    const patched = await (await PATCH(makePatch({ assetId: id, favorite: true }))).json();
    expect(patched.success).toBe(true);
    expect(patched.data.asset.favorite).toBe(true);
  });
});
