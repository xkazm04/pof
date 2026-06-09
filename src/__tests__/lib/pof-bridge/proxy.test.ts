import { describe, it, expect, afterEach, vi } from 'vitest';
import { proxyToPofBridge, pofProxyError, type PofProxyResult } from '@/lib/pof-bridge/proxy';
import { resolvePofPort, POF_BRIDGE } from '@/lib/pof-bridge/constants';

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
  vi.restoreAllMocks();
});

function stubFetch(impl: (url: string, init?: RequestInit) => Promise<unknown>) {
  const spy = vi.fn(impl);
  globalThis.fetch = spy as unknown as typeof fetch;
  return spy;
}

describe('resolvePofPort', () => {
  it('falls back to the default port when no override is present', () => {
    expect(resolvePofPort(new URLSearchParams())).toBe(POF_BRIDGE.DEFAULT_PORT);
  });

  it('parses a ?port= override', () => {
    expect(resolvePofPort(new URLSearchParams('port=41000'))).toBe(41000);
  });
});

describe('proxyToPofBridge', () => {
  it('builds the bridge URL from host + port + path and returns parsed data on 2xx', async () => {
    const spy = stubFetch(async () => ({ ok: true, json: async () => ({ connected: true }) }));

    const result = await proxyToPofBridge<{ connected: boolean }>('status', { port: 30040 });

    expect(spy.mock.calls[0][0]).toBe('http://127.0.0.1:30040/pof/status');
    expect(result).toEqual({ ok: true, data: { connected: true } });
  });

  it('honors a non-default port and an embedded query string in the path', async () => {
    const spy = stubFetch(async () => ({ ok: true, json: async () => ({}) }));

    await proxyToPofBridge('manifest?checksum-only=true', { port: 41000 });

    expect(spy.mock.calls[0][0]).toBe('http://127.0.0.1:41000/pof/manifest?checksum-only=true');
  });

  it('does not set a Content-Type header on GET', async () => {
    const spy = stubFetch(async () => ({ ok: true, json: async () => ({}) }));

    await proxyToPofBridge('status', { port: 30040 });

    const init = spy.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('GET');
    expect(init.headers).toBeUndefined();
    expect(init.body).toBeUndefined();
  });

  it('serializes the body and sets Content-Type on POST', async () => {
    const spy = stubFetch(async () => ({ ok: true, json: async () => ({ ok: 1 }) }));

    await proxyToPofBridge('compile/live', { port: 30040, method: 'POST', body: { force: true } });

    const init = spy.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(init.body).toBe(JSON.stringify({ force: true }));
  });

  it('maps a non-2xx response to a reachable error with the status and a sliced body', async () => {
    const longBody = 'x'.repeat(300);
    stubFetch(async () => ({ ok: false, status: 503, text: async () => longBody }));

    const result = await proxyToPofBridge('snapshot/diff', { port: 30040 });

    expect(result.ok).toBe(false);
    const fail = result as Extract<PofProxyResult<unknown>, { ok: false }>;
    expect(fail.reachable).toBe(true);
    expect(fail.status).toBe(503);
    expect(fail.detail).toHaveLength(200);
  });

  it('maps a fetch rejection to an unreachable error with a 502 default status', async () => {
    stubFetch(async () => { throw new Error('connect ECONNREFUSED'); });

    const result = await proxyToPofBridge('status', { port: 30040 });

    expect(result.ok).toBe(false);
    const fail = result as Extract<PofProxyResult<unknown>, { ok: false }>;
    expect(fail.reachable).toBe(false);
    expect(fail.status).toBe(502);
    expect(fail.detail).toMatch(/ECONNREFUSED/);
  });
});

describe('pofProxyError', () => {
  it('formats a reachable HTTP error as "<label>: <detail>" preserving the status', async () => {
    const res = pofProxyError(
      { ok: false, reachable: true, status: 404, detail: 'not found' },
      'Blueprint introspection error',
    );
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      success: false,
      error: 'Blueprint introspection error: not found',
    });
  });

  it('uses the bare label when the detail body is empty', async () => {
    const res = pofProxyError(
      { ok: false, reachable: true, status: 500, detail: '' },
      'Failed to get compile status',
    );
    expect(await res.json()).toEqual({
      success: false,
      error: 'Failed to get compile status',
    });
  });

  it('surfaces the raw connection message for an unreachable bridge', async () => {
    const res = pofProxyError(
      { ok: false, reachable: false, status: 502, detail: 'Failed to reach PoF Bridge plugin' },
      'Compile error',
    );
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      success: false,
      error: 'Failed to reach PoF Bridge plugin',
    });
  });
});
