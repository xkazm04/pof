import test from 'node:test';
import assert from 'node:assert/strict';
import { createPofClient, PofApiError, originFromEnv } from './pofClient.js';

type FetchLike = (...args: unknown[]) => Promise<unknown>;
function mockFetch(impl: FetchLike): void {
  (globalThis as unknown as { fetch: FetchLike }).fetch = impl;
}

test('unwraps a success envelope to data', async () => {
  mockFetch(async () => ({ ok: true, status: 200, json: async () => ({ success: true, data: { hello: 'world' } }) }));
  const pof = createPofClient('http://x');
  assert.deepEqual(await pof.get('/api/x'), { hello: 'world' });
});

test('throws PofApiError carrying the server error message on a failure envelope', async () => {
  mockFetch(async () => ({ ok: false, status: 400, json: async () => ({ success: false, error: 'bad thing' }) }));
  const pof = createPofClient('http://x');
  await assert.rejects(
    () => pof.get('/api/x'),
    (e: unknown) => e instanceof PofApiError && e.message === 'bad thing' && e.status === 400,
  );
});

test('maps a network failure to a friendly "backend not reachable" error', async () => {
  mockFetch(async () => {
    throw new Error('ECONNREFUSED');
  });
  const pof = createPofClient('http://127.0.0.1:3000');
  await assert.rejects(
    () => pof.get('/api/x'),
    (e: unknown) => e instanceof PofApiError && /not reachable/.test((e as Error).message),
  );
});

test('post serializes the body and unwraps the result', async () => {
  let seenBody: string | undefined;
  mockFetch(async (_url: unknown, init: unknown) => {
    seenBody = (init as { body?: string }).body;
    return { ok: true, status: 200, json: async () => ({ success: true, data: { ok: 1 } }) };
  });
  const pof = createPofClient('http://x');
  const out = await pof.post('/api/y', { a: 2 });
  assert.deepEqual(out, { ok: 1 });
  assert.equal(seenBody, JSON.stringify({ a: 2 }));
});

test('originFromEnv prefers POF_APP_ORIGIN, then PORT, then the dev default', () => {
  assert.equal(originFromEnv({ POF_APP_ORIGIN: 'http://a/' }), 'http://a');
  assert.equal(originFromEnv({ PORT: '3001' }), 'http://127.0.0.1:3001');
  assert.equal(originFromEnv({}), 'http://127.0.0.1:3000');
});
