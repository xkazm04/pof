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

/** A 2xx response whose body is the JSON serialization of `payload`. */
function jsonResponse(payload: unknown) {
  return { ok: true, status: 200, text: async () => JSON.stringify(payload) };
}

function asFailure(result: PofProxyResult<unknown>) {
  expect(result.ok).toBe(false);
  return result as Extract<PofProxyResult<unknown>, { ok: false }>;
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
    const spy = stubFetch(async () => jsonResponse({ connected: true }));

    const result = await proxyToPofBridge<{ connected: boolean }>('status', { port: 30040 });

    expect(spy.mock.calls[0][0]).toBe('http://127.0.0.1:30040/pof/status');
    expect(result).toEqual({ ok: true, data: { connected: true } });
  });

  it('honors a non-default port and an embedded query string in the path', async () => {
    const spy = stubFetch(async () => jsonResponse({}));

    await proxyToPofBridge('manifest?checksum-only=true', { port: 41000 });

    expect(spy.mock.calls[0][0]).toBe('http://127.0.0.1:41000/pof/manifest?checksum-only=true');
  });

  it('does not set a Content-Type header on GET', async () => {
    const spy = stubFetch(async () => jsonResponse({}));

    await proxyToPofBridge('status', { port: 30040 });

    const init = spy.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('GET');
    expect(init.headers).toBeUndefined();
    expect(init.body).toBeUndefined();
  });

  it('serializes the body and sets Content-Type on POST', async () => {
    const spy = stubFetch(async () => jsonResponse({ ok: 1 }));

    await proxyToPofBridge('compile/live', { port: 30040, method: 'POST', body: { force: true } });

    const init = spy.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(init.body).toBe(JSON.stringify({ force: true }));
  });

  it('maps a non-2xx response to a reachable error with the status and a sliced body', async () => {
    const longBody = 'x'.repeat(300);
    stubFetch(async () => ({ ok: false, status: 503, text: async () => longBody }));

    const fail = asFailure(await proxyToPofBridge('snapshot/diff', { port: 30040 }));

    expect(fail.reachable).toBe(true);
    expect(fail.kind).toBe('http-error');
    expect(fail.status).toBe(503);
    expect(fail.detail).toHaveLength(200);
  });

  it('maps a fetch rejection to an unreachable error with a 502 default status', async () => {
    stubFetch(async () => {
      throw new Error('connect ECONNREFUSED');
    });

    const fail = asFailure(await proxyToPofBridge('status', { port: 30040 }));

    expect(fail.reachable).toBe(false);
    expect(fail.kind).toBe('unreachable');
    expect(fail.status).toBe(502);
    expect(fail.detail).toMatch(/ECONNREFUSED/);
  });

  // ── reachable-but-broken: the whole point of the `kind` distinction ─────────

  it('does NOT report a 200 with an unparseable body as unreachable', async () => {
    stubFetch(async () => ({ ok: true, status: 200, text: async () => '<html>plugin crashed</html>' }));

    const fail = asFailure(await proxyToPofBridge('status', { port: 30040 }));

    expect(fail.reachable).toBe(true);
    expect(fail.kind).toBe('malformed-body');
    // Reports what was actually received: the status and a snippet of the body.
    expect(fail.detail).toMatch(/HTTP 200/);
    expect(fail.detail).toMatch(/<html>plugin crashed<\/html>/);
    expect(fail.status).toBe(502);
  });

  it('bounds the echoed body snippet of a malformed reply', async () => {
    const huge = 'y'.repeat(5000);
    stubFetch(async () => ({ ok: true, status: 200, text: async () => huge }));

    const fail = asFailure(await proxyToPofBridge('manifest', { port: 30040 }));

    expect(fail.kind).toBe('malformed-body');
    expect(fail.detail).not.toContain('y'.repeat(201));
    expect(fail.detail.length).toBeLessThan(700);
  });

  it('reports a body that could not be read as reachable, not unreachable', async () => {
    stubFetch(async () => ({
      ok: true,
      status: 200,
      text: async () => {
        throw new Error('socket hang up');
      },
    }));

    const fail = asFailure(await proxyToPofBridge('manifest', { port: 30040 }));

    expect(fail.reachable).toBe(true);
    expect(fail.kind).toBe('malformed-body');
    expect(fail.detail).toMatch(/socket hang up/);
  });

  it('reports an aborted request as a timeout, naming the bound', async () => {
    stubFetch(async (_url, init) => {
      // Never settles on its own — only the proxy's own deadline can end it.
      await new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('The operation was aborted')));
      });
      return jsonResponse({});
    });

    const fail = asFailure(await proxyToPofBridge('status', { port: 30040, timeoutMs: 20 }));

    expect(fail.kind).toBe('timeout');
    expect(fail.reachable).toBe(false);
    expect(fail.status).toBe(504);
    expect(fail.detail).toMatch(/did not respond within 20ms/);
  });
});

describe('pofProxyError', () => {
  it('formats a reachable HTTP error as "<label>: <detail>" preserving the status', async () => {
    const res = pofProxyError(
      { ok: false, reachable: true, kind: 'http-error', status: 404, detail: 'not found' },
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
      { ok: false, reachable: true, kind: 'http-error', status: 500, detail: '' },
      'Failed to get compile status',
    );
    expect(await res.json()).toEqual({
      success: false,
      error: 'Failed to get compile status',
    });
  });

  it('surfaces the raw connection message for an unreachable bridge', async () => {
    const res = pofProxyError(
      {
        ok: false,
        reachable: false,
        kind: 'unreachable',
        status: 502,
        detail: 'Failed to reach PoF Bridge plugin',
      },
      'Compile error',
    );
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      success: false,
      error: 'Failed to reach PoF Bridge plugin',
    });
  });

  it('reports a malformed reply as a plugin fault, not a connectivity message', async () => {
    const res = pofProxyError(
      {
        ok: false,
        reachable: true,
        kind: 'malformed-body',
        status: 502,
        detail: 'PoF Bridge answered HTTP 200 with an unparseable body (Unexpected token): <html>',
      },
      'Plugin status error',
    );
    expect(res.status).toBe(502);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/^Plugin status error: /);
    expect(body.error).not.toMatch(/unreachable/i);
  });
});
