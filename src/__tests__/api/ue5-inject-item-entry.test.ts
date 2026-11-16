/** Entry contract of /api/ue5-inject-item. The connection is mocked; no editor is contacted. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

const client = { callFunction: vi.fn(async () => ({ ok: true, data: {} })) };
vi.mock('@/lib/ue5-bridge/connection-manager', () => ({
  ue5Connection: { getClient: () => client, getState: () => ({ status: 'connected' }) },
}));

const { POST } = await import('@/app/api/ue5-inject-item/route');
const savedToken = process.env.POF_OPERATOR_TOKEN;

function req(raw: string, headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost:3001/api/ue5-inject-item', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', host: 'localhost:3001', ...headers },
    body: raw,
  });
}

const affix = { tag: 'Affix.Fire', displayName: 'Fiery', magnitude: 1.5, bIsPrefix: true };
const good = { definitionAsset: 'DA_Iron_Sword', itemLevel: 5, affixes: [affix] };

beforeEach(() => {
  delete process.env.POF_OPERATOR_TOKEN;
  client.callFunction.mockClear();
});

afterEach(() => {
  if (savedToken === undefined) delete process.env.POF_OPERATOR_TOKEN;
  else process.env.POF_OPERATOR_TOKEN = savedToken;
});

describe('POST /api/ue5-inject-item', () => {
  it('refuses a foreign Origin', async () => {
    const res = await POST(req(JSON.stringify(good), { origin: 'https://evil.example' }));
    expect(res.status).toBe(403);
    expect(client.callFunction).not.toHaveBeenCalled();
  });

  it.each(['{not json', 'null', '[]'])('answers 400 for body %s', async (raw) => {
    expect((await POST(req(raw))).status).toBe(400);
  });

  it.each([
    [{ ...good, definitionAsset: '../../Engine/Secret' }],
    [{ ...good, definitionAsset: 'Sub\\DA_X' }],
    [{ ...good, definitionAsset: 5 }],
    [{ ...good, itemLevel: 1.5 }],
    [{ ...good, affixes: [null] }],
    [{ ...good, affixes: [{ ...affix, magnitude: 'big' }] }],
    [{ ...good, affixes: [{ ...affix, tag: 5 }] }],
    [{ ...good, affixes: [{ ...affix, bIsPrefix: 'yes' }] }],
  ])('refuses %j before calling the editor', async (body) => {
    expect((await POST(req(JSON.stringify(body)))).status).toBe(400);
    expect(client.callFunction).not.toHaveBeenCalled();
  });

  it('injects the shape the workbench sends', async () => {
    expect((await POST(req(JSON.stringify(good)))).status).toBe(200);
    expect(client.callFunction).toHaveBeenCalledTimes(2);
  });
});
