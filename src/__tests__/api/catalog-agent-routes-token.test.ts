// @vitest-environment node
/**
 * The four agent-called write routes (pof-mcp / @@CALLBACK callers) are operator-guarded:
 * with POF_OPERATOR_TOKEN set a header-less POST is 401 before the body is read, the token
 * (Bearer, as the callback transport sends it) passes the guard, and the callback transport
 * forwards the token server-side.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as stepSubmit } from '@/app/api/catalog/step-submit/route';
import { POST as lifecycle } from '@/app/api/catalog/lifecycle/route';
import { POST as pipeline } from '@/app/api/pipeline/route';
import { POST as settleTest } from '@/app/api/pipeline-artifacts/drain/settle-test/route';
import { postCallbackBody } from '@/lib/cli-task';

const ROUTES = [
  { name: 'catalog/step-submit', post: stepSubmit },
  { name: 'catalog/lifecycle', post: lifecycle },
  { name: 'pipeline', post: pipeline },
  { name: 'pipeline-artifacts/drain/settle-test', post: settleTest },
];

let saved: string | undefined;
beforeEach(() => { saved = process.env.POF_OPERATOR_TOKEN; process.env.POF_OPERATOR_TOKEN = 'sekrit'; });
afterEach(() => {
  if (saved === undefined) delete process.env.POF_OPERATOR_TOKEN; else process.env.POF_OPERATOR_TOKEN = saved;
  vi.unstubAllGlobals();
});

describe.each(ROUTES)('POST /api/$name in token mode', ({ name, post }) => {
  const req = (headers: Record<string, string>) => new NextRequest(`http://localhost:3001/api/${name}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', host: 'localhost:3001', ...headers }, body: '{}',
  });

  it('401s a header-less call', async () => {
    expect((await post(req({}))).status).toBe(401);
  });

  it('lets the token through the guard (an empty body is then the caller error, 400)', async () => {
    expect((await post(req({ authorization: 'Bearer sekrit' }))).status).toBe(400);
    expect((await post(req({ 'x-operator-token': 'sekrit' }))).status).toBe(400);
  });
});

describe('postCallbackBody', () => {
  const seen = () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ success: true, data: {} })));
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  };
  const headersOf = (m: ReturnType<typeof seen>) => (m.mock.calls[0] as unknown as [string, RequestInit])[1].headers as Record<string, string>;

  it('presents the operator token as a Bearer header when one is configured', async () => {
    const m = seen();
    await postCallbackBody({ url: 'http://localhost/api/catalog', method: 'POST', body: {} });
    expect(headersOf(m).Authorization).toBe('Bearer sekrit');
  });

  it('adds nothing when no token is configured', async () => {
    delete process.env.POF_OPERATOR_TOKEN;
    const m = seen();
    await postCallbackBody({ url: 'http://localhost/api/catalog', method: 'POST', body: {} });
    expect(headersOf(m).Authorization).toBeUndefined();
  });
});
