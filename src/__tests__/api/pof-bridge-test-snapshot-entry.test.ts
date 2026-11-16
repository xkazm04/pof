/**
 * The test and snapshot POSTs drive the editor (run automation, load maps, overwrite baselines).
 * An unknown action used to fall through to the destructive default, and a testId of `..` left
 * encodeURIComponent untouched and escaped /pof/test/results/ once the URL was normalized.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as testGet, POST as testPost } from '@/app/api/pof-bridge/test/route';
import { POST as snapshotPost } from '@/app/api/pof-bridge/snapshot/route';

const realFetch = globalThis.fetch;
const savedToken = process.env.POF_OPERATOR_TOKEN;
let spy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  delete process.env.POF_OPERATOR_TOKEN;
  spy = vi.fn(async () => ({ ok: true, status: 200, text: async () => '{"ok":true}' }));
  globalThis.fetch = spy as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
  if (savedToken === undefined) delete process.env.POF_OPERATOR_TOKEN;
  else process.env.POF_OPERATOR_TOKEN = savedToken;
});

function req(path: string, raw: string, headers: Record<string, string> = {}) {
  return new NextRequest(`http://localhost:3001${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', host: 'localhost:3001', ...headers },
    body: raw,
  });
}

const TEST = '/api/pof-bridge/test';
const SNAP = '/api/pof-bridge/snapshot';
const FOREIGN = { origin: 'https://evil.example' };

describe('POST /api/pof-bridge/test', () => {
  it('refuses a foreign Origin', async () => {
    const res = await testPost(req(TEST, '{"action":"run-automation","filter":"x"}', FOREIGN));
    expect(res.status).toBe(403);
    expect(spy).not.toHaveBeenCalled();
  });

  it.each([
    ['{not json'], ['null'], ['[]'],
    ['{"action":"explode"}'],
    ['{"spec":{}}'],
    ['{"action":"run"}'],
    ['{"action":"run","spec":"x"}'],
    ['{"action":"run-automation"}'],
    ['{"action":"run-automation","filter":5}'],
    ['{"action":"run-automation","filter":"x","flags":[1]}'],
  ])('answers 400 for %s', async (raw) => {
    const res = await testPost(req(TEST, raw));
    expect(res.status).toBe(400);
    expect(spy).not.toHaveBeenCalled();
  });

  it('forwards run and run-automation', async () => {
    expect((await testPost(req(TEST, '{"action":"run","spec":{"name":"a"}}'))).status).toBe(200);
    expect(spy.mock.calls[0][0]).toBe('http://127.0.0.1:30040/pof/test/run');
    expect((await testPost(req(TEST, '{"action":"run-automation","filter":"VS","flags":["a"]}'))).status).toBe(200);
    expect(spy.mock.calls[1][0]).toBe('http://127.0.0.1:30040/pof/test/run-automation');
  });
});

describe('GET /api/pof-bridge/test', () => {
  const get = (qs: string) => testGet(new NextRequest(`http://localhost:3001${TEST}${qs}`));

  it.each(['..', '.', '%2e%2e'])('refuses the dot-segment testId %s', async (id) => {
    const res = await get(`?testId=${id}`);
    expect(res.status).toBe(400);
    expect(spy).not.toHaveBeenCalled();
  });

  it('still reads an ordinary id', async () => {
    expect((await get('?testId=abc-1')).status).toBe(200);
    expect(spy.mock.calls[0][0]).toBe('http://127.0.0.1:30040/pof/test/results/abc-1');
  });
});

describe('POST /api/pof-bridge/snapshot', () => {
  it('refuses a foreign Origin', async () => {
    const res = await snapshotPost(req(SNAP, '{"action":"baseline","presetIds":["a"]}', FOREIGN));
    expect(res.status).toBe(403);
    expect(spy).not.toHaveBeenCalled();
  });

  it.each([
    ['{not json'], ['null'], ['[]'],
    ['{"action":"wipe","presetIds":["a"]}'],
    ['{"presetIds":"a"}'],
    ['{"presetIds":[1]}'],
    ['{"presetIds":["a"],"diffThreshold":"x"}'],
  ])('answers 400 for %s', async (raw) => {
    const res = await snapshotPost(req(SNAP, raw));
    expect(res.status).toBe(400);
    expect(spy).not.toHaveBeenCalled();
  });

  it('an action-less capture (what useSnapshots posts) and a baseline both forward', async () => {
    expect((await snapshotPost(req(SNAP, '{"presetIds":["a"],"compareToBaseline":true}'))).status).toBe(200);
    expect(spy.mock.calls[0][0]).toBe('http://127.0.0.1:30040/pof/snapshot/capture');
    expect((await snapshotPost(req(SNAP, '{"action":"baseline","presetIds":["a"]}'))).status).toBe(200);
    expect(spy.mock.calls[1][0]).toBe('http://127.0.0.1:30040/pof/snapshot/baseline');
  });
});
