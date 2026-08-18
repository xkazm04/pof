import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/audio-gen/route';

/**
 * The provider contract is enforced at the route, not merely declared.
 *
 * Before this suite the route never consulted `capabilities`, and the ElevenLabs
 * provider POSTs every request to `/v1/sound-generation` — so a `music` or `tts`
 * request produced an SFX clip, logged it under the requested kind, and billed
 * for it. A kind the provider cannot serve must be REFUSED with the reason,
 * before any provider call and before the cache is consulted.
 */

beforeEach(() => { process.env.ELEVENLABS_API_KEY = 'sk-test'; });
afterEach(() => { vi.restoreAllMocks(); delete process.env.ELEVENLABS_API_KEY; });

function post(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/audio-gen', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/audio-gen — unsupported kinds fail visibly', () => {
  for (const kind of ['music', 'tts'] as const) {
    it(`refuses ${kind} with the reason and never calls the provider`, async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(new Uint8Array([1, 2, 3]), { status: 200 }),
      );
      const res = await POST(post({
        provider: 'elevenlabs', kind, prompt: `refuse me ${Date.now()}-${Math.random()}`,
        setName: `refuse-${kind}`,
      }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.success).toBe(false);
      // The envelope names the kind AND says why it cannot be served.
      expect(body.error).toContain(kind);
      expect(body.error.length).toBeGreaterThan(kind.length + 20);
      // No billed provider call happened for a request that cannot be honoured.
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  }

  it('refuses a kind that is not an audio kind at all', async () => {
    const res = await POST(post({
      provider: 'elevenlabs', kind: 'podcast', prompt: 'x', setName: 'bogus',
    }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/kind/i);
  });

  it('still generates the kinds the provider really serves', async () => {
    // A fresh Response per call — one Response body cannot be read twice.
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      new Response(new Uint8Array([1, 2, 3]), { status: 200 }),
    );
    for (const kind of ['sfx', 'ambient'] as const) {
      const res = await POST(post({
        provider: 'elevenlabs', kind, prompt: `serve me ${kind} ${Date.now()}-${Math.random()}`,
        setName: `serve-${kind}`,
      }));
      expect(res.status).toBe(200);
    }
  });
});
