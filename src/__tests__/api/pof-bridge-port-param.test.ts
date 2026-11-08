/**
 * `?port=` feeds every /api/pof-bridge/* route. Garbage used to reach the URL builder as NaN and
 * came back as a connection failure, which reads as "the editor is not running".
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET } from '@/app/api/pof-bridge/status/route';

const realFetch = globalThis.fetch;
let spy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  spy = vi.fn(async () => ({ ok: true, status: 200, text: async () => '{"port":30040}' }));
  globalThis.fetch = spy as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

const req = (qs: string) => ({ url: `http://localhost:3001/api/pof-bridge/status${qs}` }) as Request;

describe('?port= on the pof-bridge proxy', () => {
  it.each(['abc', '0', '-1', '70000', '1.5', '30040abc'])('answers 400 for port=%s without calling out', async (port) => {
    const res = await GET(req(`?port=${port}`));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toContain('port');
    expect(spy).not.toHaveBeenCalled();
  });

  it('honors a valid override and the default', async () => {
    await GET(req('?port=41000'));
    await GET(req(''));
    expect(spy.mock.calls[0][0]).toBe('http://127.0.0.1:41000/pof/status');
    expect(spy.mock.calls[1][0]).toBe('http://127.0.0.1:30040/pof/status');
  });
});
