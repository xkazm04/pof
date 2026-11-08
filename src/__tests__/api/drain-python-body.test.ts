// @vitest-environment node
/**
 * POST /api/pipeline-artifacts/drain-python body validation: `bridgeUrl` is fetched by the
 * server, so it is loopback-only (400 otherwise, nothing dispatched).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

const { drainAll } = vi.hoisted(() => ({
  drainAll: vi.fn<(f: unknown, d: unknown, o: unknown) => Promise<{ results: never[] }>>(async () => ({ results: [] })),
}));
vi.mock('@/lib/catalog/pipelines/registry.generated', () => ({}));
vi.mock('@/lib/catalog/acceptance/pythonDrain', () => ({
  drainPythonAll: drainAll, readDispatch: () => null, hasResult: () => false,
}));

import { POST } from '@/app/api/pipeline-artifacts/drain-python/route';

const post = (body: unknown) => POST(new NextRequest('http://localhost:3001/api/pipeline-artifacts/drain-python', {
  method: 'POST', headers: { 'Content-Type': 'application/json', host: 'localhost:3001' }, body: JSON.stringify(body),
}));

let saved: string | undefined;
beforeEach(() => { saved = process.env.POF_OPERATOR_TOKEN; delete process.env.POF_OPERATOR_TOKEN; drainAll.mockClear(); });
afterEach(() => { if (saved !== undefined) process.env.POF_OPERATOR_TOKEN = saved; });

describe('drain-python bridgeUrl', () => {
  it.each([
    'http://169.254.169.254/',
    'http://evil.test:30040',
    'http://localhost.evil.test:30040',
    'ftp://localhost:30040',
    'http://localhost',
    'not a url',
  ])('400s %s and dispatches nothing', async (bridgeUrl) => {
    expect((await post({ bridgeUrl })).status).toBe(400);
    expect(drainAll).not.toHaveBeenCalled();
  });

  it('400s a non-string bridgeUrl', async () => {
    expect((await post({ bridgeUrl: 5 })).status).toBe(400);
    expect(drainAll).not.toHaveBeenCalled();
  });

  it.each(['http://localhost:30040', 'http://127.0.0.1:30040', 'http://[::1]:30040', 'https://localhost:30040'])(
    'accepts loopback %s',
    async (bridgeUrl) => {
      expect((await post({ bridgeUrl })).status).toBe(200);
      expect(drainAll).toHaveBeenCalledTimes(1);
    },
  );

  it('accepts an omitted bridgeUrl', async () => {
    expect((await post({})).status).toBe(200);
    expect(drainAll).toHaveBeenCalledTimes(1);
  });
});

describe('drain-python boolean flags', () => {
  const optsOf = () => drainAll.mock.calls[0][2] as { apply: boolean; force: boolean; continueOnFail: boolean };

  it.each([
    { apply: 'false' }, { apply: 0 }, { force: 'true' }, { continueOnFail: 1 }, { apply: null },
  ])('400s %j and dispatches nothing', async (body) => {
    expect((await post(body)).status).toBe(400);
    expect(drainAll).not.toHaveBeenCalled();
  });

  it('passes a boolean apply:false through as a dry run', async () => {
    expect((await post({ apply: false })).status).toBe(200);
    expect(optsOf()).toEqual({ apply: false, force: false, continueOnFail: false });
  });

  it('keeps the defaults when the flags are absent (apply on)', async () => {
    expect((await post({})).status).toBe(200);
    expect(optsOf()).toEqual({ apply: true, force: false, continueOnFail: false });
  });
});
