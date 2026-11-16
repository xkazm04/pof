/** Entry contract of POST /api/ue-test-scaffold and the abort path of the UE5 status stream. */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const unsubscribe = vi.fn();
vi.mock('@/lib/ue5-bridge/connection-manager', () => ({
  ue5Connection: { getState: () => ({ status: 'disconnected' }), onStateChange: () => unsubscribe },
}));

const { POST } = await import('@/app/api/ue-test-scaffold/route');
const { GET: status } = await import('@/app/api/ue5-bridge/status/route');

const post = (raw?: string) =>
  new NextRequest('http://localhost:3001/api/ue-test-scaffold', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: raw,
  });

beforeEach(() => unsubscribe.mockClear());

describe('POST /api/ue-test-scaffold', () => {
  it.each(['{not json', 'null', '[]', '{"action":"explode"}', '{"testName":"VSFoo","claim":5}'])(
    'answers 400 for %s',
    async (raw) => {
      expect((await POST(post(raw))).status).toBe(400);
    },
  );

  it('an empty body is still the default scaffold-all', async () => {
    const res = await POST(post());
    expect(res.status).toBe(200);
    expect(Array.isArray((await res.json()).data.scaffolds)).toBe(true);
  });
});

describe('GET /api/ue5-bridge/status', () => {
  it('releases its subscription when the request was aborted before the stream started', async () => {
    const ac = new AbortController();
    ac.abort();
    const res = await status(new NextRequest('http://localhost:3001/api/ue5-bridge/status', { signal: ac.signal }));
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    await res.body?.cancel().catch(() => undefined);
  });
});
