import { describe, it, expect, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { bridgeFetch, type BridgeFetchResult } from '@/lib/bridge/transport';
import { proxyToPofBridge, pofProxyError } from '@/lib/pof-bridge/proxy';

/**
 * The bridge transport kernel: ONE place decides what a bridge failure is, and
 * the verdict travels as a field (`kind`, `reachable`, `indeterminate`), never as
 * a sentence a downstream classifier has to re-parse. No real UE connection: every
 * case injects its own fetch.
 */

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
  vi.restoreAllMocks();
});

const URL_STATUS = 'http://h:1/pof/status';

/** A fetch that resolves with `status` and a text body. */
function answers(status: number, body: string) {
  return vi.fn(async () => ({ ok: status >= 200 && status < 300, status, text: async () => body }));
}

/** A fetch that never settles and ignores its signal: only the kernel's own deadline can end it. */
function neverSettles() {
  return vi.fn(() => new Promise<Response>(() => {}));
}

function asFailure<T>(result: BridgeFetchResult<T>) {
  expect(result.ok).toBe(false);
  return result as Extract<BridgeFetchResult<T>, { ok: false }>;
}

describe('bridgeFetch (the bridge transport kernel)', () => {
  it('returns {ok, status, data} for a 2xx JSON answer', async () => {
    const result = await bridgeFetch(URL_STATUS, {
      method: 'GET',
      timeoutMs: 1000,
      fetchImpl: answers(200, '{"a":1}') as never,
    });
    expect(result).toEqual({ ok: true, status: 200, data: { a: 1 } });
  });

  it('reports a live plugin answering 200 with garbage as malformed-body, reachable, with a bounded snippet', async () => {
    const fail = asFailure(
      await bridgeFetch(URL_STATUS, { method: 'GET', timeoutMs: 1000, fetchImpl: answers(200, '<html>oops') as never }),
    );
    expect(fail).toMatchObject({ ok: false, kind: 'malformed-body', reachable: true, status: 502 });
    expect(fail.detail).toContain('HTTP 200');
    expect(fail.detail).toContain('<html>oops');

    const huge = 'q'.repeat(5000);
    const big = asFailure(
      await bridgeFetch(URL_STATUS, { method: 'GET', timeoutMs: 1000, fetchImpl: answers(200, huge) as never }),
    );
    expect(big.kind).toBe('malformed-body');
    expect(big.detail).toContain('q'.repeat(200));
    expect(big.detail).not.toContain('q'.repeat(201));
  });

  it('reports a rejected fetch as unreachable, definite (nothing was received)', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('fetch failed');
    });
    const fail = asFailure(await bridgeFetch(URL_STATUS, { method: 'GET', timeoutMs: 1000, fetchImpl: fetchImpl as never }));
    expect(fail).toMatchObject({ ok: false, kind: 'unreachable', reachable: false, indeterminate: false });
  });

  it('classifies a 401 as auth-rejected at the kernel and through the PoF proxy', async () => {
    const fail = asFailure(
      await bridgeFetch(URL_STATUS, { method: 'GET', timeoutMs: 1000, fetchImpl: answers(401, 'bad token') as never }),
    );
    expect(fail).toMatchObject({ ok: false, kind: 'auth-rejected', status: 401, reachable: true });

    globalThis.fetch = answers(401, 'bad token') as unknown as typeof fetch;
    const proxied = await proxyToPofBridge('status', { port: 30040 });
    expect(proxied.ok).toBe(false);
    if (proxied.ok) return;
    expect(proxied.kind).toBe('auth-rejected');

    const res = pofProxyError(proxied, 'Plugin status error');
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/auth token/i);
  });

  it('closes a timed-out non-GET as indeterminate and a timed-out GET as definite', async () => {
    const post = asFailure(
      await bridgeFetch(URL_STATUS, { method: 'POST', timeoutMs: 20, fetchImpl: neverSettles() as never }),
    );
    expect(post).toMatchObject({ kind: 'timeout', indeterminate: true });

    const get = asFailure(
      await bridgeFetch(URL_STATUS, { method: 'GET', timeoutMs: 20, fetchImpl: neverSettles() as never }),
    );
    expect(get).toMatchObject({ kind: 'timeout', indeterminate: false });

    globalThis.fetch = neverSettles() as unknown as typeof fetch;
    const postProxy = await proxyToPofBridge('compile/hot-patch', { port: 30040, method: 'POST', timeoutMs: 20 });
    const getProxy = await proxyToPofBridge('status', { port: 30040, timeoutMs: 20 });
    if (postProxy.ok || getProxy.ok) throw new Error('expected both proxied calls to time out');

    const postMsg = ((await pofProxyError(postProxy, 'Hot-patch error').json()) as { error: string }).error;
    const getMsg = ((await pofProxyError(getProxy, 'Plugin status error').json()) as { error: string }).error;
    expect(postMsg).toMatch(/outcome is unknown/i);
    expect(postMsg).toMatch(/before retrying/i);
    expect(getMsg).not.toMatch(/unknown/i);
    expect(getMsg).not.toMatch(/retrying/i);
  });

  it('is the only transport: proxy, run-python and bridgeRequest delegate to it', () => {
    const files = ['src/lib/pof-bridge/proxy.ts', 'src/lib/bridge/run-python.ts', 'src/lib/ue5-bridge/shared.ts'];
    const rollOwn = files.filter((f) => {
      const src = readFileSync(resolve(process.cwd(), f), 'utf8');
      return src.includes('fetch(') || src.includes('new AbortController');
    });
    expect(rollOwn).toEqual([]);
    for (const f of files) {
      expect(readFileSync(resolve(process.cwd(), f), 'utf8')).toContain('@/lib/bridge/transport');
    }
  });
});
