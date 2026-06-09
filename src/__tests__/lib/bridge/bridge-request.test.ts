import { describe, it, expect, vi, afterEach } from 'vitest';
import { bridgeRequest } from '@/lib/ue5-bridge/shared';

afterEach(() => {
  vi.restoreAllMocks();
});

const BASE = 'http://localhost:1234';
const baseOpts = {
  method: 'GET' as const,
  path: '/ping',
  timeout: 5_000,
  label: 'Test Bridge',
  logPrefix: '[Test]',
};

describe('bridgeRequest', () => {
  it('builds the URL, sets Content-Type, and unwraps a 2xx JSON body into ok', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ version: '1.0' }), { status: 200 }),
      );

    const result = await bridgeRequest<{ version: string }>(BASE, baseOpts);

    expect(result).toEqual({ ok: true, data: { version: '1.0' } });
    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:1234/ping',
      expect.objectContaining({
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    // No body on a method with no body.
    expect((fetchSpy.mock.calls[0][1] as RequestInit).body).toBeUndefined();
  });

  it('JSON-stringifies the body when provided', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ ok: 1 }), { status: 200 }));

    await bridgeRequest(BASE, { ...baseOpts, method: 'POST', body: { a: 1 } });

    expect((fetchSpy.mock.calls[0][1] as RequestInit).body).toBe('{"a":1}');
  });

  it('merges extra headers on top of Content-Type', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{}', { status: 200 }));

    await bridgeRequest(BASE, { ...baseOpts, headers: { 'X-Pof-Auth-Token': 'secret' } });

    expect((fetchSpy.mock.calls[0][1] as RequestInit).headers).toEqual({
      'Content-Type': 'application/json',
      'X-Pof-Auth-Token': 'secret',
    });
  });

  it('returns err with the label + status + body excerpt on a non-2xx response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('kaboom', { status: 500 }),
    );

    const result = await bridgeRequest(BASE, baseOpts);

    expect(result).toEqual({
      ok: false,
      error: 'Test Bridge GET /ping returned 500: kaboom',
    });
  });

  it('returns a timeout err when the request aborts', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      new DOMException('aborted', 'AbortError'),
    );

    const result = await bridgeRequest(BASE, baseOpts);

    expect(result).toEqual({
      ok: false,
      error: 'Test Bridge GET /ping timed out after 5000ms',
    });
  });

  it('folds a generic network error into err(message)', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'));

    const result = await bridgeRequest(BASE, baseOpts);

    expect(result).toEqual({ ok: false, error: 'ECONNREFUSED' });
  });
});
