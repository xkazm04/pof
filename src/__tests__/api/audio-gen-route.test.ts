import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST, GET } from '@/app/api/audio-gen/route';

beforeEach(() => { delete process.env.ELEVENLABS_API_KEY; });
afterEach(() => { vi.restoreAllMocks(); });

function makePost(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/audio-gen', {
    method: 'POST',
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
      provider: 'elevenlabs', kind: 'sfx', prompt: 'footstep on stone',
      setName: 'footstep-stone', eventKey: 'footstep', surface: 'stone',
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.asset.filename).toMatch(/\.mp3$/);
    expect(body.data.set.name).toBe('footstep-stone');
  });
});

describe('GET /api/audio-gen', () => {
  it('returns the sets+assets envelope', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data.sets)).toBe(true);
    expect(Array.isArray(body.data.assets)).toBe(true);
  });
});
