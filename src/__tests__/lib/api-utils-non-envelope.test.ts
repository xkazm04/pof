import { describe, it, expect, vi } from 'vitest';
import { apiFetch, tryApiFetch } from '@/lib/api-utils';

function stubHtml(status: number) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: false,
    status,
    json: () => Promise.reject(new SyntaxError("Unexpected token '<', is not valid JSON")),
  }) as unknown as typeof fetch;
}

function stubJson(body: unknown, status: number) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: status < 400,
    status,
    json: () => Promise.resolve(body),
  }) as unknown as typeof fetch;
}

describe('a response that is not the API envelope', () => {
  it('apiFetch names the HTTP status for an HTML error page, not the JSON parser', async () => {
    stubHtml(500);
    await expect(apiFetch('/api/x')).rejects.toThrow(/HTTP 500/);
  });

  it('tryApiFetch returns the same readable error', async () => {
    stubHtml(404);
    const r = await tryApiFetch('/api/x');
    expect(r).toEqual({ ok: false, error: expect.stringMatching(/HTTP 404/) });
  });

  it('never throws an empty message for JSON without an error field', async () => {
    stubJson({ detail: 'nope' }, 502);
    await expect(apiFetch('/api/x')).rejects.toThrow(/HTTP 502/);
    const r = await tryApiFetch('/api/x');
    expect(r).toEqual({ ok: false, error: expect.stringMatching(/HTTP 502/) });
  });

  it('handles a null JSON body', async () => {
    stubJson(null, 200);
    await expect(apiFetch('/api/x')).rejects.toThrow(/HTTP 200/);
  });

  it('still surfaces the server error text of a real failure envelope', async () => {
    stubJson({ success: false, error: 'Not found' }, 404);
    await expect(apiFetch('/api/x')).rejects.toThrow('Not found');
  });
});
